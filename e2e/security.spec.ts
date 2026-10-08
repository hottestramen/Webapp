import { expect, test } from '@playwright/test';
import { openAs, resetMock, waitForBoard } from './helpers';

test.beforeEach(async () => {
  await resetMock('sample');
});

const XSS_TITLE = '<script>window.__xss=1</script>';
const XSS_IMG = '<img src=x onerror="window.__xss=2">';

test('제목·설명·댓글의 HTML/스크립트는 텍스트로만 보이고 실행되지 않는다', async ({ browser }) => {
  const page = await openAs(browser, '김하늘');
  await waitForBoard(page);

  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });

  // 제목·설명에 스크립트와 위험한 링크를 넣어 등록
  await page.getByRole('button', { name: '+ 새 할일' }).click();
  const form = page.getByRole('dialog', { name: '새 할일' });
  await form.getByLabel('제목').fill(XSS_TITLE);
  await form
    .getByLabel('설명')
    .fill(
      `${XSS_IMG}\n안전한 링크 https://example.com/ok 와 javascript:window.__xss=3 와 data:text/html,hi`,
    );
  await form.getByRole('button', { name: '등록' }).click();

  // 카드에는 제목이 글자 그대로 보인다
  const card = page.getByRole('button', { name: XSS_TITLE });
  await expect(card).toBeVisible();

  // 상세: 설명도 글자 그대로, http/https 만 링크
  await card.click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText(XSS_IMG)).toBeVisible();

  const links = detail.locator('a');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', 'https://example.com/ok');
  await expect(links.first()).toHaveAttribute('rel', /noopener/);
  await expect(links.first()).toHaveAttribute('rel', /noreferrer/);
  await expect(links.first()).toHaveAttribute('target', '_blank');
  await expect(page.locator('a[href^="javascript:" i], a[href^="data:" i]')).toHaveCount(0);

  // 댓글에도 스크립트를 넣는다
  await detail.getByLabel(/댓글 쓰기/).fill('<script>window.__xss=4</script> <b>굵게</b>');
  await detail.getByRole('button', { name: '댓글 등록' }).click();
  await expect(detail.getByText('<script>window.__xss=4</script> <b>굵게</b>')).toBeVisible();
  await expect(detail.locator('b')).toHaveCount(0);

  // 새로고침해도(서버에서 다시 읽어도) 마찬가지
  await page.reload();
  await expect(page.getByRole('button', { name: XSS_TITLE })).toBeVisible();

  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
  ).toBeUndefined();
  expect(alerts).toEqual([]);
  // 페이지에 실제 <script> 요소가 사용자 입력으로 생기지 않았다
  expect(await page.locator('script:not([src])').count()).toBe(0);
});

test('사용자 이름 입력(이름 모달)에 넣은 HTML 도 텍스트로만 보인다', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  const modal = page.getByRole('dialog', { name: '이름을 입력하세요' });
  await modal.getByLabel(/이름/).first().fill('<i>해커</i>');
  await modal.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('button', { name: /현재 사용자 <i>해커<\/i>/ })).toBeVisible();
  expect(await page.locator('header i').count()).toBe(0);
  await context.close();
});

test('CSP: 모든 화면을 돌아다녀도 위반이 없고, 배포와 같은 보안 헤더가 붙는다', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
    try {
      localStorage.setItem('team-calendar:user-name', '김하늘');
    } catch {
      // 무시
    }
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain('connect-src');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');

  await waitForBoard(page);
  for (const name of ['리스트', '캘린더', '대시보드', '칸반']) {
    await page.getByRole('tab', { name }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  await page.getByRole('button', { name: '← 돌아가기' }).click();
  await page.getByRole('button', { name: '+ 새 할일' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations).toEqual([]);
  expect(consoleErrors.filter((e) => /content security policy|refused to/i.test(e))).toEqual([]);
  await context.close();
});

test('CSP 가 인라인 스크립트를 실제로 막는다 (정책이 동작하는지 확인)', async ({ browser }) => {
  const page = await openAs(browser, '김하늘');
  await waitForBoard(page);
  const ran = await page.evaluate(() => {
    const el = document.createElement('script');
    el.textContent = 'window.__inline = 1';
    document.head.append(el);
    return (window as unknown as { __inline?: number }).__inline === 1;
  });
  expect(ran).toBe(false);
});
