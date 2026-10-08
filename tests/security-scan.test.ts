import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// 보안 점검(PRD §5.4): 위험한 API 사용이 없는지, 비밀 키가 저장소에 없는지, .env 가 무시되는지 확인한다.

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const sourceFiles = files.filter((f) => /\.(ts|tsx|js|mjs|html|css|json|toml|sql)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(root, f).replaceAll('\\', '/');

/** 패턴이 나온 파일 목록(이 테스트 파일 자신과 package-lock 은 제외) */
function find(pattern: RegExp, scope: string[] = sourceFiles): string[] {
  return scope
    .filter(
      (f) => !rel(f).startsWith('tests/security-scan') && !rel(f).endsWith('package-lock.json'),
    )
    .filter((f) => pattern.test(read(f)))
    .map(rel);
}

describe('위험한 API 를 쓰지 않는다 (src, scripts, e2e)', () => {
  const app = sourceFiles.filter((f) => /^(src|scripts)\//.test(rel(f)));

  it('innerHTML / outerHTML / insertAdjacentHTML', () => {
    expect(find(/\b(innerHTML|outerHTML|insertAdjacentHTML)\b/, app)).toEqual([]);
  });

  it('dangerouslySetInnerHTML', () => {
    expect(find(/dangerouslySetInnerHTML/, app)).toEqual([]);
  });

  it('eval / new Function / document.write', () => {
    expect(find(/\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/, app)).toEqual([]);
  });

  it('javascript: 링크', () => {
    expect(find(/href=\{?["'`]javascript:/i, app)).toEqual([]);
  });
});

describe('비밀 키가 저장소에 없다', () => {
  it('service_role 키를 값으로 쓰지 않는다', () => {
    expect(find(/service_role\s*[:=]|SERVICE_ROLE_KEY|SUPABASE_SERVICE/i)).toEqual([]);
  });

  it('JWT 형태의 키(eyJ...)가 코드·설정에 없다', () => {
    expect(find(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./)).toEqual([]);
  });

  it('.env 는 .gitignore 에 있고 .env.example 만 남긴다', () => {
    const ignore = read(join(root, '.gitignore'));
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
    expect(existsSync(join(root, '.env.example'))).toBe(true);
  });

  it('git 으로 추적되는 .env 파일이 없다', () => {
    let tracked: string;
    try {
      tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
    } catch {
      return; // git 저장소가 아니면 건너뛴다
    }
    expect(
      tracked.split('\n').filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example')),
    ).toEqual([]);
  });
});

describe('컴포넌트는 supabase 를 직접 호출하지 않는다', () => {
  it('src/components, src/features, src/app 에서 supabase 클라이언트 import 없음', () => {
    const ui = sourceFiles.filter((f) => /^src\/(components|features|app)\//.test(rel(f)));
    expect(find(/from ['"][^'"]*\/lib\/supabase['"]|@supabase\/supabase-js/, ui)).toEqual([]);
  });
});
