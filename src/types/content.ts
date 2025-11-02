export type ConfidenceLevel = "high" | "medium" | "low";

export interface SourceDigest {
  url: string;
  title: string;
  summary: string;
}

export interface ParagraphAnalysis {
  id: number;
  content: string;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  sources: string[];
  reasoning: string;
  isHeading?: boolean;
  headingLevel?: number;
  linkDigests?: SourceDigest[];
}

export interface AnalyzedContent {
  title: string;
  sourceUrl: string;
  paragraphs: ParagraphAnalysis[];
}
