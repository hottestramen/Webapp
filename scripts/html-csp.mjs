// 단일 HTML(dist-html/index.html)을 웹 서버에 올릴 때 쓸 CSP 를 만든다.
// 이 파일은 스크립트가 HTML 안에 들어 있어서 script-src 'self' 로는 실행되지 않는다.
// 'unsafe-inline' 대신 인라인 스크립트의 sha256 해시를 허용한다(내용이 바뀌면 해시도 바뀌므로 빌드할 때마다 다시 만든다).
// 서버 없이 파일로 열 때(file://)는 헤더가 없으므로 이 설정이 필요 없다.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist-html/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const hashes = scripts
  .filter((body) => body && body.trim())
  .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const connect = supabaseUrl
  ? (() => {
      const u = new URL(supabaseUrl);
      return `${u.origin} ${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
    })()
  : 'https://*.supabase.co wss://*.supabase.co';

const csp = [
  `default-src 'self'`,
  `script-src ${hashes.join(' ')}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src 'self' ${connect}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

console.log('\n웹 서버에 올릴 때의 Content-Security-Policy 헤더 값:\n');
console.log(csp);
console.log('\n(파일로 직접 열어 쓸 때는 필요 없습니다.)');
