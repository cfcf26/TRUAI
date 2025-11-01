/**
 * HTML 구조 확인용 테스트 스크립트
 */
import { fetchHtml } from '../lib/scraper';
import * as fs from 'fs';

async function testHtml() {
  const url = 'https://chatgpt.com/s/dr_6905b25c66488191a634c2fc62a916d0';

  console.log('Fetching HTML...');
  const html = await fetchHtml(url);

  // HTML 파일로 저장
  fs.writeFileSync('/tmp/chatgpt.html', html);
  console.log('Saved to /tmp/chatgpt.html');

  // 링크 개수 확인
  const linkMatches = html.match(/<a\s+[^>]*href=/gi);
  console.log(`Found ${linkMatches?.length || 0} <a> tags`);

  // 샘플 링크 출력
  const firstLinks = html.match(/<a\s+[^>]*href="[^"]*"[^>]*>[^<]*<\/a>/gi);
  console.log('\nFirst 5 links:');
  firstLinks?.slice(0, 5).forEach((link, i) => {
    console.log(`${i + 1}. ${link}`);
  });
}

testHtml().catch(console.error);
