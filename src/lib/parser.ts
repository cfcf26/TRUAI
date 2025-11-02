import * as cheerio from 'cheerio';
import { ParsedContent, ReferenceLink, Paragraph } from '@/types/ingest';

interface DeepResearchMessage {
  content?: {
    parts?: unknown[];
  };
  metadata?: {
    content_references?: DeepResearchReference[];
  };
}

interface DeepResearchReference {
  matched_text?: string;
  url?: string;
}

/**
 * HTML을 파싱하여 본문과 출처/주석 영역을 분리합니다.
 *
 * @param html - 파싱할 HTML 문자열
 * @returns 본문, 출처, 원본 HTML이 포함된 ParsedContent 객체
 */
export function parseHtml(html: string): ParsedContent {
  const $ = cheerio.load(html);

  // Script, style 태그 제거
  $('script, style, noscript').remove();

  // ChatGPT/Gemini 딥리서치 페이지 감지
  const isChatGPTDeepResearch = $('[data-message-author-role="assistant"]').length > 0;

  if (isChatGPTDeepResearch) {
    // ChatGPT 딥리서치 구조: data-message-author-role="assistant" 안의 콘텐츠
    const assistantMessage = $('[data-message-author-role="assistant"]').first();
    return {
      mainContent: assistantMessage.html() || '',
      references: '',
      rawHtml: html,
      isDeepResearch: true,
    };
  }

  // 일반 웹페이지 파싱 (기존 로직)
  // 출처/주석 영역 찾기 (여러 패턴 시도)
  let referencesSection = '';
  const referenceSelectors = [
    // "References", "출처", "Footnotes" 등의 섹션
    'section:has(h2:contains("References"))',
    'section:has(h2:contains("출처"))',
    'section:has(h2:contains("Footnotes"))',
    'section:has(h3:contains("References"))',
    'section:has(h3:contains("출처"))',
    'div:has(h2:contains("References"))',
    'div:has(h2:contains("출처"))',
    // id나 class로 찾기
    '#references',
    '#footnotes',
    '.references',
    '.footnotes',
    '[data-footnotes]',
  ];

  for (const selector of referenceSelectors) {
    const section = $(selector);
    if (section.length > 0) {
      referencesSection = section.html() || '';
      section.remove(); // 본문에서 제거
      break;
    }
  }

  // 본문 영역 찾기 (우선순위 순서)
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    'body', // 마지막 fallback
  ];

  let mainContent = '';
  for (const selector of mainSelectors) {
    const section = $(selector);
    if (section.length > 0) {
      mainContent = section.html() || '';
      break;
    }
  }

  return {
    mainContent,
    references: referencesSection,
    rawHtml: html,
    isDeepResearch: false,
  };
}

/**
 * 출처/주석 영역에서 링크들을 추출합니다.
 *
 * @param referencesHtml - 출처 영역 HTML
 * @returns ReferenceLink 배열
 */
export function extractReferenceLinks(referencesHtml: string): ReferenceLink[] {
  const $ = cheerio.load(referencesHtml);
  const links: ReferenceLink[] = [];

  // 모든 링크 찾기
  $('a[href]').each((_, element) => {
    const $el = $(element);
    const url = $el.attr('href');
    const text = $el.text().trim();

    if (!url) return;

    // 주석 번호 패턴 찾기: [1], [2], (1), (2), ¹, ², 등
    const refNumberMatch = text.match(/[\[\(]?(\d+)[\]\)]?|[¹²³⁴⁵⁶⁷⁸⁹⁰]+/);
    const refNumber = refNumberMatch ? parseInt(refNumberMatch[1] || text) : undefined;

    // 상대 경로를 절대 경로로 변환 (필요시)
    const absoluteUrl = url.startsWith('http') ? url : url;

    links.push({
      url: absoluteUrl,
      refNumber,
      text,
    });
  });

  return links;
}

/**
 * 텍스트에서 주석 번호를 찾습니다.
 * 예: "이것은 문장입니다[1]" → [1]
 *
 * @param text - 검사할 텍스트
 * @returns 찾은 주석 번호 배열
 */
