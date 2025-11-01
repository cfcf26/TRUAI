/**
 * Cache Module - LRU In-Memory Caching for TruAI
 *
 * Provides three separate caches to optimize API calls:
 * 1. Source Content Cache - Reduces ScrapingBee API calls
 * 2. GPT Verification Cache - Reduces OpenAI API calls
 * 3. Credibility Cache - Eliminates redundant domain evaluations
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import type { SourceContent, GPTVerificationInput, GPTVerificationOutput } from './types';

// ============================================================================
// Cache Instances
// ============================================================================

/**
 * Source Content Cache
 * Stores scraped content from URLs to avoid redundant ScrapingBee API calls
 * Key: URL (normalized)
 * TTL: 7 days (604800000 ms)
 * Max entries: 1000 URLs
 */
export const sourceContentCache = new LRUCache<string, SourceContent>({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
  updateAgeOnGet: true, // Reset TTL on cache hit
  updateAgeOnHas: false,
});

/**
 * GPT Verification Cache
 * Stores GPT verification results to avoid redundant OpenAI API calls
 * Key: Hash of (paragraph_text + sorted_source_urls + source_contents)
 * TTL: 24 hours (86400000 ms)
 * Max entries: 500 verifications
 */
export const gptVerificationCache = new LRUCache<string, GPTVerificationOutput>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

/**
 * Credibility Cache
 * Stores domain credibility evaluations
 * Key: Domain (e.g., 'arxiv.org', 'github.com')
 * TTL: 90 days (7776000000 ms)
 * Max entries: 2000 domains
 */
export const credibilityCache = new LRUCache<string, 'academic' | 'official' | 'news' | 'blog' | 'unknown'>({
  max: 2000,
  ttl: 1000 * 60 * 60 * 24 * 90, // 90 days
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Normalize URL for consistent cache keys
 * - Removes trailing slashes
 * - Converts to lowercase
 * - Removes URL fragments (#)
 * - Preserves query parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove fragment
    parsed.hash = '';
    // Convert to lowercase
    const normalized = parsed.toString().toLowerCase();
    // Remove trailing slash
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    // If URL parsing fails, return as-is
    return url.toLowerCase();
  }
}

/**
 * Extract domain from URL for credibility cache
 * Returns hostname without 'www.' prefix
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return url;
  }
}

/**
 * Generate cache key for GPT verification
 * Creates a deterministic hash based on:
 * - Paragraph text
 * - Sorted source URLs
 * - Source content snippets (first 1000 chars of each)
 *
 * This ensures same input → same cache key
 */
export function generateGPTCacheKey(input: GPTVerificationInput): string {
  // Sort URLs for deterministic ordering
  const sortedUrls = [...input.paragraph_links].sort();

  // Create content snippets (first 1000 chars of each source)
  const contentSnippets = input.sources
    .map(s => s.content.slice(0, 1000))
    .join('|');

  // Combine all inputs
  const combinedInput = [
    input.paragraph_text,
    sortedUrls.join('|'),
    contentSnippets,
  ].join('::');

  // Generate SHA-256 hash
  return createHash('sha256')
    .update(combinedInput)
    .digest('hex');
}

// ============================================================================
// Cache Statistics
// ============================================================================

export interface CacheStats {
  sourceContent: {
    size: number;
    max: number;
    hitRate: number;
  };
  gptVerification: {
    size: number;
    max: number;
    hitRate: number;
  };
  credibility: {
    size: number;
    max: number;
    hitRate: number;
  };
}

// Track cache hits/misses for statistics
const cacheMetrics = {
  sourceContent: { hits: 0, misses: 0 },
  gptVerification: { hits: 0, misses: 0 },
  credibility: { hits: 0, misses: 0 },
};

/**
 * Record a cache hit for statistics
 */
export function recordCacheHit(cacheType: 'sourceContent' | 'gptVerification' | 'credibility'): void {
  cacheMetrics[cacheType].hits++;
}

/**
 * Record a cache miss for statistics
 */
export function recordCacheMiss(cacheType: 'sourceContent' | 'gptVerification' | 'credibility'): void {
  cacheMetrics[cacheType].misses++;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const calculateHitRate = (hits: number, misses: number): number => {
    const total = hits + misses;
    return total === 0 ? 0 : Number((hits / total * 100).toFixed(2));
  };

  return {
    sourceContent: {
      size: sourceContentCache.size,
      max: sourceContentCache.max,
      hitRate: calculateHitRate(
        cacheMetrics.sourceContent.hits,
        cacheMetrics.sourceContent.misses
      ),
    },
    gptVerification: {
      size: gptVerificationCache.size,
      max: gptVerificationCache.max,
      hitRate: calculateHitRate(
        cacheMetrics.gptVerification.hits,
        cacheMetrics.gptVerification.misses
      ),
    },
    credibility: {
      size: credibilityCache.size,
      max: credibilityCache.max,
      hitRate: calculateHitRate(
        cacheMetrics.credibility.hits,
        cacheMetrics.credibility.misses
      ),
    },
  };
}

/**
 * Reset cache metrics (useful for testing)
 */
export function resetCacheMetrics(): void {
  cacheMetrics.sourceContent.hits = 0;
  cacheMetrics.sourceContent.misses = 0;
  cacheMetrics.gptVerification.hits = 0;
  cacheMetrics.gptVerification.misses = 0;
  cacheMetrics.credibility.hits = 0;
  cacheMetrics.credibility.misses = 0;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  sourceContentCache.clear();
  gptVerificationCache.clear();
  credibilityCache.clear();
  resetCacheMetrics();
}
