import { fetchHtml } from '@/lib/scraper';
import fs from 'fs/promises';
import path from 'path';

async function saveHtml(url: string) {
  console.log('Fetching HTML from:', url);

  try {
    const html = await fetchHtml(url);

    // 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chatgpt-research-${timestamp}.html`;
    const filepath = path.join(process.cwd(), 'temp', filename);

    // temp 디렉토리 생성
    await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });

    // HTML 저장
    await fs.writeFile(filepath, html, 'utf-8');

    console.log('✓ HTML saved to:', filepath);
    console.log('✓ File size:', (html.length / 1024).toFixed(2), 'KB');

    // 샘플 출력
    console.log('\n--- First 1000 characters ---');
    console.log(html.substring(0, 1000));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const url = process.argv[2] || 'https://chatgpt.com/s/dr_6905b5b706c48191bec174b58f0858d9';
saveHtml(url);
