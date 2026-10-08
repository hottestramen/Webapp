import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { buildCsp, connectSources, SECURITY_HEADERS } from './config/csp.ts';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // `npm run build:html`: JS·CSS 를 index.html 하나에 합친 단일 파일 빌드(서버 없이 열 수 있다)
  const singleFile = mode === 'html';

  return {
    plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        // 웹폰트(Pretendard)는 파일이 수십 개라 단일 HTML 에는 넣지 않는다
        'app-fonts': src(singleFile ? 'styles/fonts.empty.css' : 'styles/fonts.css'),
      },
    },
    build: singleFile ? { outDir: 'dist-html', cssCodeSplit: false } : {},
    // 빌드 결과를 미리 볼 때(vite preview)도 배포와 같은 보안 헤더를 붙여 CSP 위반을 확인할 수 있게 한다
    preview: {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Security-Policy': buildCsp(connectSources(env.VITE_SUPABASE_URL)),
      },
    },
    test: {
      environment: 'node',
      // Playwright 테스트(e2e/)는 vitest 가 아니라 playwright 가 실행한다
      exclude: ['node_modules', 'dist', 'dist-html', 'e2e/**'],
    },
  };
});
