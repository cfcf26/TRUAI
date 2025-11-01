// Test endpoint for triggering verification with mock data

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { startVerificationJob, getVerificationProgress } from '@/lib/verification';
import { getMockDocument, allMockDocuments } from '@/lib/mock-data';

/**
 * POST /api/test-verification
 * Triggers a verification job with mock data
 *
 * Body (optional):
 * {
 *   "doc_id": "test-doc-001" // Or any mock document ID
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const docId = body?.doc_id;

    // Get mock document
    const mockDoc = getMockDocument(docId);

    // Start verification job
    // Use sequential mode with 1 second delay to simulate real processing
    startVerificationJob(mockDoc.doc_id, mockDoc.paragraphs, true, 1000);

    return NextResponse.json({
      success: true,
      message: 'Verification job started',
      doc_id: mockDoc.doc_id,
      paragraph_count: mockDoc.paragraphs.length,
      note: 'Connect via WebSocket to receive real-time updates',
    });
  } catch (error) {
    console.error('Error in test-verification endpoint:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-verification
 * Lists available mock documents and current verification status
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const docId = url.searchParams.get('doc_id');

  if (docId) {
    // Get results for specific document
    const results = storage.getResults(docId);
    const progress = getVerificationProgress(docId);

    return NextResponse.json({
      doc_id: docId,
      results,
      progress,
    });
  }

  // List all available mock documents
  const mockDocs = allMockDocuments.map((doc) => ({
    doc_id: doc.doc_id,
    source_url: doc.source_url,
    paragraph_count: doc.paragraphs.length,
  }));

  // Get storage stats
  const stats = storage.getStats();

  return NextResponse.json({
    available_mock_documents: mockDocs,
    storage_stats: stats,
  });
}
