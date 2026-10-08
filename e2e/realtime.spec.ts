import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  createTask,
  firstTask,
  mockState,
  mutateSilently,
  openAs,
  resetMock,
  setOutage,
  waitForBoard,
} from './helpers';

// 실시간 동기화(§5.7)·충돌 처리(§5.8)·오프라인 복구 시나리오. 브라우저 두 개(A: 김하늘, B: 박팀장)를 동시에 띄운다.
test.beforeEach(async () => {
  await setOutage(false);
  await resetMock('sample');
});
test.afterEach(async () => {
  await setOutage(false);
});

const card = (page: Page, title: string) => page.getByRole('button', { name: title });

async function openDetail(page: Page, title: string) {
  await card(page, title).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('한쪽에서 만들고 고치면 다른 쪽에 2초 안에 반영된다', async ({ browser }) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  await expect(a.getByText('오프라인 — 재연결 중')).toHaveCount(0);

  // 새 할일 등록 → B 에 2초 안에 나타난다
  const title = '실시간 반영 확인';
  const started = Date.now();
  await createTask(a, title);
  await expect(card(b, title)).toBeVisible({ timeout: 2000 });
  const latency = Date.now() - started;
  console.log(`등록 → 다른 브라우저 반영: ${latency}ms`);

  // B 가 상태를 바꾸면 A 의 카드가 진행 중 열로 옮겨 간다
  const detail = await openDetail(b, title);
  await detail.getByLabel('상태 변경').selectOption('in-progress');
  await expect(
    a.locator('section[aria-labelledby="column-in-progress"]').getByRole('button', { name: title }),
  ).toBeVisible({ timeout: 2000 });
});

test('다른 사람이 바꾼 카드는 잠깐 강조되고, 내가 바꾼 카드는 강조되지 않는다', async ({
  browser,
}) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const { title } = await firstTask();

  const detail = await openDetail(b, title);
  await detail.getByLabel('상태 변경').selectOption('done');

  // A: 다른 사람이 바꿨으므로 강조(테두리 색 변경) → 1.5초 뒤 사라짐
  const aCard = card(a, title);
  await expect(aCard).toHaveClass(/border-primary-strong/, { timeout: 2000 });
  await expect(aCard).not.toHaveClass(/border-primary-strong/, { timeout: 4000 });
  // B: 내가 바꾼 카드는 강조하지 않는다
  await b.getByRole('button', { name: '상세 닫기' }).click();
  await expect(card(b, title)).not.toHaveClass(/border-primary-strong/);
});

test('같은 할일을 두 창에서 고치면 나중에 저장한 쪽에 충돌 확인창이 뜬다 (S6)', async ({
  browser,
}) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const { id, title } = await firstTask();

  // 둘 다 같은 할일의 상세를 열고 수정 폼을 연다
  const detailA = await openDetail(a, title);
  const detailB = await openDetail(b, title);
  await detailA.getByRole('button', { name: '수정' }).click();
  await detailB.getByRole('button', { name: '수정' }).click();

  // B 가 먼저 마감일을 바꿔 저장한다
  await detailB.getByLabel('마감일').fill('2026-12-24');
  await detailB.getByRole('button', { name: '저장' }).click();

  // A 의 화면에는 "다른 팀원이 수정했습니다" 배너가 뜬다
  await expect(detailA.getByText('박팀장님이 이 항목을 수정했습니다')).toBeVisible({
    timeout: 3000,
  });

  // A 가 제목을 바꿔 저장하면 충돌 확인창이 뜬다
  await detailA.getByLabel('제목').fill(`${title} (A 수정)`);
  await detailA.getByRole('button', { name: '저장' }).click();
  const conflict = a.getByRole('dialog', { name: '다른 팀원이 먼저 수정했습니다' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('박팀장님이')).toBeVisible();

  // [최신 내용 보기]: 서버 값(B 의 마감일)이 보이고, 내가 입력했던 값은 "내 입력값"으로 남는다
  await conflict.getByRole('button', { name: '최신 내용 보기' }).click();
  await expect(detailA.getByLabel('마감일')).toHaveValue('2026-12-24');
  await expect(detailA.getByLabel('제목')).toHaveValue(title);
  await expect(detailA.getByText(`내 입력값: ${title} (A 수정)`)).toBeVisible();

  // 그래도 다시 고쳐 저장하면 이번에는 기준값이 최신이라 충돌 없이 저장된다
  await detailA.getByLabel('제목').fill(`${title} (A 최종)`);
  await detailA.getByRole('button', { name: '저장' }).click();
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.id === id)?.title)
    .toBe(`${title} (A 최종)`);
  // B 의 마감일 변경은 유지된다
  expect((await mockState()).tasks.find((t) => t.id === id)?.due_date).toBe('2026-12-24');
});

