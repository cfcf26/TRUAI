import { ScrapingBeeClient } from 'scrapingbee';

/**
 * ScrapingBee 클라이언트 인스턴스
 */
const client = new ScrapingBeeClient(process.env.SCRAPINGBEE_API_KEY || '');

/**
 * ScrapingBee를 사용하여 URL의 HTML을 가져옵니다.
 *
 * @param url - 크롤링할 URL
 * @param renderJs - JavaScript 렌더링 여부 (기본값: true, SPA 페이지 지원)
 * @returns HTML 문자열
 * @throws API 키가 설정되지 않았거나 크롤링 실패 시 에러
 */
export async function fetchHtml(url: string, renderJs = true): Promise<string> {
  // API 키 확인
  if (!process.env.SCRAPINGBEE_API_KEY) {
    throw new Error('SCRAPINGBEE_API_KEY is not set in environment variables');
  }

  try {
    const response = await client.get({
      url,
      params: {
        // JavaScript 렌더링 활성화 (React/Vue 등 SPA 지원)
        render_js: renderJs,
        // 프리미엄 프록시 사용 (더 안정적)
        premium_proxy: false,
        // 국가 설정 (선택사항)
        // country_code: 'us',
      },
    });

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch URL "${url}": ${error.message}`);
    }
    throw new Error(`Failed to fetch URL "${url}": Unknown error`);
  }
}

/**
 * HTML을 텍스트로 변환 (간단한 정제)
 *
 * @param html - HTML 문자열
 * @returns 텍스트만 추출된 문자열
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // script 태그 제거
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // style 태그 제거
    .replace(/<[^>]+>/g, ' ') // 모든 HTML 태그 제거
    .replace(/\s+/g, ' ') // 여러 공백을 하나로
    .trim();
}