export function findFootnoteNumbers(text: string): number[] {
  const numbers: number[] = [];

  // 패턴: [1], [2,3], (1), ¹, ², 등
  const patterns = [
    /\[(\d+(?:,\s*\d+)*)\]/g, // [1] or [1,2,3]
    /\((\d+)\)/g, // (1)
    /[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, // 위첨자 숫자
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        // [1,2,3] 형태 처리
        const nums = match[1].split(',').map((n) => parseInt(n.trim()));
        numbers.push(...nums);
      }
    }
  }

  return [...new Set(numbers)]; // 중복 제거
}

/**
 * HTML에서 직접 포함된 링크를 추출합니다.
 *
 * @param html - 검사할 HTML
 * @returns URL 배열
 */
export function extractInlineLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $('a[href]').each((_, element) => {
    const url = $(element).attr('href');
    if (url && url.startsWith('http')) {
      links.push(url);
    }
  });

  return [...new Set(links)]; // 중복 제거
}

/**
 * 문단 블록 인터페이스 (내부 사용)
 */
interface ParagraphBlock {
  html: string;
  text: string;
  isHeading?: boolean;
  headingLevel?: number;
}

/**
 * HTML을 문단 단위로 분할합니다.
 *
 * ARCHITECTURE.md 기준:
 * - <p>, <li>, <section> 등을 문단으로 인식
 * - 너무 짧으면 (100자 미만) 이전 문단에 병합
 * - 너무 길면 (800자 초과) 500~800자 기준으로 분할
 *
 * @param mainContentHtml - 본문 HTML
 * @returns ParagraphBlock 배열
 */
export function splitIntoParagraphs(mainContentHtml: string): ParagraphBlock[] {
  const $ = cheerio.load(mainContentHtml);
  const blocks: ParagraphBlock[] = [];

  // 헤딩과 문단을 모두 포함하여 DOM 순서대로 처리
  const contentSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote'];

  // DOM 순서를 유지하면서 각 요소 처리
  $(contentSelectors.join(', ')).each((_, element) => {
    const $el = $(element);
    const html = $.html($el);
    const text = $el.text().trim();

    if (text.length === 0) {
      return; // 빈 요소는 건너뛰기
    }

    // cheerio Element의 name 속성 사용 (tagName 대신)
    const tagName = 'name' in element ? (element.name as string).toLowerCase() : '';

    // 헤딩 태그인지 확인
    if (tagName.startsWith('h') && tagName.length === 2) {
      const headingLevel = parseInt(tagName.charAt(1)); // 'h1' -> 1, 'h2' -> 2, etc.
      blocks.push({
        html,
        text,
        isHeading: true,
        headingLevel
      });
    } else {
      // 일반 문단
      blocks.push({ html, text });
    }
  });

  // 문단이 없는 경우 (예: div만 있는 경우), div나 section 시도
  if (blocks.length === 0) {
    $('div, section').each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();

      // 너무 긴 div는 건너뛰기 (전체 컨테이너일 가능성)
      if (text.length > 0 && text.length < 2000) {
        const html = $.html($el);
        blocks.push({ html, text });
      }
    });
  }

  // 후처리: 너무 짧은 문단 병합, 너무 긴 문단 분할
  return postProcessParagraphs(blocks);
}

/**
 * 문단 블록을 후처리합니다.
 * - 100자 미만: 이전 문단에 병합
 * - 800자 초과: 500~800자 기준으로 분할
 *
 * @param blocks - 원본 문단 블록 배열
 * @returns 후처리된 문단 블록 배열
 */
function postProcessParagraphs(blocks: ParagraphBlock[]): ParagraphBlock[] {
  const MIN_LENGTH = 100;
  const MAX_LENGTH = 800;
  const SPLIT_TARGET = 600;

  const processed: ParagraphBlock[] = [];

  for (const block of blocks) {
    // 헤딩은 병합/분할 없이 그대로 유지
    if (block.isHeading) {
      processed.push(block);
      continue;
    }

    // 너무 짧은 문단: 이전 문단에 병합 (이전 문단도 헤딩이 아닐 때만)
    if (block.text.length < MIN_LENGTH && processed.length > 0) {
      const prev = processed[processed.length - 1];
      // 이전 블록이 헤딩이 아닐 때만 병합
      if (!prev.isHeading) {
        prev.text = prev.text + ' ' + block.text;
        prev.html = prev.html + ' ' + block.html;
        continue;
      }
    }

    // 너무 긴 문단: 분할
    if (block.text.length > MAX_LENGTH) {
      const splitBlocks = splitLongParagraph(block.text, SPLIT_TARGET);
      for (const text of splitBlocks) {
        processed.push({ html: text, text });
      }
      continue;
    }

    // 적절한 길이: 그대로 추가
    processed.push(block);
  }

  return processed;
}

