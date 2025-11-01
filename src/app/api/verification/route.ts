import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getVerificationProgress } from '@/lib/verification';

/**
 * GET /api/verification?doc_id=...
 *
 * Returns verification progress and any accumulated results for a document.
 * Designed for simple polling when WebSocket/SSE is unavailable.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('doc_id');

  if (!docId) {
    return NextResponse.json(
      { error: 'doc_id query parameter is required' },
      { status: 400 }
    );
  }

  const document = storage.getDocument(docId);

  if (!document) {
    return NextResponse.json(
      { error: 'Document not found', doc_id: docId },
      { status: 404 }
    );
  }

  const results = storage.getResults(docId);
  const progress = getVerificationProgress(docId);

  return NextResponse.json({
    doc_id: docId,
    document,
    progress,
    results,
  });
}
