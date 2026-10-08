import { expect, test } from '@playwright/test';
import { MOCK_URL, mockState, openAs, resetMock } from './helpers';

// 완료 후 7일이 지난 할일은 휴지통(설정)으로 이동하고, 복원하면 "할 일"로 돌아온다
test.beforeEach(async () => {
  await resetMock('sample');
});

async function insertDone(title: string, daysAgo: number) {
  const completed = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const res = await fetch(`${MOCK_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify({
      title,
      status: 'done',
      completed_at: completed,
      created_by: '시드',
      updated_by: '시드',
    }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
}

test('7일 지난 완료 할일은 칸반에서 빠지고 휴지통에서 복원된다', async ({ browser }) => {
  await insertDone('오래전 끝낸 일', 10);
  await insertDone('어제 끝낸 일', 1);

  const page = await openAs(browser, '김하늘', '/?view=kanban', { width: 1280, height: 900 });
  await expect(page.getByText('어제 끝낸 일')).toBeVisible();
  await expect(page.getByText('오래전 끝낸 일')).toHaveCount(0);

  // 목록 뷰에서도 보이지 않는다
  await page.getByRole('tab', { name: '리스트' }).click();
  await expect(page.getByText('오래전 끝낸 일')).toHaveCount(0);

  await page.getByRole('button', { name: '설정' }).click();
  const trash = page.getByRole('region', { name: /^휴지통/ });
  await expect(trash.getByText('오래전 끝낸 일')).toBeVisible();
  await expect(trash.getByText('어제 끝낸 일')).toHaveCount(0);

  await trash.getByRole('button', { name: '오래전 끝낸 일 복원' }).click();
  await expect(trash.getByText('오래전 끝낸 일')).toHaveCount(0);
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.title === '오래전 끝낸 일')?.status)
    .toBe('todo');

  await page.getByRole('button', { name: '← 돌아가기' }).click();
  await expect(page.getByRole('cell', { name: '오래전 끝낸 일' })).toBeVisible();
});

test('대시보드 통계에는 휴지통 항목도 계속 포함된다', async ({ browser }) => {
  await insertDone('오래전 끝낸 일', 10);
  const total = (await mockState()).tasks.filter((t) => t.status === 'done').length;
  const page = await openAs(browser, '김하늘', '/?view=dashboard', { width: 1280, height: 900 });
  await expect(page.getByText('오래전 끝낸 일')).toBeVisible(); // 최근 완료 이력
  expect(total).toBeGreaterThan(0);
});

test('대시보드의 휴지통 카드: 건수가 보이고 누르면 설정의 휴지통이 열린다', async ({ browser }) => {
  await insertDone('오래전 끝낸 일', 10);
  await insertDone('더 오래전 일', 30);
  const page = await openAs(browser, '김하늘', '/?view=dashboard', { width: 1280, height: 900 });
  const card = page.getByRole('button', { name: /^휴지통 6./ });
  await expect(card).toBeVisible();
  await card.click();
  const trash = page.getByRole('region', { name: /^휴지통 \(6건\)/ });
  await expect(trash.getByText('더 오래전 일')).toBeVisible();
});
