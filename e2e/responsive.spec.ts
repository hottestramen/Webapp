import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { firstTodoTask, openAs, resetMock, waitForBoard } from './helpers';

// 반응형(PRD §5.1): 375 / 768 / 1024 / 1440 에서 4개 뷰·모달·필터를 확인하고 스크린샷을 남긴다.
// 스크린샷은 e2e/screenshots/ 에 저장된다(저장소에는 올리지 않는다).
const SIZES = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'wide-1440', width: 1440, height: 900 },
] as const;
const VIEWS = ['kanban', 'list', 'calendar', 'dashboard'] as const;
const SHOTS = 'e2e/screenshots';

test.beforeEach(async () => {
  await resetMock('sample');
});

async function settle(page: Page) {
  await page.waitForTimeout(900); // 지연 로딩·숫자 애니메이션이 끝나길 기다린다
}

/** 페이지 전체에 가로 스크롤이 생기는지(내부 스크롤 영역은 제외) */
async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > document.documentElement.clientWidth + 1;
      })
      .filter((el) => {
        // 가로 스크롤 컨테이너 안의 요소는 제외한다(태블릿 칸반 등)
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return false;
        }
        return getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${(el.getAttribute('class') ?? '').slice(0, 60)}`),
  }));
}

for (const size of SIZES) {
  test.describe(`${size.name}`, () => {
    for (const view of VIEWS) {
      test(`${view} 뷰: 레이아웃이 깨지지 않는다`, async ({ browser }) => {
        const page = await openAs(browser, '김하늘', `/?view=${view}`, size);
        await waitForBoard(page).catch(() => undefined);
        await settle(page);

        const overflow = await pageOverflow(page);
        expect(
          overflow.scrollWidth,
          `가로 스크롤 발생: ${overflow.offenders.join(' | ')}`,
        ).toBeLessThanOrEqual(overflow.clientWidth);
        await page.screenshot({ path: `${SHOTS}/${size.name}-${view}.png`, fullPage: true });
      });
    }

    test('뷰 전환 탭: 모바일은 하단 고정 탭바, 그 외는 상단 탭', async ({ browser }) => {
      const page = await openAs(browser, '김하늘', '/', size);
      await waitForBoard(page);
      const bar = page.getByRole('tablist', { name: '보기 전환' });
      const box = await bar.boundingBox();
      if (!box) throw new Error('탭바를 찾을 수 없습니다');
      if (size.width < 768) {
        expect(Math.round(box.y + box.height)).toBe(size.height); // 화면 맨 아래에 붙는다
        expect(box.width).toBe(size.width);
      } else {
        expect(box.y).toBeLessThan(size.height / 3); // 상단
      }
    });

    test('칸반: 모바일 상태 탭 / 태블릿 가로 스크롤 / 데스크탑 3열', async ({ browser }) => {
      const page = await openAs(browser, '김하늘', '/?view=kanban', size);
      await waitForBoard(page);
      const columns = page.locator('section[aria-labelledby^="column-"]');
      const visible = await columns.evaluateAll(
        (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
      );

      if (size.width < 768) {
        expect(visible).toBe(1);
        const tabs = page.getByRole('tablist', { name: '상태 열' });
        await expect(tabs).toBeVisible();
        // 상태 탭으로 열을 바꾼다
        await tabs.getByRole('tab', { name: /진행 중/ }).click();
        await expect(page.locator('section[aria-labelledby="column-in-progress"]')).toBeVisible();
        await expect(page.locator('section[aria-labelledby="column-todo"]')).toBeHidden();
        await page.screenshot({ path: `${SHOTS}/${size.name}-kanban-in-progress-tab.png` });
      } else {
        expect(visible).toBe(3);
        await expect(page.getByRole('tablist', { name: '상태 열' })).toBeHidden();
        const scrollable = await columns.first().evaluate((el) => {
          const parent = el.parentElement as HTMLElement;
          return parent.scrollWidth > parent.clientWidth + 1;
        });
        // 태블릿(768~)에서도 3열이 한 화면에 들어온다(열 최소 폭을 줄였으므로 가로 스크롤 없음)
        expect(scrollable).toBe(false);
      }
    });

    test('모달: 등록 폼·상세가 화면 안에 맞고 스크린샷을 남긴다', async ({ browser }) => {
      const page = await openAs(browser, '김하늘', '/', size);
      await waitForBoard(page);

      await page.getByRole('button', { name: '+ 새 할일' }).click();
      const form = page.getByRole('dialog', { name: '새 할일' });
      await expect(form).toBeVisible();
      await page.waitForTimeout(400);
      const formBox = await form.boundingBox();
      expect(formBox?.x).toBeGreaterThanOrEqual(0);
      expect((formBox?.x ?? 0) + (formBox?.width ?? 0)).toBeLessThanOrEqual(size.width + 1);
      if (size.width < 768) {
        // 모바일은 전체 화면 시트
        expect(formBox?.width).toBe(size.width);
        expect(formBox?.height).toBeGreaterThanOrEqual(size.height - 1);
      }
      await page.screenshot({ path: `${SHOTS}/${size.name}-modal-form.png` });
      await page.keyboard.press('Escape');

      const { title } = await firstTodoTask();
      await page.getByRole('button', { name: title }).click();
      const detail = page.getByRole('dialog', { name: title });
      await expect(detail).toBeVisible();
      await page.waitForTimeout(400);
      const box = await detail.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(size.width + 1);
      if (size.width >= 1440) {
        // 와이드: 우측 패널로 열린다
        expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(size.width);
        expect(box?.height).toBeGreaterThanOrEqual(size.height - 1);
      }
      await page.screenshot({ path: `${SHOTS}/${size.name}-modal-detail.png` });
    });

    test('필터: 모바일 바텀시트 / 태블릿 접이식 패널 / 데스크탑 사이드바', async ({ browser }) => {
      const page = await openAs(browser, '김하늘', '/', size);
      await waitForBoard(page);

      if (size.width < 768) {
        await page.getByRole('button', { name: /^필터/ }).click();
        const sheet = page.getByRole('dialog', { name: '필터' });
        await expect(sheet).toBeVisible();
        await page.waitForTimeout(400);
        const box = await sheet.boundingBox();
        expect(box?.width).toBe(size.width);
        expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(size.height); // 아래에 붙는다
        await page.screenshot({ path: `${SHOTS}/${size.name}-filter-sheet.png` });
      } else if (size.width < 1024) {
        const toggle = page.getByRole('button', { name: /^필터/ }).filter({ visible: true });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(
          page.getByRole('checkbox', { name: '내 할일만' }).filter({ visible: true }),
        ).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/${size.name}-filter-panel.png` });
      } else {
        await expect(page.getByRole('complementary')).toBeVisible();
        await expect(page.getByRole('button', { name: /^필터/ })).toHaveCount(0);
      }
    });
  });
}

