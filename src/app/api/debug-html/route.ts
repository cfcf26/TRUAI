import { NextRequest, NextResponse } from 'next/server';
import { fetchHtml } from '@/lib/scraper';
import * as cheerio from 'cheerio';

/**
 * POST /api/debug-html
 *
 * HTML 구조를 디버깅하기 위한 엔드포인트
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`[Debug] Fetching: ${body.url}`);
    const html = await fetchHtml(body.url);

    const $ = cheerio.load(html);

    // 기본 정보
    const info = {
      htmlLength: html.length,
      title: $('title').text(),

      // 주요 구조 태그 개수
      structure: {
        main: $('main').length,
        article: $('article').length,
        section: $('section').length,
        div: $('div').length,
        p: $('p').length,
        li: $('li').length,
      },

      // 링크 정보
      links: {
        total: $('a[href]').length,
        external: $('a[href^="http"]').length,
      },

      // 클래스와 ID 샘플
      sampleClasses: [] as string[],
      sampleIds: [] as string[],

      // 첫 번째 main/article의 구조
      mainContent: '',

      // 모든 a 태그 샘플 (처음 10개)
    sampleLinks: [] as Array<{ text: string; href: string; class: string }>,
      assistantMessageStructure: undefined as
        | {
            pTags: number;
            divTags: number;
            aTags: number;
            sampleParagraphs: string[];
          }
        | undefined,
    };

    // 샘플 클래스 수집 (처음 20개)
    $('[class]').slice(0, 20).each((_, el) => {
      const classes = $(el).attr('class');
      if (classes && !info.sampleClasses.includes(classes)) {
        info.sampleClasses.push(classes);
      }
    });

    // 샘플 ID 수집
    $('[id]').slice(0, 20).each((_, el) => {
      const id = $(el).attr('id');
      if (id && !info.sampleIds.includes(id)) {
        info.sampleIds.push(id);
      }
    });

    // main 또는 article의 첫 500자
    const mainEl = $('main, article').first();
    if (mainEl.length > 0) {
      info.mainContent = mainEl.text().trim().substring(0, 500);
    }

    // 링크 샘플
    $('a[href]').slice(0, 10).each((_, el) => {
      const $el = $(el);
      info.sampleLinks.push({
        text: $el.text().trim().substring(0, 100),
        href: $el.attr('href') || '',
        class: $el.attr('class') || '',
      });
    });

    // p 태그 내용 샘플
    const sampleParagraphs = [] as string[];
    $('p').slice(0, 15).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        sampleParagraphs.push(text.substring(0, 200));
      }
    });

    // div 구조 분석 - 특정 클래스를 가진 div들
    const contentDivs = [] as Array<{ class: string; textPreview: string }>;
    $('div[class*="flex"]').slice(0, 10).each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text.length > 50 && text.length < 500) {
        contentDivs.push({
          class: $el.attr('class') || '',
          textPreview: text.substring(0, 150),
        });
      }
    });

    // ChatGPT 딥리서치 구조 분석
    const chatgptStructure = {
      hasAssistantMessage: $('[data-message-author-role="assistant"]').length > 0,
      assistantMessageCount: $('[data-message-author-role="assistant"]').length,
      firstAssistantPreview: '',
    };

    if (chatgptStructure.hasAssistantMessage) {
      const firstMsg = $('[data-message-author-role="assistant"]').first();
      chatgptStructure.firstAssistantPreview = firstMsg.text().trim().substring(0, 500);

      // 어시스턴트 메시지 내부 구조
      const assistantMessageStructure = {
        pTags: firstMsg.find('p').length,
        divTags: firstMsg.find('div').length,
        aTags: firstMsg.find('a[href]').length,
        sampleParagraphs: [] as string[],
      };
      info['assistantMessageStructure'] = assistantMessageStructure;

      firstMsg.find('p').slice(0, 5).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          assistantMessageStructure.sampleParagraphs.push(text.substring(0, 150));
        }
      });
    }

    return NextResponse.json({
      ...info,
      sampleParagraphs,
      contentDivs,
      chatgptStructure,
    }, { status: 200 });

  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
