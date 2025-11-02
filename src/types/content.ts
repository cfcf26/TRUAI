export type ConfidenceLevel = "high" | "medium" | "low";

export interface ParagraphAnalysis {
  id: number;
  content: string;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  sources: string[];
  reasoning: string;
  isHeading?: boolean;
  headingLevel?: number;
}

export interface AnalyzedContent {
  title: string;
  sourceUrl: string;
  paragraphs: ParagraphAnalysis[];
}
