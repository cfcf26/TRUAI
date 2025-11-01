import * as cheerio from 'cheerio';
import { ParsedContent, ReferenceLink, Paragraph } from '@/types/ingest';

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

  // 문단으로 간주할 요소들
  const paragraphSelectors = ['p', 'li', 'blockquote'];

  // 각 요소를 순회하며 문단 블록 생성
  $(paragraphSelectors.join(', ')).each((_, element) => {
    const $el = $(element);
    const html = $.html($el);
    const text = $el.text().trim();

    if (text.length > 0) {
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
    // 너무 짧은 문단: 이전 문단에 병합
    if (block.text.length < MIN_LENGTH && processed.length > 0) {
      const prev = processed[processed.length - 1];
      prev.text = prev.text + ' ' + block.text;
      prev.html = prev.html + ' ' + block.html;
      continue;
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
 * HTML 전체를 파싱하여 문단 배열을 생성합니다.
 * Backend Logic 1의 핵심 함수: HTML → Paragraph[] 변환
 *
 * @param html - 파싱할 HTML 문자열
 * @returns Paragraph 배열
 */
export function parseHtmlToParagraphs(html: string): Paragraph[] {
  // 1. HTML 파싱: 본문 vs 출처 분리
  const { mainContent, references } = parseHtml(html);

  // 2. 출처 섹션에서 링크 추출
  const referenceLinks = extractReferenceLinks(references);

  // 3. 본문을 문단 단위로 분할
  const paragraphBlocks = splitIntoParagraphs(mainContent);

  // 4. 각 문단에 출처 링크 매칭
  const paragraphs: Paragraph[] = paragraphBlocks.map((block, index) => {
    const links = matchParagraphLinks(block.html, block.text, referenceLinks);

    return {
      id: index + 1,
      order: index + 1,
      text: block.text,
      links,
    };
  });

  return paragraphs;
}
