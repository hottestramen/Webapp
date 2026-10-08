import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 마이그레이션 001~004 를 실제 Postgres(PGlite)에 적용하고 anon 역할로 RLS 를 검증한다(PRD §5.4).
// Supabase 의 anon·authenticated 역할은 직접 만들어 흉내 낸다.

const read = (name: string) =>
  readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8');

let db: PGlite;

/** anon 역할로 실행한 결과. 오류면 메시지를 돌려준다. */
async function asAnon(
  sql: string,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  await db.exec('set role anon');
  try {
    const result = await db.query<Record<string, unknown>>(sql);
    return { rows: result.rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  } finally {
    await db.exec('reset role');
  }
}

async function asAdmin(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;',
  );
  for (const file of [
    '001_init.sql',
    '002_rls.sql',
    '003_holidays_insert.sql',
    '004_realtime.sql',
    '005_leaves.sql',
    '006_trips.sql',
  ]) {
    await db.exec(read(file));
  }
  await db.exec(`insert into members (name) values ('김하늘')`);
  await db.exec(`insert into tasks (id, title, created_by, updated_by) values
    ('00000000-0000-4000-8000-000000000001', '보이는 할일', '김하늘', '김하늘'),
    ('00000000-0000-4000-8000-000000000002', '삭제된 할일', '김하늘', '김하늘')`);
  await db.exec(`update tasks set deleted_at = now() where title = '삭제된 할일'`);
});

afterAll(async () => {
  await db.close();
});

