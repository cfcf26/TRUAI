// Core verification logic for Backend Logic 2

import { storage } from './storage';
import { scrapeUrls } from './scraping';
import { verifyWithRetry } from './openai';
import type {
  Paragraph,
  VerificationResult,
  LinkDigest,
  SourceContent,
  GPTVerificationInput,
} from './types';

/**
 * Verifies a single paragraph against its sources
 */
export async function verifyParagraph(
  docId: string,
  paragraph: Paragraph
): Promise<VerificationResult> {
  const { id: paragraphId, text, links, isHeading } = paragraph;

  try {
    // Skip verification for headings
    if (isHeading) {
      console.log(
        `[Verification] Skipping verification for heading paragraph ${paragraphId}`
      );

      const headingResult: VerificationResult = {
        doc_id: docId,
        paragraph_id: paragraphId,
        confidence: 'high', // 헤딩은 검증 불필요하므로 high로 설정
        summary_of_sources: '제목/헤딩 - 검증 대상 아님',
        reasoning: '이 문단은 제목 또는 헤딩이므로 검증하지 않습니다.',
        link_digests: [],
      };

      // Store result immediately for headings
      storage.updateJobStatus(docId, paragraphId, 'in_progress');
      storage.storeResult(headingResult);

      return headingResult;
    }

    console.log(
      `[Verification] Starting verification for paragraph ${paragraphId} in document ${docId}`
    );

    // Update job status to in_progress
    storage.updateJobStatus(docId, paragraphId, 'in_progress');

    // Step 1: Scrape source URLs (max 5, in parallel)
    console.log(
      `[Verification] Scraping ${links.length} sources for paragraph ${paragraphId}`
    );
    const sources: SourceContent[] = await scrapeUrls(links);

    console.log(
      `[Verification] Scraped ${sources.length} sources for paragraph ${paragraphId}`
    );

    // Step 2: Prepare input for GPT verification
    const gptInput: GPTVerificationInput = {
      paragraph_text: text,
      paragraph_links: links,
      sources,
    };

    // Step 3: Call GPT for verification
    console.log(
      `[Verification] Calling GPT for verification of paragraph ${paragraphId}`
    );
    const gptOutput = await verifyWithRetry(gptInput);

    console.log(
      `[Verification] GPT returned confidence: ${gptOutput.confidence} for paragraph ${paragraphId}`
    );

    // Step 4: Create link digests
    const linkDigests: LinkDigest[] = sources.map((source) => ({
      url: source.url,
      title: source.title,
      summary: source.content
        ? `${source.content.slice(0, 200)}${source.content.length > 200 ? '...' : ''}`
        : source.error || 'No content available',
    }));

    // Step 5: Build verification result
    const result: VerificationResult = {
      doc_id: docId,
      paragraph_id: paragraphId,
      confidence: gptOutput.confidence,
      summary_of_sources: gptOutput.summary_of_sources,
      reasoning: gptOutput.reasoning,
      link_digests: linkDigests,
    };

    // Step 6: Store result (this will also notify listeners)
    storage.storeResult(result);

    console.log(
      `[Verification] Completed verification for paragraph ${paragraphId} in document ${docId}`
    );

    return result;
  } catch (error) {
    console.error(
      `[Verification] Error verifying paragraph ${paragraphId}:`,
      error
    );

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Store error
    storage.storeError(docId, paragraphId, errorMessage);

    // Return low confidence result
    const fallbackResult: VerificationResult = {
      doc_id: docId,
      paragraph_id: paragraphId,
      confidence: 'low',
      summary_of_sources: 'Verification failed due to an error',
      reasoning: `Error during verification: ${errorMessage}`,
      link_digests: [],
    };

    return fallbackResult;
  }
}

/**
 * Verifies all paragraphs in a document
 * Processes them in parallel for better performance
 */
export async function verifyDocument(
  docId: string,
  paragraphs: Paragraph[]
): Promise<VerificationResult[]> {
  console.log(
    `[Verification] Starting document verification for ${docId} with ${paragraphs.length} paragraphs`
  );

  // Create jobs for tracking
  storage.createJobs(docId, paragraphs);

  // Verify all paragraphs in parallel
  const results = await Promise.all(
    paragraphs.map((paragraph) => verifyParagraph(docId, paragraph))
  );

  console.log(
    `[Verification] Completed document verification for ${docId}`
  );

  return results;
}

/**
 * Verifies paragraphs sequentially with a delay between each
 * Useful for rate limiting or observing incremental updates
 */
export async function verifyDocumentSequential(
  docId: string,
  paragraphs: Paragraph[],
  delayMs = 0
): Promise<VerificationResult[]> {
  console.log(
    `[Verification] Starting sequential document verification for ${docId}`
  );

  // Create jobs for tracking
  storage.createJobs(docId, paragraphs);

  const results: VerificationResult[] = [];

  for (const paragraph of paragraphs) {
    const result = await verifyParagraph(docId, paragraph);
    results.push(result);

    // Add delay if specified
    if (delayMs > 0 && paragraph !== paragraphs[paragraphs.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(
    `[Verification] Completed sequential document verification for ${docId}`
  );

  return results;
}

/**
 * Starts verification in the background (non-blocking)
 * Returns immediately while verification happens in background
 */
export function startVerificationJob(
  docId: string,
  paragraphs: Paragraph[],
  delayMs = 0
): void {
  console.log(
    `[Verification] Starting background verification job for ${docId} (sequential)`
  );

  // Run verification in background (don't await)
  verifyDocumentSequential(docId, paragraphs, delayMs).catch((error) => {
    console.error(
      `[Verification] Background job failed for ${docId}:`,
      error
    );
  });
}

/**
 * Gets verification progress for a document
 */
export function getVerificationProgress(docId: string): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  percentComplete: number;
} {
  const jobs = storage.getJobs(docId);

  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const pending = jobs.filter((j) => j.status === 'pending').length;
  const inProgress = jobs.filter((j) => j.status === 'in_progress').length;

  return {
    total,
    completed,
    failed,
    pending,
    inProgress,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Cancels all pending jobs for a document
 * (Note: in-progress jobs cannot be cancelled in this simple implementation)
 */
export function cancelVerification(docId: string): void {
  const jobs = storage.getJobs(docId);

  jobs.forEach((job) => {
    if (job.status === 'pending') {
      storage.updateJobStatus(docId, job.paragraph.id, 'failed');
      storage.storeError(docId, job.paragraph.id, 'Cancelled by user');
    }
  });

  console.log(`[Verification] Cancelled pending jobs for ${docId}`);
}
