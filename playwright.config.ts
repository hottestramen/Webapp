import { defineConfig, devices } from '@playwright/test';

// E2E·접근성·반응형·성능 테스트는 로컬 목 서버(scripts/mock-supabase.ts) 위에서 프로덕션 빌드를 실행한다.
// 포트는 일부러 기본값(54321, 5173)과 다르게 둔다.
const MOCK_PORT = 54377;
const APP_PORT = 4177;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// 이 PC 에 설치된 시스템 브라우저(Chrome)를 쓴다. Playwright 브라우저 다운로드(playwright install)는 하지 않는다.
// Firefox·WebKit 프로젝트는 설정만 해 두었고, 해당 브라우저가 설치된 환경(CI 등)에서 `--project=firefox` 로 실행한다.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'node scripts/mock-supabase.ts',
      env: { PORT: String(MOCK_PORT), MOCK_SEED: 'sample' },
      url: `${MOCK_URL}/__state`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // 목 서버 주소로 빌드한 결과를, 배포와 같은 보안 헤더(CSP)를 붙여 서빙한다
      command: `npm run build && npx vite preview --port ${APP_PORT} --strictPort`,
      env: { VITE_SUPABASE_URL: MOCK_URL, VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
