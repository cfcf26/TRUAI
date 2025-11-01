// Type definitions based on ARCHITECTURE.md specifications

import { z } from 'zod';

// ============================================================================
// Paragraph Structure (Logic1 → UI, Logic1 → Logic2)
// ============================================================================

export const ParagraphSchema = z.object({
  id: z.number(),
  order: z.number(),
  text: z.string(),
  links: z.array(z.string().url()),
});

export const DocumentSchema = z.object({
  doc_id: z.string(),
  source_url: z.string().url(),
  paragraphs: z.array(ParagraphSchema),
});

export type Paragraph = z.infer<typeof ParagraphSchema>;
export type Document = z.infer<typeof DocumentSchema>;

// ============================================================================
// Verification Result Structure (Logic2 → UI)
// ============================================================================

export const LinkDigestSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  summary: z.string(),
});

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const VerificationResultSchema = z.object({
  doc_id: z.string(),
  paragraph_id: z.number(),
  confidence: ConfidenceSchema,
  summary_of_sources: z.string(),
  reasoning: z.string(),
  link_digests: z.array(LinkDigestSchema),
});

export type LinkDigest = z.infer<typeof LinkDigestSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// ============================================================================
// Internal Types for Verification Logic
// ============================================================================

export interface VerificationJob {
  doc_id: string;
  paragraph: Paragraph;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: VerificationResult;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SourceContent {
  url: string;
  title: string;
  content: string;
  credibility: 'academic' | 'official' | 'news' | 'blog' | 'unknown';
  error?: string;
}

export interface GPT5VerificationInput {
  paragraph_text: string;
  paragraph_links: string[];
  sources: SourceContent[];
}

export interface GPT5VerificationOutput {
  confidence: Confidence;
  summary_of_sources: string;
  reasoning: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface WSVerificationRequest {
  type: 'verify';
  doc_id: string;
  paragraphs: Paragraph[];
}

export interface WSVerificationUpdate {
  type: 'verification_update';
  result: VerificationResult;
}

export interface WSVerificationComplete {
  type: 'verification_complete';
  doc_id: string;
}

export interface WSVerificationError {
  type: 'verification_error';
  doc_id: string;
  paragraph_id: number;
  error: string;
}

export type WSServerMessage =
  | WSVerificationUpdate
  | WSVerificationComplete
  | WSVerificationError;

export type WSClientMessage = WSVerificationRequest;

// ============================================================================
// Storage Types
// ============================================================================

export interface VerificationStorage {
  jobs: Map<string, VerificationJob[]>; // doc_id -> jobs
  results: Map<string, VerificationResult[]>; // doc_id -> results
}
