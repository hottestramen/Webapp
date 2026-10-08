import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCsp, SECURITY_HEADERS, SUPABASE_WILDCARD } from '../config/csp';

// 배포 설정 파일(Netlify·Vercel)의 보안 헤더가 config/csp.ts 와 어긋나지 않는지 확인한다(PRD §5.4).

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const expectedCsp = buildCsp(SUPABASE_WILDCARD);

describe('보안 헤더', () => {
  it("CSP: script-src 'self', connect-src 에 Supabase https/wss 만", () => {
    expect(expectedCsp).toContain("script-src 'self'");
    expect(expectedCsp).not.toMatch(/script-src[^;]*unsafe/);
    expect(expectedCsp).toContain('connect-src');
    expect(expectedCsp).toContain('https://*.supabase.co');
    expect(expectedCsp).toContain('wss://*.supabase.co');
    expect(expectedCsp).toContain("object-src 'none'");
    expect(expectedCsp).toContain("frame-ancestors 'none'");
  });

  it('netlify.toml: CSP·보안 헤더·SPA 리다이렉트', () => {
    const toml = read('netlify.toml');
    expect(toml).toContain(`Content-Security-Policy = "${expectedCsp}"`);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(toml).toContain(`${key} = "${value}"`);
    }
    expect(toml).toMatch(/from = "\/\*"\s+to = "\/index\.html"\s+status = 200/);
  });

  it('vercel.json: CSP·보안 헤더·SPA 리라이트', () => {
    const config = JSON.parse(read('vercel.json')) as {
      rewrites: { source: string; destination: string }[];
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const all = Object.fromEntries(
      (config.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [
        h.key,
        h.value,
      ]),
    );
    expect(all['Content-Security-Policy']).toBe(expectedCsp);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) expect(all[key]).toBe(value);
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });
});