/**
 * 긴 문단을 목표 길이 기준으로 분할합니다.
 * 문장 단위로 분할하여 자연스럽게 나눕니다.
 *
 * @param text - 분할할 텍스트
 * @param targetLength - 목표 길이 (기본 600자)
 * @returns 분할된 텍스트 배열
 */
function splitLongParagraph(text: string, targetLength = 600): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/); // 문장 단위로 분할
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > targetLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * 문단과 출처 링크를 매칭합니다.
 *
 * ARCHITECTURE.md 매칭 전략:
 * 1. 문단 HTML 내에 직접 링크가 있으면 우선 사용
 * 2. 문단 텍스트에 [1], [2] 같은 주석 번호가 있으면 references에서 해당 번호의 링크 찾기
 * 3. 둘 다 없으면 빈 배열 (또는 문서 전체 공통 출처)
 *
 * @param paragraphHtml - 문단 HTML
 * @param paragraphText - 문단 텍스트
 * @param referenceLinks - 출처 섹션에서 추출한 링크들
 * @returns 해당 문단의 출처 링크 배열
 */
export function matchParagraphLinks(
  paragraphHtml: string,
  paragraphText: string,
  referenceLinks: ReferenceLink[]
): string[] {
  const links: string[] = [];

  // 패턴 1: 문단 내 직접 링크
  const inlineLinks = extractInlineLinks(paragraphHtml);
  if (inlineLinks.length > 0) {
    links.push(...inlineLinks);
  }

  // 패턴 2: 주석 번호 → 출처 매칭
  const footnoteNumbers = findFootnoteNumbers(paragraphText);
  if (footnoteNumbers.length > 0) {
    for (const num of footnoteNumbers) {
      const refLink = referenceLinks.find((ref) => ref.refNumber === num);
      if (refLink && !links.includes(refLink.url)) {
        links.push(refLink.url);
      }
    }
  }

  // 패턴 3: 아무것도 없으면 빈 배열
  return links;
}

/**
 * ChatGPT Deep Research 공유 페이지에서 문단을 추출합니다.
 *
 * @param rawHtml - 원본 HTML 문자열
 * @returns Paragraph 배열
 */
function parseDeepResearchParagraphs(rawHtml: string): Paragraph[] {
  try {
    const flightPayload = extractDeepResearchFlightPayload(rawHtml);
    if (!flightPayload) {
      return [];
    }

    const root = resolveFlightPayload(flightPayload);
    const messages = findDeepResearchMessages(root);

    if (messages.length === 0) {
      return [];
    }

    const targetMessage = messages[0];
    const parts = Array.isArray(targetMessage.content?.parts)
      ? targetMessage.content.parts.filter((part: unknown): part is string => typeof part === 'string')
      : [];

    if (parts.length === 0) {
      return [];
    }

    const markdown = parts.join('\n\n');
    const references: DeepResearchReference[] = Array.isArray(targetMessage.metadata?.content_references)
      ? (targetMessage.metadata?.content_references as DeepResearchReference[])
      : [];
    const referenceMap = buildReferenceMap(references);
    const rawParagraphs = splitMarkdownIntoParagraphs(markdown);

    const paragraphs: Paragraph[] = [];
    let order = 1;

    for (const paragraphBlock of rawParagraphs) {
      const { text, links } = processDeepResearchParagraph(paragraphBlock.text, referenceMap);
      if (!text) {
        continue;
      }

      paragraphs.push({
        id: order,
        order,
        text,
        links,
        isHeading: paragraphBlock.isHeading,
        headingLevel: paragraphBlock.headingLevel,
      });
      order += 1;
    }

    return paragraphs;
  } catch (error) {
    console.warn('[parser] Failed to parse Deep Research payload:', error);
    return [];
  }
}