test('터치 대상: 375px 에서 버튼·입력·탭이 최소 44×44px', async ({ browser }) => {
  const page = await openAs(browser, '김하늘', '/?view=kanban', { width: 375, height: 812 });
  await waitForBoard(page);

  const audit = () =>
    page.evaluate(() => {
      const MIN = 44;
      const sel =
        'button, select, textarea, summary, [role=tab], [role=gridcell], input:not([type=hidden]):not([type=checkbox]):not([type=radio])';
      return [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (el.closest('[aria-hidden="true"]') || el.closest('.sr-only')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < MIN - 0.5 || r.height < MIN - 0.5)
        .map(
          ({ el, r }) =>
            `${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? ''}] ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    });

  const offenders: string[] = [];
  const collect = async (label: string) => {
    for (const o of await audit()) offenders.push(`${label}: ${o}`);
  };

  await collect('칸반');
  for (const [tab, label] of [
    ['리스트', '리스트'],
    ['캘린더', '캘린더'],
    ['대시보드', '대시보드'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await settle(page);
    await collect(label);
  }
  await page.getByRole('tab', { name: '칸반' }).click();

  await page.getByRole('button', { name: /^필터/ }).click();
  await page.waitForTimeout(400);
  await collect('필터 시트');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '+ 새 할일' }).click();
  await page.waitForTimeout(400);
  await collect('등록 폼');
  await page.keyboard.press('Escape');

  const { title } = await firstTodoTask();
  await page.getByRole('button', { name: title }).click();
  await page.waitForTimeout(400);
  await collect('상세');

  expect(offenders, `44×44px 미만 터치 대상:\n${offenders.join('\n')}`).toEqual([]);
});
