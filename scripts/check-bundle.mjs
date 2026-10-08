// 빌드 결과(dist)의 "초기 JS" gzip 크기를 계산한다(PRD §5.2: 200KB 이하).
// 초기 JS = index.html 이 바로 불러오는 script + modulepreload 로 함께 받는 chunk. 지연 로딩 chunk 는 제외한다.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT_KB = 200;
const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');

const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]),
);
if (initial.size === 0) {
  console.error(
    'dist/index.html 에서 초기 JS 를 찾지 못했습니다. 먼저 npm run build 를 실행하세요.',
  );
  process.exit(2);
}

const gzipKb = (file) => gzipSync(readFileSync(new URL(file, dist))).length / 1024;
const rows = [...initial].map((file) => ({ file, kb: gzipKb(file) }));
const total = rows.reduce((sum, r) => sum + r.kb, 0);

const lazy = readdirSync(join(dist.pathname.replace(/^\//, ''), 'assets'))
  .filter((f) => f.endsWith('.js') && !initial.has(`assets/${f}`))
  .map((f) => ({ file: `assets/${f}`, kb: gzipKb(`assets/${f}`) }));

console.log('초기 JS (gzip)');
for (const r of rows) console.log(`  ${r.kb.toFixed(1).padStart(7)} KB  ${r.file}`);
console.log(`  ${total.toFixed(1).padStart(7)} KB  합계 (기준 ${LIMIT_KB} KB 이하)`);
console.log('지연 로딩 JS (gzip)');
for (const r of lazy) console.log(`  ${r.kb.toFixed(1).padStart(7)} KB  ${r.file}`);

if (total > LIMIT_KB) {
  console.error(`\n초기 JS 가 ${LIMIT_KB} KB 를 넘습니다.`);
  process.exit(1);
}
