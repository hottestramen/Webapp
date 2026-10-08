import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MOCK_URL, mockState, openAs, resetMock } from './helpers';

// 팀원 휴가 표시: 등록 화면, 캘린더 표시(칩·평일만·더보기), 수정·삭제, 실시간, 접근성
test.beforeEach(async () => {
  await resetMock('sample');
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(new Date(Date.parse(date) + n * 86_400_000));
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일

/** 서울 기준 오늘 */
const seoulToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 이번 달에서 공휴일이 아닌 평일 중 14일 이후 첫 날(주 단위 검증을 위해 월요일부터 쓸 수 있게 월요일을 고른다) */
async function mondayThisMonth(): Promise<string> {
  const holidays = new Set((await mockState()).holidays.map((h) => String(h.date)));
  const ym = seoulToday().slice(0, 7);
  for (let day = 10; day <= 24; day++) {
    const date = `${ym}-${String(day).padStart(2, '0')}`;
    if (weekday(date) === 1 && !holidays.has(date) && !holidays.has(addDays(date, 4))) return date;
  }
  throw new Error('이번 달에 쓸 수 있는 월요일이 없습니다');
}

async function insertLeave(body: Record<string, unknown>) {
  const res = await fetch(`${MOCK_URL}/rest/v1/leaves`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify({ created_by: '시드', ...body }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
}

const cell = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);

async function fillForm(
  page: Page,
  v: { member?: string; kind?: string; start?: string; end?: string; note?: string },
) {
  const dialog = page.getByRole('dialog', { name: /(휴가|출장) (등록|수정)/ });
  if (v.member !== undefined) await dialog.getByLabel(/^팀원/).selectOption({ label: v.member });
  if (v.kind) await dialog.getByLabel('종류').selectOption({ label: v.kind });
  if (v.start) await dialog.getByLabel(/^(시작일|날짜)/).fill(v.start);
  if (v.end) await dialog.getByLabel(/^종료일/).fill(v.end);
  if (v.note !== undefined) await dialog.getByLabel('메모').fill(v.note);
  return dialog;
}

test('휴가 등록: 입력 검증 → 등록 → 캘린더 칩 표시 → 수정 → 삭제', async ({ browser }) => {
  const monday = await mondayThisMonth();
  const wednesday = addDays(monday, 2);
  const page = await openAs(browser, '김하늘', '/?view=calendar', { width: 1280, height: 900 });
  await expect(page.getByRole('grid')).toBeVisible();

  await page.getByRole('button', { name: '+ 휴가 등록' }).click();
  const dialog = page.getByRole('dialog', { name: '휴가 등록' });
  await expect(dialog.getByLabel(/^팀원/)).toHaveValue(/.+/); // 현재 사용자가 기본 선택된다

  // 검증: 팀원 없음, 종료일이 시작일보다 빠름
  await dialog.getByLabel(/^팀원/).selectOption({ label: '선택하세요' });
  await dialog.getByRole('button', { name: '등록' }).click();
  await expect(dialog.getByText('팀원을 선택하세요.')).toBeVisible();
  await fillForm(page, { member: '김하늘', start: wednesday, end: addDays(wednesday, -1) });
  await dialog.getByRole('button', { name: '등록' }).click();
  await expect(dialog.getByText(/종료일은 시작일보다 빠를 수 없습니다/)).toBeVisible();

  // 정상 등록: 수~금 연차
  await fillForm(page, { end: addDays(wednesday, 2), note: '제주 가족여행' });
  await dialog.getByRole('button', { name: '등록' }).click();
  await expect(dialog).toBeHidden();

  for (const d of [wednesday, addDays(wednesday, 1), addDays(wednesday, 2)]) {
    await expect(cell(page, d).getByRole('button', { name: /^김하늘 연차/ })).toBeVisible();
  }
  const saved = (await mockState()).leaves.find((l) => l.note === '제주 가족여행');
  expect(saved).toMatchObject({ kind: 'annual', start_date: wednesday, created_by: '김하늘' });

  // 셀의 접근 가능한 이름에 휴가 인원이 들어간다
  await expect(cell(page, wednesday)).toHaveAttribute('aria-label', /휴가 1명/);

  // 수정: 오전 반차(하루)로 바꾼다 → 종료일 칸이 사라지고 하루만 남는다
  await cell(page, wednesday)
    .getByRole('button', { name: /^김하늘 연차/ })
    .click();
  const edit = page.getByRole('dialog', { name: '휴가 수정' });
  await fillForm(page, { kind: '오전 반차' });
  await expect(edit.getByLabel(/^종료일/)).toHaveCount(0);
  await edit.getByRole('button', { name: '저장' }).click();
  await expect(edit).toBeHidden();
  await expect(
    cell(page, wednesday).getByRole('button', { name: /^김하늘 오전반차/ }),
  ).toBeVisible();
  await expect(
    cell(page, addDays(wednesday, 1)).getByRole('button', { name: /김하늘/ }),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await mockState()).leaves.find((l) => l.id === saved?.id)?.kind)
    .toBe('half-am');

  // 삭제
  await cell(page, wednesday)
    .getByRole('button', { name: /^김하늘 오전반차/ })
    .click();
  page.once('dialog', (d) => void d.accept());
  await page
    .getByRole('dialog', { name: '휴가 수정' })
    .getByRole('button', { name: '삭제' })
    .click();
  await expect(cell(page, wednesday).getByRole('button', { name: /김하늘/ })).toHaveCount(0);
  await expect
    .poll(async () => (await mockState()).leaves.find((l) => l.id === saved?.id)?.deleted_at)
    .not.toBeNull();
});

test('주말·공휴일에는 표시하지 않고, 4명 이상이면 "휴가 +N명" 더보기가 열린다', async ({
  browser,
}) => {
  const monday = await mondayThisMonth();
  const friday = addDays(monday, 4);
  const nextMonday = addDays(monday, 7);
  const members = (await mockState()).members.filter((m) => m.active);
  const [a, b, c, d] = members;
  if (!a || !b || !c || !d) throw new Error('활성 팀원이 부족합니다');

  // a: 금요일~다음 주 월요일 연차(토·일 포함)
  await insertLeave({ member_id: a.id, kind: 'annual', start_date: friday, end_date: nextMonday });
  // 같은 월요일에 4명이 쉰다
  for (const m of [a, b, c, d]) {
    await insertLeave({ member_id: m.id, kind: 'annual', start_date: monday, end_date: monday });
  }

  const page = await openAs(browser, '김하늘', '/?view=calendar', { width: 1280, height: 900 });
  await expect(page.getByRole('grid')).toBeVisible();

  // 금·월에만 표시, 토·일은 표시하지 않는다
  await expect(
    cell(page, friday).getByRole('button', { name: new RegExp(`^${String(a.name)} 연차`) }),
  ).toBeVisible();
  await expect(cell(page, addDays(friday, 1)).getByRole('button', { name: /연차/ })).toHaveCount(0);
  await expect(cell(page, addDays(friday, 2)).getByRole('button', { name: /연차/ })).toHaveCount(0);
  await expect(
    cell(page, nextMonday).getByRole('button', { name: new RegExp(`^${String(a.name)} 연차`) }),
  ).toBeVisible();

  // 4명 → 3명만 칩으로, 나머지는 더보기
  await expect(cell(page, monday).getByRole('button', { name: /연차, 연차/ })).toHaveCount(3);
  await cell(page, monday).getByRole('button', { name: '휴가 +1명' }).click();
  const popup = page.getByRole('dialog', { name: /휴가 4명/ });
  await expect(popup.getByRole('button', { name: /연차/ })).toHaveCount(4);

  // 목록에서 항목을 누르면 수정 화면으로 이어진다
  await popup.getByRole('button', { name: /연차/ }).first().click();
  await expect(page.getByRole('dialog', { name: '휴가 수정' })).toBeVisible();
});

test('다른 사람이 등록한 휴가가 실시간으로 캘린더에 나타난다', async ({ browser }) => {
  const monday = await mondayThisMonth();
  const a = await openAs(browser, '김하늘', '/?view=calendar', { width: 1280, height: 900 });
  const b = await openAs(browser, '박팀장', '/?view=calendar', { width: 1280, height: 900 });
  await expect(a.getByRole('grid')).toBeVisible();
  await expect(b.getByRole('grid')).toBeVisible();

  const member = (await mockState()).members.find((m) => m.name === '이도윤');
  if (!member) throw new Error('샘플 팀원이 없습니다');
  await insertLeave({ member_id: member.id, kind: 'sick', start_date: monday, end_date: monday });

  await expect(cell(a, monday).getByRole('button', { name: /^이도윤 병가/ })).toBeVisible({
    timeout: 2000,
  });
  await expect(cell(b, monday).getByRole('button', { name: /^이도윤 병가/ })).toBeVisible({
    timeout: 2000,
  });
});

test('모바일: 날짜를 누르면 그날 휴가자와 등록 버튼이 보인다', async ({ browser }) => {
  const monday = await mondayThisMonth();
  const member = (await mockState()).members.find((m) => m.name === '이도윤');
  if (!member) throw new Error('샘플 팀원이 없습니다');
  await insertLeave({ member_id: member.id, kind: 'annual', start_date: monday, end_date: monday });

  const page = await openAs(browser, '김하늘', '/?view=calendar', { width: 375, height: 812 });
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(cell(page, monday)).toContainText('휴1'); // 칸에는 인원 수만
  await cell(page, monday).click();
  await expect(page.getByRole('heading', { name: '휴가 1명' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^이도윤 연차/ })).toBeVisible();
  await page.getByRole('button', { name: '+ 이 날짜에 휴가 등록' }).click();
  await expect(
    page.getByRole('dialog', { name: '휴가 등록' }).getByLabel(/^(시작일|날짜)/),
  ).toHaveValue(monday);
});

test('접근성: 휴가가 표시된 캘린더와 등록 모달(라이트·다크)에 axe 위반이 없다', async ({
  browser,
}) => {
  const monday = await mondayThisMonth();
  const members = (await mockState()).members.filter((m) => m.active);
  for (const m of members.slice(0, 4)) {
    await insertLeave({ member_id: m.id, kind: 'annual', start_date: monday, end_date: monday });
  }

  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      colorScheme: scheme,
      viewport: { width: 1280, height: 900 },
    });
    const page = await openAs(context, '김하늘', '/?view=calendar');
    await expect(page.getByRole('grid')).toBeVisible();
    await page.waitForTimeout(800);

    const scan = async (label: string) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const summary = violations.map((v) => ({
        rule: v.id,
        sample: v.nodes
          .slice(0, 3)
          .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
      }));
      if (summary.length)
        console.log(`[axe ${scheme}] ${label}\n${JSON.stringify(summary, null, 2)}`);
      expect(summary, `${scheme} ${label}`).toEqual([]);
    };

    await scan('캘린더(휴가 표시)');
    await page.getByRole('button', { name: '+ 휴가 등록' }).click();
    await expect(page.getByRole('dialog', { name: '휴가 등록' })).toBeVisible();
    await page.waitForTimeout(500);
    await scan('휴가 등록 모달');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '휴가 +1명' }).click();
    await page.waitForTimeout(500);
    await scan('휴가 더보기');
    await context.close();
  }
});

