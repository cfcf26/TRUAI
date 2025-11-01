// ScrapingBee integration for web scraping

import * as cheerio from 'cheerio';
import type { SourceContent } from './types';

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
 */
export function evaluateCredibility(
  url: string
): 'academic' | 'official' | 'news' | 'blog' | 'unknown' {
  try {
    const domain = new URL(url).hostname.toLowerCase();

    // Check academic
    if (ACADEMIC_DOMAINS.some((d) => domain.includes(d))) {
      return 'academic';
    }

    // Check official
    if (OFFICIAL_DOMAINS.some((d) => domain.endsWith(d) || domain.includes(d))) {
      return 'official';
    }

    // Check news
    if (NEWS_DOMAINS.some((d) => domain.includes(d))) {
      return 'news';
    }

    // Check for blog platforms
    if (
      domain.includes('medium.com') ||
      domain.includes('blogger.com') ||
      domain.includes('wordpress.com') ||
      domain.includes('substack.com')
    ) {
      return 'blog';
    }

    return 'unknown';
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
 */
export async function scrapeUrl(url: string): Promise<SourceContent> {
  try {
    // Validate URL
    new URL(url);

    const credibility = evaluateCredibility(url);

    // Check if API key is available
    if (!SCRAPINGBEE_API_KEY) {
      console.warn('ScrapingBee API key not configured, returning mock data');
      return {
        url,
        title: 'Mock Title - ScrapingBee not configured',
        content: 'Mock content for URL: ' + url,
        credibility,
        error: 'ScrapingBee API key not configured',
      };
    }

    // Build ScrapingBee API URL
    const apiUrl = new URL('https://app.scrapingbee.com/api/v1/');
    apiUrl.searchParams.append('api_key', SCRAPINGBEE_API_KEY);
    apiUrl.searchParams.append('url', url);
    apiUrl.searchParams.append('render_js', 'false'); // Set to 'true' if JavaScript rendering is needed

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPING_TIMEOUT);

    const response = await fetch(apiUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ScrapingBee API error: ${response.status} ${response.statusText}`);
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

/**
 * Scrapes multiple URLs in parallel with a limit of 5
 */
export async function scrapeUrls(urls: string[]): Promise<SourceContent[]> {
  // Limit to 5 URLs as per ARCHITECTURE.md
  const limitedUrls = urls.slice(0, 5);

  // Scrape all URLs in parallel
  const results = await Promise.all(limitedUrls.map((url) => scrapeUrl(url)));

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