/**
 * Deep Research Flight Payload를 추출합니다.
 *
 * @param rawHtml - 원본 HTML
 */
function extractDeepResearchFlightPayload(rawHtml: string): unknown[] | null {
  const marker = 'window.__reactRouterContext.streamController.enqueue';
  const markerIndex = rawHtml.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const callStart = rawHtml.indexOf('(', markerIndex);
  if (callStart === -1) {
    return null;
  }

  const callEnd = rawHtml.indexOf(');', callStart);
  if (callEnd === -1) {
    return null;
  }

  const argumentSlice = rawHtml.slice(callStart + 1, callEnd);

  try {
    const firstParse = JSON.parse(argumentSlice);
    const secondParse = JSON.parse(firstParse);
    return Array.isArray(secondParse) ? secondParse : null;
  } catch (error) {
    console.warn('[parser] Unable to decode Deep Research flight payload:', error);
    return null;
  }
}

/**
 * Flight Payload를 재귀적으로 해석하여 실제 객체 구조를 복원합니다.
 *
 * @param payload - Flight Payload 배열
 */
function resolveFlightPayload(payload: unknown[]): unknown {
  const cache = new Map<number, unknown>();

  const resolveIndex = (index: number): unknown => {
    if (cache.has(index)) {
      return cache.get(index);
    }

    cache.set(index, null);
    const raw = payload[index];
    if (typeof raw === 'undefined') {
      return null;
    }
    const resolved = resolveValue(raw);
    cache.set(index, resolved);
    return resolved;
  };

  const resolveValue = (value: unknown): unknown => {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      if (value >= 0) {
        return resolveIndex(value);
      }
      // React Flight에서 사용하는 특별한 토큰
      if (value === -1) {
        return null;
      }
      if (value === -5) {
        return {};
      }
      if (value === -7) {
        return [];
      }
      return null;
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => resolveValue(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      let actualKey = key;
      if (key.startsWith('_')) {
        const keyIndex = Number(key.slice(1));
        const resolvedKey = resolveIndex(keyIndex);
        if (typeof resolvedKey === 'string') {
          actualKey = resolvedKey;
        }
      }
      result[actualKey] = resolveValue(nested);
    }

    return result;
  };

  return resolveIndex(0);
}

/**
 * Deep Research 메시지를 탐색합니다.
 *
 * @param root - 복원된 Flight 객체 루트
 */
function findDeepResearchMessages(root: unknown): DeepResearchMessage[] {
  const results: DeepResearchMessage[] = [];
  const visited = new WeakSet<object>();

  const traverse = (node: unknown): void => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (visited.has(node as object)) {
      return;
    }

    visited.add(node as object);

    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }

    const candidate = node as DeepResearchMessage;
    const hasContentParts = Array.isArray(candidate.content?.parts);
    const hasReferences = Array.isArray(candidate.metadata?.content_references);

    if (hasContentParts && hasReferences) {
      results.push(candidate);
    }

    Object.values(node as Record<string, unknown>).forEach(traverse);
  };

  traverse(root);
  return results;
}

/**
 * citations 배열을 빠르게 조회할 수 있도록 Map 형태로 변환합니다.
 *
 * @param references - Deep Research content_references
 */
function buildReferenceMap(references: DeepResearchReference[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const ref of references) {
    const matched = typeof ref?.matched_text === 'string' ? ref.matched_text.trim() : null;
    const url = typeof ref?.url === 'string' ? ref.url.trim() : null;

    if (!matched || !url) {
      continue;
    }

    if (!map.has(matched)) {
      map.set(matched, new Set<string>());
    }

    map.get(matched)!.add(url);
  }

  return map;
}

/**
 * 마크다운 문단 블록 (헤딩 정보 포함)
 */
interface MarkdownParagraphBlock {
  text: string;
  isHeading?: boolean;
  headingLevel?: number;
}

/**
 * 마크다운 본문을 문단 단위로 분리합니다.
 * 헤딩(#, ##, ### 등)을 감지하여 별도 표시합니다.
 *
 * @param markdown - 원본 마크다운 문자열
 */
