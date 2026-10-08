import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetMock } from './helpers';

// 성능(PRD §5.2): 할일 500건·댓글 2,000건. 뷰 전환 300ms, 필터 반영(디바운스 이후) 100ms 이하.
// "중급 모바일 + 4G"는 CPU 4배 감속 + 네트워크 지연으로 근사한다(실기기 측정이 아니다).
const SEARCH_DEBOUNCE_MS = 200;

// gate: true 면 목표 미달 시 테스트가 실패한다. CPU 감속 프로필은 실기기가 아닌 근사라서 실패시키지 않고 미달 항목을 기록한다.
type Profile = { name: string; cpuRate: number; network: boolean; gate: boolean };
const PROFILES: Profile[] = [
  { name: '개발 PC(감속 없음)', cpuRate: 1, network: false, gate: true },
  { name: '중급 모바일 근사(CPU 4배 + 4G)', cpuRate: 4, network: true, gate: false },
];

/** 클릭부터 대상 화면이 그려진 다음 프레임까지의 시간(ms) */
async function timeToView(page: Page, tabName: string, readySelector: string): Promise<number> {
  return page.evaluate(
    async ({ name, selector }) => {
      const tab = [...document.querySelectorAll<HTMLElement>('[role=tab]')].find(
        (t) => t.textContent?.trim() === name,
      );
      if (!tab) throw new Error(`탭 없음: ${name}`);
      const start = performance.now();
      tab.click();
      // 화면(지연 로딩 포함)이 나타날 때까지 기다린 뒤 다음 프레임까지
      while (!document.querySelector(selector)) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - start;
    },
    { name: tabName, selector: readySelector },
  );
}

for (const profile of PROFILES) {
  test(`성능 측정 — ${profile.name}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chrome', 'CDP 감속은 Chromium 계열에서만 쓴다');
    test.setTimeout(180_000);
    await resetMock('full');

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('team-calendar:user-name', '김하늘');
      } catch {
        // 무시
      }
      (window as unknown as { __lcp: number }).__lcp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          (window as unknown as { __lcp: number }).__lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
    if (profile.network) {
      // "Regular 4G" 프로필: 약 9Mbps, 지연 170ms
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 170,
        downloadThroughput: (9 * 1024 * 1024) / 8,
        uploadThroughput: (9 * 1024 * 1024) / 8,
      });
    }

    // 첫 화면: 카드가 그려질 때까지
    const started = Date.now();
    await page.goto('/?view=kanban');
    await expect(
      page.locator('section[aria-labelledby="column-todo"] [role=button]').first(),
    ).toBeVisible({
      timeout: 60_000,
    });
    const firstContent = Date.now() - started;
    await page.waitForTimeout(1000);
    const lcp = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);

    const cards = await page.locator('section[aria-labelledby^="column-"] [role=button]').count();
    expect(cards).toBe(500);

    // 뷰 전환: 처음(지연 로딩 chunk 포함)과 두 번째(캐시)를 나눠 잰다
    const first: Record<string, number> = {};
    const warm: Record<string, number> = {};
    const targets: [string, string][] = [
      ['리스트', '#panel-list table tbody tr'],
      ['캘린더', '#panel-calendar [role=grid]'],
      ['대시보드', '#panel-dashboard h3'],
      ['칸반', '#panel-kanban section[aria-labelledby="column-todo"] [role=button]'],
    ];
    for (const [tab, ready] of targets) first[tab] = await timeToView(page, tab, ready);
    for (const [tab, ready] of targets) warm[tab] = await timeToView(page, tab, ready);

    // 필터 반영: 리스트(500행)에서 체크박스 하나 / 검색어 입력(디바운스 200ms 제외)
    await page.getByRole('tab', { name: '리스트' }).click();
    await expect(page.locator('#panel-list table tbody tr').first()).toBeVisible();
    const filterCheckbox = await page.evaluate(async () => {
      const box = [
        ...document.querySelectorAll<HTMLInputElement>('aside input[type=checkbox]'),
      ].find((i) => i.labels?.[0]?.textContent === '진행 중');
      if (!box) throw new Error('체크박스 없음');
      const start = performance.now();
      box.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        ms: performance.now() - start,
        rows: document.querySelectorAll('#panel-list tbody tr').length,
      };
    });
    await page.getByRole('button', { name: '전체 초기화' }).first().click();
    await expect(page.locator('#panel-list table tbody tr')).toHaveCount(500);

    const search = await page.evaluate(async (debounce) => {
      const input = document.querySelector<HTMLInputElement>('#global-search');
      if (!input) throw new Error('검색창 없음');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const start = performance.now();
      setter?.call(input, '회의');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      while (document.querySelectorAll('#panel-list tbody tr').length === 500) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        total: performance.now() - start,
        rows: document.querySelectorAll('#panel-list tbody tr').length,
        debounce,
      };
    }, SEARCH_DEBOUNCE_MS);

    const report = {
      프로필: profile.name,
      '첫 화면(카드 표시, ms)': firstContent,
      'LCP(ms, 근사)': Math.round(lcp),
      '뷰 전환: 처음(ms)': Object.fromEntries(
        Object.entries(first).map(([k, v]) => [k, Math.round(v)]),
      ),
      '뷰 전환: 두 번째(ms)': Object.fromEntries(
        Object.entries(warm).map(([k, v]) => [k, Math.round(v)]),
      ),
      '필터(체크박스) 반영(ms)': Math.round(filterCheckbox.ms),
      '검색 반영: 입력~화면(ms)': Math.round(search.total),
      '검색 반영: 디바운스 제외(ms)': Math.round(search.total - SEARCH_DEBOUNCE_MS),
    };
    console.log(`\n[성능] ${JSON.stringify(report, null, 2)}`);
    await testInfo.attach('perf.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    expect(filterCheckbox.rows).toBeLessThan(500);
    expect(search.rows).toBeLessThan(500);

    // 요구사항: 뷰 전환 300ms 이하, 필터 반영(디바운스 이후) 100ms 이하, LCP 2.5초 이하
    // 목표를 못 맞춰도 숫자를 숨기지 않도록 모두 모아서 한 번에 판정한다.
    const failures: string[] = [];
    for (const [tab, ms] of Object.entries(warm)) {
      if (ms > 300) failures.push(`뷰 전환(${tab}, 두 번째) ${Math.round(ms)}ms > 300ms`);
    }
    if (filterCheckbox.ms > 100)
      failures.push(`필터 반영 ${Math.round(filterCheckbox.ms)}ms > 100ms`);
    if (search.total - SEARCH_DEBOUNCE_MS > 100) {
      failures.push(
        `검색 반영(디바운스 제외) ${Math.round(search.total - SEARCH_DEBOUNCE_MS)}ms > 100ms`,
      );
    }
    if (lcp > 2500) failures.push(`LCP ${Math.round(lcp)}ms > 2500ms`);
    if (profile.gate) {
      expect(failures, failures.join('\n')).toEqual([]);
    } else {
      for (const f of failures) testInfo.annotations.push({ type: '목표 미달', description: f });
      if (failures.length > 0) console.log(`[목표 미달 · 참고용] ${failures.join(' / ')}`);
    }

    await context.close();
  });
}
