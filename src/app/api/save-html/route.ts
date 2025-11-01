import { NextRequest, NextResponse } from 'next/server';
import { fetchHtml } from '@/lib/scraper';
import fs from 'fs/promises';
import path from 'path';

/**
 * POST /api/save-html
 *
 * HTML을 파일로 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`[SaveHTML] Fetching: ${body.url}`);
    const html = await fetchHtml(body.url);

    // 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `chatgpt-research-${timestamp}.html`;
    const tempDir = path.join(process.cwd(), 'temp');
    const filepath = path.join(tempDir, filename);

    // temp 디렉토리 생성
    await fs.mkdir(tempDir, { recursive: true });

    // HTML 저장
    await fs.writeFile(filepath, html, 'utf-8');

    console.log(`[SaveHTML] Saved to: ${filepath}`);

    return NextResponse.json({
      success: true,
      filepath,
      filename,
      size: html.length,
    });

  } catch (error) {
    console.error('[SaveHTML] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