test('충돌 확인창에서 [내 내용으로 덮어쓰기]를 고르면 조건 없이 저장한다', async ({ browser }) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const { id, title } = await firstTask();

  const detailA = await openDetail(a, title);
  const detailB = await openDetail(b, title);
  await detailA.getByRole('button', { name: '수정' }).click();
  await detailB.getByRole('button', { name: '수정' }).click();
  await detailB.getByLabel('마감일').fill('2026-12-24');
  await detailB.getByRole('button', { name: '저장' }).click();
  await expect(detailA.getByText('박팀장님이 이 항목을 수정했습니다')).toBeVisible({
    timeout: 3000,
  });

  await detailA.getByLabel('마감일').fill('2026-12-31');
  await detailA.getByRole('button', { name: '저장' }).click();
  await a
    .getByRole('dialog', { name: '다른 팀원이 먼저 수정했습니다' })
    .getByRole('button', { name: '내 내용으로 덮어쓰기' })
    .click();

  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.id === id)?.due_date)
    .toBe('2026-12-31');
});

test('칸반 드래그·인라인 같은 단일 필드 변경은 확인창 없이 last-write-wins', async ({
  browser,
}) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const { id, title } = await firstTask();

  // A 가 상세를 연 채로 B 가 제목을 바꿔 둔다(A 의 기준값은 낡은 상태)
  const detailA = await openDetail(a, title);
  const detailB = await openDetail(b, title);
  await detailB.getByRole('button', { name: '수정' }).click();
  await detailB.getByLabel('제목').fill(`${title} (B)`);
  await detailB.getByRole('button', { name: '저장' }).click();
  await expect(detailA.getByText('박팀장님이 이 항목을 수정했습니다')).toBeVisible({
    timeout: 3000,
  });

  // A 가 상태 드롭다운(단일 필드)을 바꾸면 충돌 확인창 없이 바로 저장된다
  await detailA.getByLabel('상태 변경').selectOption('done');
  await expect(a.getByRole('dialog', { name: '다른 팀원이 먼저 수정했습니다' })).toHaveCount(0);
  await expect
    .poll(async () => (await mockState()).tasks.find((t) => t.id === id)?.status)
    .toBe('done');
});

test('열어 둔 상세가 다른 사람에 의해 삭제되면 안내 후 닫힌다', async ({ browser }) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const { title } = await firstTask();

  const detailA = await openDetail(a, title);
  const detailB = await openDetail(b, title);
  b.once('dialog', (d) => void d.accept());
  await detailB.getByRole('button', { name: '삭제', exact: true }).click();

  await expect(a.getByText('삭제된 항목입니다. 상세를 닫습니다.').first()).toBeVisible({
    timeout: 3000,
  });
  await expect(detailA).toBeHidden();
  await expect(card(a, title)).toHaveCount(0);
});

test('연결이 끊기면 오프라인 표시와 폴링, 재연결되면 자동 복구하고 놓친 변경을 따라잡는다', async ({
  browser,
}) => {
  const a = await openAs(browser, '김하늘');
  await waitForBoard(a);
  const { id, title } = await firstTask();
  await expect(a.getByText('오프라인 — 재연결 중')).toHaveCount(0);

  // 연결 끊김
  await setOutage(true);
  await expect(a.getByText('오프라인 — 재연결 중')).toBeVisible({ timeout: 10_000 });

  // 끊긴 사이 다른 사람이 제목을 바꿨다(이벤트는 오지 않는다)
  await mutateSilently('tasks', id, { title: `${title} (끊긴 사이 수정)`, updated_by: '박팀장' });

  // 재연결: 표시가 사라지고, 전체를 다시 불러와 변경을 따라잡는다
  await setOutage(false);
  await expect(a.getByText('오프라인 — 재연결 중')).toHaveCount(0, { timeout: 45_000 });
  await expect(card(a, `${title} (끊긴 사이 수정)`)).toBeVisible({ timeout: 10_000 });
});

test('탭이 다시 보이면(visibilitychange) 전체를 다시 불러온다', async ({ browser }) => {
  const a = await openAs(browser, '김하늘');
  await waitForBoard(a);
  const { id, title } = await firstTask();

  await mutateSilently('tasks', id, { title: `${title} (탭 복귀 전 수정)`, updated_by: '박팀장' });
  await expect(card(a, `${title} (탭 복귀 전 수정)`)).toHaveCount(0);

  await a.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(card(a, `${title} (탭 복귀 전 수정)`)).toBeVisible({ timeout: 5000 });
});
