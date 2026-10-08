import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

export const MOCK_URL = 'http://localhost:54377';

export type Seed = 'empty' | 'sample' | 'full';

/** 목 서버의 데이터를 초기화한다 */
export async function resetMock(seed: Seed = 'sample') {
  const res = await fetch(`${MOCK_URL}/__reset`, {
    method: 'POST',
    body: JSON.stringify({ seed }),
  });
  expect(res.ok).toBe(true);
}

export async function setOutage(on: boolean) {
  await fetch(`${MOCK_URL}/__outage`, { method: 'POST', body: JSON.stringify({ on }) });
}

export type MockRow = Record<string, unknown>;
export interface MockState {
  tasks: MockRow[];
  comments: MockRow[];
  members: MockRow[];
  categories: MockRow[];
  holidays: MockRow[];
  leaves: MockRow[];
}

export async function mockState(): Promise<MockState> {
  return (await fetch(`${MOCK_URL}/__state`)).json() as Promise<MockState>;
}

/** localStorage 에 사용자 이름을 미리 넣어, 첫 접속 이름 모달 없이 시작한다 */
export async function openAs(
  browserOrContext: Browser | BrowserContext,
  name: string,
  path = '/',
  viewport?: { width: number; height: number },
): Promise<Page> {
  const context =
    'newContext' in browserOrContext
      ? await browserOrContext.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
      : browserOrContext;
  await context.addInitScript((n) => {
    try {
      localStorage.setItem('team-calendar:user-name', n);
    } catch {
      // 무시
    }
  }, name);
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.getByRole('heading', { name: '부서 공용 업무 캘린더' })).toBeVisible();
  return page;
}

/** 칸반이 로딩 스켈레톤을 벗어날 때까지 기다린다 */
export async function waitForBoard(page: Page) {
  await expect(page.getByRole('heading', { name: '할 일', level: 2 }).first()).toBeVisible();
}

/** + 새 할일 → 제목 입력 → 등록 */
export async function createTask(page: Page, title: string, extra?: { description?: string }) {
  await page.getByRole('button', { name: '+ 새 할일' }).click();
  const dialog = page.getByRole('dialog', { name: '새 할일' });
  await dialog.getByLabel('제목').fill(title);
  if (extra?.description) await dialog.getByLabel('설명').fill(extra.description);
  await dialog.getByRole('button', { name: '등록' }).click();
  await expect(dialog).toBeHidden();
}

/** 실시간 이벤트 없이 서버 데이터만 바꾼다(놓친 변경 흉내) */
export async function mutateSilently(
  table: keyof MockState,
  id: string,
  patch: Record<string, unknown>,
) {
  const res = await fetch(`${MOCK_URL}/__mutate`, {
    method: 'POST',
    body: JSON.stringify({ table, id, patch }),
  });
  expect(res.ok).toBe(true);
}

/** 샘플 데이터의 첫 할일(제목을 안정적으로 쓰려고 직접 만든 할일을 고르는 대신 쓴다) */
export async function firstTask() {
  const task = (await mockState()).tasks[0];
  if (!task) throw new Error('샘플 할일이 없습니다');
  return { id: task.id as string, title: task.title as string };
}

/** 첫 번째 "할 일" 상태의 할일(모바일 칸반은 기본으로 이 열만 보여 준다) */
export async function firstTodoTask() {
  const task = (await mockState()).tasks.find((t) => t.status === 'todo');
  if (!task) throw new Error('할 일 상태의 샘플이 없습니다');
  return { id: task.id as string, title: task.title as string };
}
