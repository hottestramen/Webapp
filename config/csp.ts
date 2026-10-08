// Content-Security-Policy (PRD §5.4): script-src 'self' 와 Supabase 도메인만 허용한다.
// netlify.toml · vercel.json 의 값은 buildCsp(SUPABASE_WILDCARD) 와 같아야 하고, tests/deploy-config.test.ts 가 이를 확인한다.

/** 프로젝트 주소를 모를 때(배포 설정 파일) 쓰는 와일드카드. 배포 후 프로젝트 주소로 좁히는 것을 권장한다. */
export const SUPABASE_WILDCARD = ['https://*.supabase.co', 'wss://*.supabase.co'];

/** VITE_SUPABASE_URL 에서 연결 허용 목록(https/http + wss/ws)을 만든다. 없으면 와일드카드. */
export function connectSources(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return SUPABASE_WILDCARD;
  const url = new URL(supabaseUrl);
  const ws = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return [url.origin, `${ws}//${url.host}`];
}

export function buildCsp(connect: readonly string[]): string {
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    // React 의 style 속성(막대 너비 등)과 dnd-kit 의 인라인 스타일 때문에 style 만 'unsafe-inline' 을 허용한다
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self' ${connect.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

/** CSP 외의 보안 헤더 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};