function splitMarkdownIntoParagraphs(markdown: string): MarkdownParagraphBlock[] {
  const sections = markdown
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const paragraphs: MarkdownParagraphBlock[] = [];

  for (const section of sections) {
    const lines = section
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      continue;
    }

    // 헤딩 감지: # Heading, ## Heading, ### Heading 등
    const headingMatch = lines[0].match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && lines.length === 1) {
      const headingLevel = headingMatch[1].length; // # 개수 = 레벨
      const headingText = headingMatch[2].trim();
      paragraphs.push({
        text: headingText,
        isHeading: true,
        headingLevel,
      });
      continue;
    }

    const isList = lines.every((line) => /^([-*+]\s+|\d+\.\s+)/.test(line));
    if (isList) {
      lines.forEach((line) => {
        const normalized = line.replace(/^([-*+]\s+|\d+\.\s+)/, '').trim();
        if (normalized.length > 0) {
          paragraphs.push({ text: normalized });
        }
      });
    } else {
      paragraphs.push({ text: lines.join(' ') });
    }
  }

  return paragraphs;
}

/**
 * 마크다운 문단을 정제하고 링크를 매핑합니다.
 *
 * @param paragraph - 원본 문단
 * @param referenceMap - citation → url 매핑
 */
function processDeepResearchParagraph(
  paragraph: string,
  referenceMap: Map<string, Set<string>>
): { text: string; links: string[] } {
  const citationPattern = /【[^】]+】/g;
  const matches = paragraph.match(citationPattern) || [];
  const linkSet = new Set<string>();

  for (const match of matches) {
    const normalized = match.trim();
    const urls = referenceMap.get(normalized);
    if (!urls) {
      continue;
    }
    urls.forEach((url) => linkSet.add(url));
  }

  const withoutCitations = paragraph.replace(citationPattern, ' ').trim();
  const cleanedText = cleanMarkdown(withoutCitations);

  return {
    text: cleanedText,
    links: Array.from(linkSet),
  };
}

/**
 * 간단한 마크다운 포맷팅을 제거합니다.
 *
 * @param text - 정제할 텍스트
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // 이미지
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // 링크 텍스트만 남기기
    .replace(/`([^`]+)`/g, '$1') // 인라인 코드 제거
    .replace(/\*\*(.*?)\*\*/g, '$1') // 굵게
    .replace(/\*(.*?)\*/g, '$1') // 기울임
    .replace(/__(.*?)__/g, '$1') // 굵게(언더스코어)
    .replace(/_(.*?)_/g, '$1') // 기울임(언더스코어)
    .replace(/\*\*/g, '') // 남은 별표 제거
    .replace(/__/g, '') // 남은 언더스코어 제거
    .replace(/`/g, '') // 남은 백틱 제거
    .replace(/^>\s*/gm, '') // 인용부호
    .replace(/^#+\s*/gm, '') // 헤딩 기호 제거
    .replace(/\s+/g, ' ') // 공백 정리
    .replace(/\s+([,.!?;:])/g, '$1') // 문장부호 앞 공백 제거
    .trim();
}

/**
 * HTML 전체를 파싱하여 문단 배열을 생성합니다.
 * Backend Logic 1의 핵심 함수: HTML → Paragraph[] 변환
 *
 * @param html - 파싱할 HTML 문자열
 * @returns Paragraph 배열
 */
export function parseHtmlToParagraphs(html: string): Paragraph[] {
  // 1. HTML 파싱: 본문 vs 출처 분리
  const parsed = parseHtml(html);

  if (parsed.isDeepResearch) {
    const deepResearchParagraphs = parseDeepResearchParagraphs(parsed.rawHtml);
    if (deepResearchParagraphs.length > 0) {
      return deepResearchParagraphs;
    }
  }

  // 2. 출처 섹션에서 링크 추출
  const referenceLinks = extractReferenceLinks(parsed.references);

  // 3. 본문을 문단 단위로 분할
  const paragraphBlocks = splitIntoParagraphs(parsed.mainContent);

  // 4. 각 문단에 출처 링크 매칭
  const paragraphs: Paragraph[] = paragraphBlocks.map((block, index) => {
    const links = matchParagraphLinks(block.html, block.text, referenceLinks);

    return {
      id: index + 1,
      order: index + 1,
      text: block.text,
      links,
      isHeading: block.isHeading,
      headingLevel: block.headingLevel,
    };
  });

  return paragraphs;
}
