import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openAs, resetMock, waitForBoard } from './helpers';

// 다크 모드 토글: 스위치 동작·저장·시스템 설정 반영, 다크에서의 접근성(axe)
test.beforeEach(async () => {
  await resetMock('sample');
});

const html = (page: import('@playwright/test').Page) => page.locator('html');

test('토글을 켜면 다크, 끄면 라이트로 바뀌고 새로고침해도 유지된다', async ({ browser }) => {
  const page = await openAs(browser, '김하늘');
  await waitForBoard(page);
  const toggle = page.getByRole('switch', { name: '다크 모드' });

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
  const lightBg = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  const darkBg = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(darkBg).not.toBe(lightBg);

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: '다크 모드' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // 키보드(Space)로도 끌 수 있다
  await page.getByRole('switch', { name: '다크 모드' }).focus();
  await page.keyboard.press('Space');
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('저장된 선택이 없으면 OS 의 다크 모드 설정을 따른다', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await openAs(context, '김하늘');
  await waitForBoard(page);
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  await context.close();
});

test('다크 모드에서도 axe 위반이 없다 (4개 뷰·상세·설정)', async ({ browser }) => {
  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { width: 1280, height: 800 },
  });
  const page = await openAs(context, '김하늘');
  await waitForBoard(page);
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');

  const scan = async (label: string) => {
    await page.waitForTimeout(800);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = violations.map((v) => ({
      rule: v.id,
      sample: v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
    }));
    if (summary.length) console.log(`[axe dark] ${label}\n${JSON.stringify(summary, null, 2)}`);
    expect(summary, `${label}: axe 위반`).toEqual([]);
  };

  await scan('칸반');
  for (const tab of ['리스트', '캘린더', '대시보드']) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await scan(tab);
  }
  await page.getByRole('tab', { name: '칸반' }).click();
  await page.getByRole('button', { name: '+ 새 할일' }).click();
  await expect(page.getByRole('dialog', { name: '새 할일' })).toBeVisible();
  await scan('등록 폼');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  await scan('설정');

  await page.getByRole('button', { name: '← 돌아가기' }).click();
  await page.screenshot({ path: 'e2e/screenshots/dark-kanban.png', fullPage: true });
  await page.getByRole('tab', { name: '대시보드' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/dark-dashboard.png', fullPage: true });
  await context.close();
});
