import { expect, test } from '@playwright/test';
import { createTask, openAs, resetMock, mockState, waitForBoard } from './helpers';

// 핵심 흐름 E2E(PRD §5.5): 등록 → 상태 변경 → 필터 → 삭제. Chromium·WebKit·Firefox 모두에서 실행한다.
test.beforeEach(async () => {
  await resetMock('sample');
});

test('등록 → 상태 변경 → 필터 → 삭제 → 실행 취소', async ({ browser }) => {
  const page = await openAs(browser, '김하늘');
  await waitForBoard(page);
  const title = 'E2E 핵심 흐름 할일';
  const card = page.getByRole('button', { name: new RegExp(title) });
  const todoColumn = page.locator('section[aria-labelledby="column-todo"]');
  const progressColumn = page.locator('section[aria-labelledby="column-in-progress"]');

  // 1) 등록: todo 열에 카드가 생기고 DB 에도 저장된다
  await createTask(page, title);
  await expect(todoColumn.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  const saved = (await mockState()).tasks.find((t) => t.title === title);
  expect(saved).toMatchObject({ status: 'todo', created_by: '김하늘' });

  // 2) 상태 변경: 상세의 드롭다운 → 진행 중
  await card.click();
  const detail = page.getByRole('dialog', { name: title });
  await detail.getByLabel('상태 변경').selectOption('in-progress');
  await detail.getByRole('button', { name: '상세 닫기' }).click();
  await expect(progressColumn.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.title === title)?.status)
    .toBe('in-progress');

  // 3) 필터: 상태 "진행 중"만 → 이 카드는 보이고 다른 열의 카드는 사라진다
  const sidebar = page.getByRole('complementary');
  await sidebar.getByLabel('진행 중').check();
  await expect(card).toBeVisible();
  await expect(todoColumn.getByRole('button')).toHaveCount(0);
  await expect(page).toHaveURL(/status=in-progress/);
  await page.getByRole('button', { name: '전체 초기화' }).first().click();

  // 4) 삭제: 확인 → 카드 사라짐 → DB 에는 deleted_at 이 채워진다
  await card.click();
  page.once('dialog', (d) => void d.accept());
  await page
    .getByRole('dialog', { name: title })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('을(를) 삭제했습니다').first()).toBeVisible();
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.title === title)?.deleted_at)
    .not.toBeNull();

  // 5) 실행 취소: 카드가 돌아온다
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(card).toBeVisible();
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.title === title)?.deleted_at)
    .toBeNull();
});
