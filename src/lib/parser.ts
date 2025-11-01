import * as cheerio from 'cheerio';
import { ParsedContent, ReferenceLink } from '@/types/ingest';

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
