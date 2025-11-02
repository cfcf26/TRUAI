// ScrapingBee integration for web scraping

import * as cheerio from 'cheerio';
import type { SourceContent } from './types';
import {
  sourceContentCache,
  credibilityCache,
  normalizeUrl,
  extractDomain,
  recordCacheHit,
  recordCacheMiss,
} from './cache';

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || '';
const SCRAPING_TIMEOUT = 15000; // 15 seconds

// Academic domains
const ACADEMIC_DOMAINS = [
  'arxiv.org',
  'scholar.google.com',
  'ieee.org',
  'acm.org',
  'nature.com',
  'science.org',
  'springer.com',
  'sciencedirect.com',
  'pubmed.ncbi.nlm.nih.gov',
  'jstor.org',
];

// Official/Government domains
const OFFICIAL_DOMAINS = [
  'gov',
  'edu',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'europa.eu',
  'un.org',
];

// News domains
const NEWS_DOMAINS = [
  'nytimes.com',
  'washingtonpost.com',
  'bbc.com',
  'reuters.com',
  'apnews.com',
  'theguardian.com',
  'bloomberg.com',
  'wsj.com',
  'cnn.com',
  'npr.org',
];

/**
 * Evaluates the credibility of a source based on its domain
 * Uses cache to avoid redundant evaluations
 */
export function evaluateCredibility(
  url: string
): 'academic' | 'official' | 'news' | 'blog' | 'unknown' {
  try {
    // Extract domain for cache key
    const domain = extractDomain(url);

    // Check cache first
    const cached = credibilityCache.get(domain);
    if (cached !== undefined) {
      recordCacheHit('credibility');
      return cached;
    }

    // Cache miss - perform evaluation
    recordCacheMiss('credibility');

    const hostname = new URL(url).hostname.toLowerCase();

    let credibility: 'academic' | 'official' | 'news' | 'blog' | 'unknown';

    // Check academic
    if (ACADEMIC_DOMAINS.some((d) => hostname.includes(d))) {
      credibility = 'academic';
    }
    // Check official
    else if (OFFICIAL_DOMAINS.some((d) => hostname.endsWith(d) || hostname.includes(d))) {
      credibility = 'official';
    }
    // Check news
    else if (NEWS_DOMAINS.some((d) => hostname.includes(d))) {
      credibility = 'news';
    }
    // Check for blog platforms
    else if (
      hostname.includes('medium.com') ||
      hostname.includes('blogger.com') ||
      hostname.includes('wordpress.com') ||
      hostname.includes('substack.com')
    ) {
      credibility = 'blog';
    }
    else {
      credibility = 'unknown';
    }

    // Store in cache
    credibilityCache.set(domain, credibility);

    return credibility;
  } catch {
    return 'unknown';
  }
}

/**
 * Extracts title from HTML using cheerio
 */
function extractTitle($: cheerio.CheerioAPI, url: string): string {
  // Try multiple selectors in order of preference
  const title =
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    url;

  return title;
}

/**
 * Extracts main content from HTML using cheerio
 */
function extractContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();

  // Try to find main content
  const mainContent =
    $('article').text() ||
    $('main').text() ||
    $('.content').text() ||
    $('.post-content').text() ||
    $('body').text();

  // Clean up whitespace
  return mainContent
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000); // Limit to 10k characters
}

/**
 * Scrapes a URL using ScrapingBee
 * Uses cache to avoid redundant API calls
 */
export async function scrapeUrl(url: string): Promise<SourceContent> {
  try {
    // Validate URL
    new URL(url);

    // Normalize URL for consistent cache keys
    const cacheKey = normalizeUrl(url);

    // Check cache first
    const cached = sourceContentCache.get(cacheKey);
    if (cached) {
      recordCacheHit('sourceContent');
      console.log(`[CACHE HIT] Source content for: ${url}`);
      return cached;
    }

    // Cache miss - proceed with scraping
    recordCacheMiss('sourceContent');
    console.log(`[CACHE MISS] Scraping: ${url}`);

    const credibility = evaluateCredibility(url);

    // Check if API key is available
    if (!SCRAPINGBEE_API_KEY) {
      console.warn('ScrapingBee API key not configured, returning mock data');
      const mockResult = {
        url,
        title: 'Mock Title - ScrapingBee not configured',
        content: 'Mock content for URL: ' + url,
        credibility,
        error: 'ScrapingBee API key not configured',
      };
      // Cache mock results too
      sourceContentCache.set(cacheKey, mockResult);
      return mockResult;
    }

    // Build ScrapingBee API URL
    const apiUrl = new URL('https://app.scrapingbee.com/api/v1/');
    apiUrl.searchParams.append('api_key', SCRAPINGBEE_API_KEY);
    apiUrl.searchParams.append('url', url);
    apiUrl.searchParams.append('render_js', 'true'); // Set to 'true' if JavaScript rendering is needed
    apiUrl.searchParams.append('premium_proxy', 'true');
    apiUrl.searchParams.append('block_ads', 'true');
    apiUrl.searchParams.append('block_resources', 'true');
    apiUrl.searchParams.append('stealth_proxy', 'true');
    // apiUrl.searchParams.append('wait_browser', 'networkidle2');
    // apiUrl.searchParams.append('wait', '2000'); // Wait 2 seconds after load

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPING_TIMEOUT);

    const response = await fetch(apiUrl.toString(), {
      // signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ScrapingBee API error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = extractTitle($, url);
    const content = extractContent($);

    const result: SourceContent = {
      url,
      title,
      content,
      credibility,
    };

    // Store in cache
    sourceContentCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);

    const errorResult: SourceContent = {
      url,
      title: url,
      content: '',
      credibility: evaluateCredibility(url),
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    // Cache error results too (with shorter TTL implicitly handled by LRU)
    const cacheKey = normalizeUrl(url);
    sourceContentCache.set(cacheKey, errorResult);

    return errorResult;
  }
}

/**
 * Scrapes multiple URLs with a concurrency limit of 3
 * Processes up to 3 URLs in parallel, queuing the rest
 */
export async function scrapeUrls(urls: string[]): Promise<SourceContent[]> {
  // Limit to 5 URLs as per ARCHITECTURE.md
  const limitedUrls = urls.slice(0, 5);
  const CONCURRENCY = 7;

  // Create a queue of URLs with their original indices
  const queue = limitedUrls.map((url, index) => ({ url, index }));
  const results: SourceContent[] = new Array(limitedUrls.length);

  // Worker function that processes URLs from the queue
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const result = await scrapeUrl(item.url);
      results[item.index] = result;
    }
  };

  // Create worker pool with concurrency limit
  const workers = Array.from({ length: Math.min(CONCURRENCY, limitedUrls.length) }, () =>
    worker()
  );

  // Wait for all workers to complete
  await Promise.all(workers);
  // Wait 2 seconds before returning results
  await new Promise(resolve => setTimeout(resolve, 2000));
  return results;
}

/**
 * Scrapes a single URL with direct fetch (fallback method without ScrapingBee)
 * Useful for testing when ScrapingBee API is not available
 */
export async function scrapeDirect(url: string): Promise<SourceContent> {
  try {
    const credibility = evaluateCredibility(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPING_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; TruAI/1.0; +https://truai.example.com)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = extractTitle($, url);
    const content = extractContent($);

    return {
      url,
      title,
      content,
      credibility,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);

    return {
      url,
      title: url,
      content: '',
      credibility: evaluateCredibility(url),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