test('출장 등록: 별도 색의 칩으로 휴가와 함께 표시되고 수정·삭제할 수 있다', async ({
  browser,
}) => {
  const monday = await mondayThisMonth();
  const page = await openAs(browser, '김하늘', '/?view=calendar', { width: 1280, height: 900 });
  await expect(page.getByRole('grid')).toBeVisible();

  await page.getByRole('button', { name: '+ 출장 등록' }).click();
  const dialog = page.getByRole('dialog', { name: '출장 등록' });
  await expect(dialog.getByLabel('종류')).toHaveCount(0); // 출장은 종류 선택이 없다
  await fillForm(page, {
    member: '김하늘',
    start: monday,
    end: addDays(monday, 1),
    note: '부산 지사',
  });
  await dialog.getByRole('button', { name: '등록' }).click();
  await expect(dialog).toBeHidden();

  const chip = cell(page, monday).getByRole('button', { name: /^김하늘 출장/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveClass(/bg-trip-bg/);
  await expect(
    cell(page, addDays(monday, 1)).getByRole('button', { name: /^김하늘 출장/ }),
  ).toBeVisible();
  await expect(cell(page, monday)).toHaveAttribute('aria-label', /출장 1명/);
  const saved = (await mockState()).leaves.find((l) => l.note === '부산 지사');
  expect(saved).toMatchObject({ kind: 'trip', start_date: monday, end_date: addDays(monday, 1) });

  await chip.click();
  const edit = page.getByRole('dialog', { name: '출장 수정' });
  page.once('dialog', (d) => void d.accept());
  await edit.getByRole('button', { name: '삭제' }).click();
  await expect(cell(page, monday).getByRole('button', { name: /^김하늘 출장/ })).toHaveCount(0);
});

test('휴가와 출장이 같은 날이면 목록 제목이 "휴가·출장"이고 axe 위반이 없다', async ({
  browser,
}) => {
  const monday = await mondayThisMonth();
  const members = (await mockState()).members.filter((m) => m.active);
  for (const [i, m] of members.slice(0, 4).entries()) {
    await insertLeave({
      member_id: m.id,
      kind: i < 2 ? 'trip' : 'annual',
      start_date: monday,
      end_date: monday,
    });
  }
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      colorScheme: scheme,
      viewport: { width: 1280, height: 900 },
    });
    const page = await openAs(context, '김하늘', '/?view=calendar');
    await expect(page.getByRole('grid')).toBeVisible();
    await expect(cell(page, monday)).toHaveAttribute('aria-label', /휴가·출장 4명/);
    await page.getByRole('button', { name: /^휴가 \+1명$/ }).click();
    await expect(page.getByRole('dialog', { name: /휴가·출장 4명/ })).toBeVisible();
    await page.waitForTimeout(500);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      violations.map((v) => v.id),
      scheme,
    ).toEqual([]);
    await context.close();
  }
});
