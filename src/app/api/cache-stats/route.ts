/**
 * Cache Statistics API Endpoint
 * GET /api/cache-stats
 *
 * Returns cache hit rates, sizes, and metrics for monitoring
 */

import { NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/cache';

export async function GET() {
  try {
    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
