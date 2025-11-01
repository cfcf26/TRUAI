const fs = require('fs');
const path = require('path');

const tempDir = path.join(process.cwd(), 'temp');
fs.mkdirSync(tempDir, { recursive: true });
const outputPath = path.join(tempDir, 'gemini.html');

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
fs.writeFileSync(outputPath, chunks.join(''), 'utf-8');
console.log('Saved to', outputPath);
