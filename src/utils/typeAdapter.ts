/**
 * Type adapter utilities to convert between backend types and UI types
 */

import { Paragraph, VerificationResult, Confidence } from '@/lib/types';
import { ParagraphAnalysis, ConfidenceLevel, AnalyzedContent } from '@/types/content';

/**
 * Convert backend confidence enum to UI confidence number (0-100)
 */
export function confidenceToNumber(confidence: Confidence): number {
  switch (confidence) {
    case 'high':
      return 90;
    case 'medium':
      return 65;
    case 'low':
      return 35;
  }
}

/**
 * Convert backend confidence enum to UI confidence level
 */
export function confidenceToLevel(confidence: Confidence): ConfidenceLevel {
  return confidence as ConfidenceLevel;
}

/**
 * Convert backend Paragraph to UI ParagraphAnalysis (without verification results)
 * This is used for initial display before verification completes
 */
export function paragraphToParagraphAnalysis(paragraph: Paragraph): ParagraphAnalysis {
  return {
    id: paragraph.id,
    content: paragraph.text,
    confidence: 0, // Not yet verified
    confidenceLevel: 'low',
    sources: paragraph.links,
    reasoning: '검증 중...', // "Verifying..."
  };
}

/**
 * Merge verification result into paragraph analysis
 * This updates the paragraph with verification results as they arrive
 */
export function mergeParagraphWithResult(
  paragraph: Paragraph,
  result: VerificationResult
): ParagraphAnalysis {
  return {
    id: paragraph.id,
    content: paragraph.text,
    confidence: confidenceToNumber(result.confidence),
    confidenceLevel: confidenceToLevel(result.confidence),
    sources: result.link_digests.map((digest) => digest.url),
    reasoning: result.reasoning,
  };
}

/**
 * Convert backend Document to UI AnalyzedContent
 * Creates initial UI state with paragraphs in "verifying" state
 */
export function documentToAnalyzedContent(
  sourceUrl: string,
  paragraphs: Paragraph[]
): AnalyzedContent {
  return {
    title: sourceUrl,
    paragraphs: paragraphs.map(paragraphToParagraphAnalysis),
  };
}

/**
 * Update a specific paragraph in AnalyzedContent with verification result
 */
export function updateParagraphWithResult(
  content: AnalyzedContent,
  paragraph: Paragraph,
  result: VerificationResult
): AnalyzedContent {
  return {
    ...content,
    paragraphs: content.paragraphs.map((p) =>
      p.id === result.paragraph_id
        ? mergeParagraphWithResult(paragraph, result)
        : p
    ),
  };
}
