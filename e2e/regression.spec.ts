import { expect, test } from '@playwright/test';
import { mockState, mutateSilently, openAs, resetMock, waitForBoard } from './helpers';

// DevTools 점검(수동)에서 발견해 고친 항목의 회귀 테스트
test.beforeEach(async () => {
  await resetMock('sample');
});

/** 서울 기준 오늘 + n일 'YYYY-MM-DD' */
function seoulDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

test('헤더에 현재 사용자의 색상 아바타가 보인다', async ({ browser }) => {
  const page = await openAs(browser, '김하늘'); // 샘플 팀원
  await waitForBoard(page);
  const button = page.getByRole('button', { name: /현재 사용자 김하늘/ });
  await expect(button).toContainText('김하늘');
  const avatar = button.locator('span[aria-hidden="true"]');
  await expect(avatar).toHaveAttribute('data-initial', '김'); // 글자는 CSS 로 그려진다
  await expect(avatar).toHaveClass(/bg-avatar-\d/);
});

test('캘린더 셀에도 마감 임박·지연 배지가 보이고, 완료 항목은 배지가 없다', async ({ browser }) => {
  const tasks = (await mockState()).tasks;
  const open = tasks.filter((t) => t.status !== 'done');
  const [soon, overdue, far] = [open[0], open[1], open[2]];
  const done = tasks.find((t) => t.status === 'done');
  if (!soon || !overdue || !far || !done) throw new Error('샘플 데이터가 부족합니다');

  const today = seoulDate(0);
  await mutateSilently('tasks', soon.id as string, { due_date: seoulDate(2) });
  await mutateSilently('tasks', overdue.id as string, { due_date: seoulDate(-1) });
  await mutateSilently('tasks', far.id as string, { due_date: seoulDate(4) });
  await mutateSilently('tasks', done.id as string, { due_date: seoulDate(-3) });

  const page = await openAs(browser, '김하늘', '/?view=calendar', { width: 1280, height: 900 });
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator(`[data-date="${today}"]`)).toBeVisible();

  const line = (id: unknown) =>
    page
      .getByRole('gridcell')
      .getByRole('button', { name: String(tasks.find((t) => t.id === id)?.title) });

  // 다음 달·이전 달에 걸쳐 있어도 그리드 안에 있는 날짜만 확인한다(오늘 ±4일이 한 격자에 들어오지 않을 수 있음)
  const visible = async (id: unknown) => (await line(id).count()) > 0;
  if (await visible(soon.id)) {
    await expect(line(soon.id)).toHaveAccessibleName(/D-2/);
    await expect(line(soon.id).getByText('D-2', { exact: true })).toBeVisible();
  }
  if (await visible(overdue.id)) {
    await expect(line(overdue.id)).toHaveAccessibleName(/지연 \+1일/);
    await expect(line(overdue.id).getByText('지연 +1일', { exact: true })).toBeVisible();
  }
  if (await visible(far.id)) {
    await expect(line(far.id).getByText(/^D-|^지연/)).toHaveCount(0); // D-4 는 배지 없음
  }
  if (await visible(done.id)) {
    await expect(line(done.id).getByText(/^D-|^지연/)).toHaveCount(0); // 완료는 배지 없음
  }
});

test('메타 설명이 있고, robots.txt 는 수집을 막는다', async ({ browser, baseURL }) => {
  const page = await openAs(browser, '김하늘');
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description?.length ?? 0).toBeGreaterThan(20);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const robots = await (await fetch(`${baseURL}/robots.txt`)).text();
  expect(robots).toContain('User-agent: *');
  expect(robots).toContain('Disallow: /');
});

test('댓글 삭제 버튼은 본인이 쓴 댓글에만 보인다', async ({ browser }) => {
  const tasks = (await mockState()).tasks;
  const comments = (await mockState()).comments;
  const commented = tasks.find((t) =>
    comments.some((c) => c.task_id === t.id && c.author_name !== '점검자'),
  );
  if (!commented) throw new Error('다른 사람이 댓글을 단 샘플이 없습니다');
  const title = String(commented.title);

  const page = await openAs(browser, '점검자');
  await waitForBoard(page);
  await page.getByRole('button', { name: title }).first().click();
  const detail = page.getByRole('dialog', { name: title });
  await expect(detail.getByRole('listitem').first()).toBeVisible();
  // 다른 사람의 댓글: 삭제 버튼 없음
  await expect(detail.getByRole('button', { name: /의 댓글 삭제/ })).toHaveCount(0);

  // 내가 쓴 댓글: 삭제 버튼 있음
  await detail.getByLabel(/댓글 쓰기/).fill('내가 쓴 댓글');
  await detail.getByRole('button', { name: '댓글 등록' }).click();
  await expect(detail.getByRole('button', { name: '점검자의 댓글 삭제' })).toHaveCount(1);
  await expect(detail.getByRole('button', { name: /의 댓글 삭제/ })).toHaveCount(1);
});

test('충돌 후 "내 입력값"은 내가 실제로 바꾼 필드만 보인다', async ({ browser }) => {
  const a = await openAs(browser, '김하늘');
  const b = await openAs(browser, '박팀장');
  await waitForBoard(a);
  await waitForBoard(b);
  const task = (await mockState()).tasks[0];
  const title = String(task?.title);

  await a.getByRole('button', { name: title }).click();
  await b.getByRole('button', { name: title }).click();
  const detailA = a.getByRole('dialog', { name: title });
  const detailB = b.getByRole('dialog', { name: title });
  await detailA.getByRole('button', { name: '수정' }).click();
  await detailB.getByRole('button', { name: '수정' }).click();

  // B 는 마감일만 바꿔 먼저 저장, A 는 제목만 바꿔 저장 → 충돌
  await detailB.getByLabel('마감일').fill('2026-12-24');
  await detailB.getByRole('button', { name: '저장' }).click();
  await expect(detailA.getByText('박팀장님이 이 항목을 수정했습니다')).toBeVisible({
    timeout: 3000,
  });
  await detailA.getByLabel('제목').fill(`${title} (A)`);
  await detailA.getByRole('button', { name: '저장' }).click();
  await a
    .getByRole('dialog', { name: '다른 팀원이 먼저 수정했습니다' })
    .getByRole('button', { name: '최신 내용 보기' })
    .click();

  await expect(detailA.getByText(`내 입력값: ${title} (A)`)).toBeVisible();
  await expect(detailA.getByLabel('마감일')).toHaveValue('2026-12-24');
  // A 는 마감일을 건드리지 않았으므로 "내 입력값"이 마감일 옆에 나오면 안 된다
  await expect(detailA.getByText(/^내 입력값/)).toHaveCount(1);
});

test('제목("백령지사 공용업무 캘린더")을 누르면 설정·다른 뷰·필터가 풀리고 칸반으로 돌아간다', async ({
  browser,
}) => {
  const page = await openAs(browser, '김하늘', '/?view=dashboard&q=예산', {
    width: 1280,
    height: 900,
  });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

  await page.getByRole('link', { name: '백령지사 공용업무 캘린더' }).click();
  await expect(page.getByRole('heading', { name: '설정' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '칸반' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/view=kanban|^[^?]*$/);
  expect(page.url()).not.toContain('q=');
});
