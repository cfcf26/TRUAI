import { NextRequest, NextResponse } from 'next/server';
import { fetchHtml } from '@/lib/scraper';
import { parseHtmlToParagraphs } from '@/lib/parser';
import { IngestRequest, IngestResponse } from '@/types/ingest';
import { startVerificationJob } from '@/lib/verification';

/**
 * POST /api/ingest
 *
 * 리서치 URL을 받아서 문단 단위로 파싱하여 반환합니다.
 * Backend Logic 1 (Ingest/Parse) 엔드포인트
 *
 * @param request - { url: string }
 * @returns IngestResponse - { doc_id, source_url, paragraphs[] }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱
    const body: IngestRequest = await request.json();

    if (!body.url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // 2. ScrapingBee로 HTML 크롤링
    console.log(`[Ingest] Fetching URL: ${body.url}`);
    const html = await fetchHtml(body.url);

    // 3. HTML 파싱 → Paragraph[] 변환
    console.log(`[Ingest] Parsing HTML...`);
    const paragraphs = parseHtmlToParagraphs(html);

    // 4. doc_id 생성 (타임스탬프 + 랜덤 문자열)
    const doc_id = generateDocId();

    // 5. 응답 구성
    const response: IngestResponse = {
      doc_id,
      source_url: body.url,
      paragraphs,
    };

    console.log(`[Ingest] Success: ${paragraphs.length} paragraphs extracted`);

    // Backend Logic 2: 검증 작업 시작 (백그라운드에서 비동기 실행)
    console.log(`[Ingest] Triggering verification job for ${doc_id}`);
    startVerificationJob(doc_id, paragraphs, 0); // 0ms delay - 즉시 시작

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Ingest] Error:', error);

    // 에러 타입에 따라 적절한 응답 반환
    if (error instanceof Error) {
      if (error.message.includes('SCRAPINGBEE_API_KEY')) {
        return NextResponse.json(
          { error: 'ScrapingBee API key not configured' },
          { status: 500 }
        );
      }

      if (error.message.includes('Failed to fetch URL')) {
        return NextResponse.json(
          { error: 'Failed to fetch the provided URL. Please check if the URL is accessible.' },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * doc_id 생성 함수
 * 형식: doc_YYYYMMDD_랜덤문자열
 * 예: doc_20251101_a3f9k2
 */
function generateDocId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const randomStr = Math.random().toString(36).substring(2, 8); // 랜덤 6자

  return `doc_${dateStr}_${randomStr}`;
}
