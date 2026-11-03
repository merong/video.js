// node bin/module-files.mjs <폴더> <시작 파일...>
// 시작 파일에서 상대 경로 import(정적·동적)와 CSS @import를 따라가 필요한 파일 목록을 한 줄에 하나씩 찍는다.
// 솔애드 라이트 패키지가 Video.js 배포 폴더에서 기본 스킨에 필요한 파일만 고를 때 쓴다.
import fs from 'node:fs';
import path from 'node:path';

const [dir, ...entries] = process.argv.slice(2);
const seen = new Set();

function walk(rel) {
  rel = path.normalize(rel);

  if (seen.has(rel)) return;

  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) throw new Error(`없는 파일: ${rel}`);

  seen.add(rel);

  const source = fs.readFileSync(file, 'utf8');
  const pattern = rel.endsWith('.css')
    ? /@import\s+(?:url\()?["']([^"']+)["']/g
    : /(?:from\s*|import\s*\(?\s*)["'`](\.{1,2}\/[^"'`$]+)["'`]/g;

  for (const match of source.matchAll(pattern)) walk(path.join(path.dirname(rel), match[1]));
}

entries.forEach(walk);
console.log([...seen].sort().join('\n'));