describe('RLS: 모든 테이블에 켜져 있다', () => {
  it('rowsecurity = true', async () => {
    const rows = await asAdmin(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relname in ('tasks','comments','members','categories','holidays')`,
    );
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.relrowsecurity === true)).toBe(true);
  });
});

describe('RLS: anon 의 DELETE 는 모두 거부', () => {
  for (const table of ['tasks', 'comments', 'members', 'categories', 'holidays']) {
    it(`${table}`, async () => {
      const { error } = await asAnon(`delete from ${table}`);
      expect(error).toMatch(/permission denied/);
    });
  }
});

describe('RLS: 삭제된(deleted_at) 행은 SELECT 되지 않는다', () => {
  it('tasks', async () => {
    const { rows } = await asAnon('select title from tasks order by title');
    expect(rows.map((r) => r.title)).toEqual(['보이는 할일']);
  });

  it('관리자(콘솔)에게는 삭제된 행도 남아 있다', async () => {
    const rows = await asAdmin('select title from tasks where deleted_at is not null');
    expect(rows.map((r) => r.title)).toEqual(['삭제된 할일']);
  });

  it('comments', async () => {
    await db.exec(`insert into comments (id, task_id, author_name, content) values
      ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', '김하늘', '보임'),
      ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', '김하늘', '삭제됨')`);
    await db.exec(`update comments set deleted_at = now() where content = '삭제됨'`);
    const { rows } = await asAnon('select content from comments');
    expect(rows.map((r) => r.content)).toEqual(['보임']);
  });
});

describe('RLS: 소프트 삭제·복구는 함수로만 가능', () => {
  it('직접 UPDATE 로 deleted_at 을 채우면 거부된다', async () => {
    const { error } = await asAnon(
      `update tasks set deleted_at = now() where id = '00000000-0000-4000-8000-000000000001'`,
    );
    expect(error).toMatch(/row-level security/);
  });

  it('soft_delete_task 로는 삭제되고, 004 의 알림 트리거가 실패해도 삭제는 성공한다', async () => {
    const { error } = await asAnon(
      `select soft_delete_task('00000000-0000-4000-8000-000000000001', '김하늘')`,
    );
    expect(error).toBeNull();
    expect((await asAnon('select 1 from tasks')).rows).toHaveLength(0);
  });

  it('restore_task 는 삭제 직후(1분 이내)만 복구한다', async () => {
    await asAnon(`select restore_task('00000000-0000-4000-8000-000000000001', '김하늘')`);
    expect((await asAnon('select 1 from tasks')).rows).toHaveLength(1);

    // 오래전에 삭제된 행은 복구되지 않는다
    const old = '00000000-0000-4000-8000-000000000002';
    await db.exec(`update tasks set deleted_at = now() - interval '1 hour' where id = '${old}'`);
    await asAnon(`select restore_task('${old}', '김하늘')`);
    expect((await asAnon('select 1 from tasks')).rows).toHaveLength(1);
  });
});

describe('RLS: 허용된 작업', () => {
  it('holidays: SELECT·INSERT 허용, UPDATE 거부', async () => {
    expect((await asAnon('select 1 from holidays')).rows.length).toBeGreaterThan(30);
    expect(
      (await asAnon(`insert into holidays values ('2026-12-31', '임시공휴일')`)).error,
    ).toBeNull();
    expect((await asAnon(`update holidays set name = 'x'`)).error).toMatch(/permission denied/);
  });

  it('tasks 등록·수정은 가능하고 값 제약은 DB 가 막는다', async () => {
    expect(
      (
        await asAnon(
          `insert into tasks (title, created_by, updated_by) values ('새 할일', '김하늘', '김하늘')`,
        )
      ).error,
    ).toBeNull();
    expect(
      (
        await asAnon(
          `insert into tasks (title, created_by, updated_by, status) values ('x', 'a', 'a', 'weird')`,
        )
      ).error,
    ).toMatch(/tasks_status_values/);
    expect(
      (
        await asAnon(
          `insert into tasks (title, created_by, updated_by) values (repeat('a', 101), 'a', 'a')`,
        )
      ).error,
    ).toMatch(/tasks_title_length/);
  });

  it('updated_at 은 UPDATE 때마다 트리거가 갱신한다(충돌 판정 기준)', async () => {
    const before = (await asAdmin(`select updated_at from tasks where title = '새 할일'`))[0]
      ?.updated_at;
    await asAnon(`update tasks set priority = 'high' where title = '새 할일'`);
    const after = (await asAdmin(`select updated_at from tasks where title = '새 할일'`))[0]
      ?.updated_at;
    expect(new Date(after as string).getTime()).toBeGreaterThan(
      new Date(before as string).getTime(),
    );
  });

  it('댓글은 deleted_at 외에는 수정할 수 없다', async () => {
    const { error } = await asAnon(`update comments set content = '변조' where content = '보임'`);
    expect(error).toMatch(/permission denied/);
  });
});

describe('휴가(leaves, 005)', () => {
  const insert = (cols: string) =>
    `insert into leaves (member_id, kind, start_date, end_date, created_by${cols.includes('repeat') ? ', note' : ''})
     select id, ${cols} from members where name = '김하늘'`;

  it('RLS 가 켜져 있다', async () => {
    const rows = await asAdmin(`select relrowsecurity from pg_class where relname = 'leaves'`);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it('등록할 수 있고(연차 기간), 반차·병가도 가능', async () => {
    expect(
      (await asAnon(insert(`'annual', '2026-10-07', '2026-10-09', '김하늘'`))).error,
    ).toBeNull();
    expect(
      (await asAnon(insert(`'half-am', '2026-10-12', '2026-10-12', '김하늘'`))).error,
    ).toBeNull();
    expect((await asAnon(insert(`'sick', '2026-10-13', '2026-10-13', '김하늘'`))).error).toBeNull();
    expect((await asAnon(insert(`'trip', '2026-10-14', '2026-10-16', '김하늘'`))).error).toBeNull();
  });

  it('값 제약: 종류·기간 순서·최대 기간·반차 하루·메모 길이', async () => {
    expect((await asAnon(insert(`'party', '2026-10-07', '2026-10-07', '김하늘'`))).error).toMatch(
      /leaves_kind_values/,
    );
    expect((await asAnon(insert(`'annual', '2026-10-09', '2026-10-07', '김하늘'`))).error).toMatch(
      /leaves_period_order/,
    );
    expect((await asAnon(insert(`'annual', '2026-01-01', '2026-04-02', '김하늘'`))).error).toMatch(
      /leaves_period_length/,
    );
    expect((await asAnon(insert(`'half-pm', '2026-10-07', '2026-10-08', '김하늘'`))).error).toMatch(
      /leaves_half_one_day/,
    );
    expect(
      (await asAnon(insert(`'annual', '2026-10-07', '2026-10-07', '김하늘', repeat('a', 51)`)))
        .error,
    ).toMatch(/leaves_note_length/);
  });

  it('비활성 팀원의 휴가는 등록할 수 없다', async () => {
    await db.exec(`insert into members (name, active) values ('퇴사자', false)`);
    const { error } = await asAnon(
      `insert into leaves (member_id, start_date, end_date, created_by)
       select id, '2026-10-07', '2026-10-07', 'x' from members where name = '퇴사자'`,
    );
    expect(error).toMatch(/비활성/);
  });

  it('anon 은 DELETE 불가, 수정은 가능', async () => {
    expect((await asAnon('delete from leaves')).error).toMatch(/permission denied/);
    expect((await asAnon(`update leaves set note = '수정' where kind = 'sick'`)).error).toBeNull();
  });

  it('직접 deleted_at UPDATE 는 거부되고, soft_delete_leave 로만 삭제되며 삭제된 행은 보이지 않는다', async () => {
    expect(
      (await asAnon(`update leaves set deleted_at = now() where kind = 'sick'`)).error,
    ).toMatch(/row-level security/);

    const before = (await asAnon('select id from leaves')).rows.length;
    const id = (await asAdmin(`select id from leaves where kind = 'sick'`))[0]?.id as string;
    expect((await asAnon(`select soft_delete_leave('${id}')`)).error).toBeNull();
    expect((await asAnon('select id from leaves')).rows).toHaveLength(before - 1);
    expect(
      (await asAdmin(`select deleted_at from leaves where id = '${id}'`))[0]?.deleted_at,
    ).not.toBeNull();
  });
});
