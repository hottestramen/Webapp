import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { firstTask, openAs, resetMock, waitForBoard } from './helpers';

// 접근성(PRD §5.3): axe(WCAG 2.1 A/AA)로 4개 뷰·등록 폼·상세·설정을 검사하고, 키보드만으로 핵심 흐름을 끝까지 수행한다.
test.beforeEach(async () => {
  await resetMock('sample');
});

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, label: string) {
  // 모달 열림·숫자 카운트 애니메이션이 끝난 뒤의 색으로 검사한다(진행 중에는 투명도 때문에 대비가 달라진다)
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    count: v.nodes.length,
    help: v.help,
    sample: v.nodes
      .slice(0, 3)
      .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
  }));
  if (summary.length > 0) console.log(`[axe] ${label}\n${JSON.stringify(summary, null, 2)}`);
  expect(summary, `${label}: axe 위반`).toEqual([]);
}

test.describe('axe 검사', () => {
  for (const [viewport, size] of [
    ['데스크탑', { width: 1280, height: 800 }],
    ['모바일', { width: 375, height: 812 }],
  ] as const) {
    test(`4개 뷰 (${viewport})`, async ({ browser }) => {
      const page = await openAs(browser, '김하늘', '/', size);
      await waitForBoard(page);
      await scan(page, `${viewport} 칸반`);

      for (const tab of ['리스트', '캘린더', '대시보드']) {
        await page.getByRole('tab', { name: tab }).click();
        await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
        await scan(page, `${viewport} ${tab}`);
      }
    });
  }

  test('등록 폼·상세(보기/수정)·충돌 확인창·필터 시트', async ({ browser }) => {
    const page = await openAs(browser, '김하늘', '/', { width: 1280, height: 800 });
    await waitForBoard(page);

    await page.getByRole('button', { name: '+ 새 할일' }).click();
    await expect(page.getByRole('dialog', { name: '새 할일' })).toBeVisible();
    await scan(page, '등록 폼');
    // 검증 오류 상태(aria-describedby 로 연결된 메시지)
    await page.getByRole('dialog').getByRole('button', { name: '등록' }).click();
    await expect(page.getByText('제목을 입력하세요.')).toBeVisible();
    await scan(page, '등록 폼(오류 상태)');
    await page.keyboard.press('Escape');

    const { title } = await firstTask();
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await scan(page, '상세(보기)');
    await page.getByRole('dialog').getByRole('button', { name: '수정' }).click();
    await scan(page, '상세(수정)');
    await page.keyboard.press('Escape');

    const mobile = await openAs(browser, '김하늘', '/', { width: 375, height: 812 });
    await waitForBoard(mobile);
    await mobile.getByRole('button', { name: /^필터/ }).click();
    await expect(mobile.getByRole('dialog', { name: '필터' })).toBeVisible();
    await scan(mobile, '필터 바텀시트(모바일)');
  });

  test('설정 화면', async ({ browser }) => {
    const page = await openAs(browser, '김하늘', '/', { width: 1280, height: 800 });
    await waitForBoard(page);
    await page.getByRole('button', { name: '설정' }).click();
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
    await scan(page, '설정');
  });
});

test('키보드만으로 등록 → 상태 변경 → 댓글 → 삭제 → 실행 취소', async ({ browser }) => {
  const page = await openAs(browser, '김하늘', '/', { width: 1280, height: 800 });
  await waitForBoard(page);
  const title = '키보드 전용 흐름';
  const card = page.getByRole('button', { name: title });
  const newTask = page.getByRole('button', { name: '+ 새 할일' });

  // 등록: 버튼에 포커스 → Enter → 제목 입력 → Enter(폼 제출)
  await newTask.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '새 할일' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '새 할일' }).getByLabel('제목')).toBeFocused(); // 모달 안으로 포커스가 들어온다
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(card).toBeVisible();
  await expect(newTask).toBeFocused(); // 닫으면 연 버튼으로 포커스가 돌아온다

  // 저장이 끝난 카드부터 드래그·열기가 가능하다(저장 중에는 aria-busy)
  await expect(card).not.toHaveAttribute('aria-busy', 'true');

  // 상태 변경: 카드에서 Space → 방향키로 열 이동 → Space (드래그)
  await card.focus();
  // 사람이 누르는 속도로 한 키씩(드래그가 시작되고 열 위치가 측정된 뒤에 방향키가 들어간다)
  for (const key of ['Space', 'ArrowRight', 'Space']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
  }
  await expect(
    page
      .locator('section[aria-labelledby="column-in-progress"]')
      .getByRole('button', { name: title }),
  ).toBeVisible();

  // 상세 열기: Enter. Esc 로 닫으면 카드로 포커스가 돌아온다
  await page.waitForTimeout(500); // 드롭 애니메이션이 끝난 뒤
  await card.focus();
  await page.keyboard.press('Enter');
  const detail = page.getByRole('dialog', { name: title });
  await expect(detail).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(card).toBeFocused();

  // 댓글: 상세를 다시 열고 입력 → Tab → Enter
  await page.keyboard.press('Enter');
  await detail.getByLabel(/댓글 쓰기/).focus();
  await page.keyboard.type('키보드로 쓴 댓글');
  await page.keyboard.press('Tab');
  await expect(detail.getByRole('button', { name: '댓글 등록' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(detail.getByRole('listitem').filter({ hasText: '키보드로 쓴 댓글' })).toBeVisible();

  // 삭제: 삭제 버튼 → Enter(확인창 수락) → 실행 취소 → Enter
  page.once('dialog', (d) => void d.accept());
  await detail.getByRole('button', { name: '삭제', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: '실행 취소' }).focus();
  await page.keyboard.press('Enter');
  await expect(card).toBeVisible();
});

test('아이콘 버튼에는 접근 가능한 이름이 있고, 포커스 링이 보인다', async ({ browser }) => {
  const page = await openAs(browser, '김하늘', '/', { width: 1280, height: 800 });
  await waitForBoard(page);

  // 이름 없는 버튼/링크가 없다
  const unnamed = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'button, a[href], [role=button], select, input:not([type=hidden])',
      ),
    ]
      .filter((el) => {
        const e = el as HTMLElement;
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;
        const name =
          e.getAttribute('aria-label') ||
          e.getAttribute('aria-labelledby') ||
          e.textContent?.trim() ||
          (e as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
          e.getAttribute('title');
        return !name;
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);

  // 키보드로 포커스하면 2px 이상 포커스 링(outline)이 생긴다
  for (const target of [
    page.getByRole('button', { name: '+ 새 할일' }),
    page.getByRole('tab', { name: '리스트' }),
    page.getByRole('button', { name: '설정' }),
  ]) {
    await target.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const outline = await target.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  }
});
