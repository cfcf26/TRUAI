/**
 * 문단 데이터 구조
 * ARCHITECTURE.md의 "문단 단위 데이터 구조" 참조
 */
export interface Paragraph {
  /** 문단 고유 ID */
  id: number;
  /** 문단 순서 */
  order: number;
  /** 문단 텍스트 내용 */
  text: string;
  /** 문단에 연결된 출처 링크들 */
  links: string[];
  /** 헤딩 여부 (헤딩은 검증에서 제외하고 UI에서 강조 표시) */
  isHeading?: boolean;
  /** 헤딩 레벨 (1-6, isHeading이 true일 때만) */
  headingLevel?: number;
}

/**
 * /api/ingest 응답 구조
 * Backend Logic 1 → UI, Backend Logic 2로 전달되는 데이터
 */
export interface IngestResponse {
  /** 문서 고유 ID */
  doc_id: string;
  /** 원본 URL */
  source_url: string;
  /** 파싱된 문단 리스트 */
  paragraphs: Paragraph[];
}

/**
 * /api/ingest 요청 구조
 */
export interface IngestRequest {
  /** 분석할 리서치 URL */
  url: string;
}

/**
 * HTML 파싱 결과 (내부 사용)
 */
export interface ParsedContent {
  /** 본문 영역 */
  mainContent: string;
  /** 출처/주석 영역 */
  references: string;
  /** 전체 HTML */
  rawHtml: string;
  /** ChatGPT Deep Research 공유 페이지 여부 */
  isDeepResearch?: boolean;
}

/**
 * 출처 링크 정보 (내부 사용)
 */
export interface ReferenceLink {
  /** 링크 URL */
  url: string;
  /** 주석 번호 (있을 경우) */
  refNumber?: number;
  /** 링크 텍스트 */
  text?: string;
}
