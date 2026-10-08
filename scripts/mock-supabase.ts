// 로컬 목 서버: Supabase(PostgREST + Realtime) 호환 최소 구현.
// 실제 Supabase 가 없는 환경에서 E2E·스크린샷·접근성·성능·실시간 시나리오를 돌리기 위한 개발용 도구다.
// RLS·트리거 동작은 supabase/rls.test.ts(PGlite)가 실제 Postgres 로 따로 검증한다.
//
// 실행: node scripts/mock-supabase.ts   (PORT, MOCK_SEED=empty|sample|full)
// 제어: POST /__reset {seed}, POST /__outage {on}, GET /__state

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { generateSeed } from './seedData.ts';

type Row = Record<string, unknown>;
type TableName = 'tasks' | 'comments' | 'members' | 'categories' | 'holidays' | 'leaves';

const PORT = Number(process.env.PORT ?? 54321);
const SOFT_DELETE_TABLES = new Set<TableName>(['tasks', 'comments', 'leaves']);

const tables: Record<TableName, Row[]> = {
  tasks: [],
  comments: [],
  members: [],
  categories: [],
  holidays: [],
  leaves: [],
};
let outage = false;
let seq = 0;

/** PostgREST 가 돌려주는 timestamptz 모양(마이크로초). 같은 밀리초에도 값이 겹치지 않게 한다. */
function now(): string {
  seq += 1;
  return `${new Date().toISOString().slice(0, -1)}${String(seq % 1000).padStart(3, '0')}+00:00`;
}

// 001_init.sql 의 초기 데이터(카테고리·공휴일)를 그대로 읽어 온다.
function loadInitialData() {
  const sql = readFileSync(new URL('../supabase/migrations/001_init.sql', import.meta.url), 'utf8');
  const categories = [...sql.matchAll(/\('([^']+)', '(cat-\d)', (\d)\)/g)].map((m) => ({
    id: randomUUID(),
    name: m[1],
    color: m[2],
    sort_order: Number(m[3]),
    active: true,
  }));
  const holidays = [...sql.matchAll(/\('(\d{4}-\d{2}-\d{2})', '([^']+)'\)/g)].map((m) => ({
    date: m[1],
    name: m[2],
  }));
  return { categories, holidays };
}

function reset(seed: 'empty' | 'sample' | 'full') {
  const initial = loadInitialData();
  tables.categories = initial.categories;
  tables.holidays = initial.holidays;
  tables.tasks = [];
  tables.comments = [];
  tables.members = [];
  tables.leaves = [];

  if (seed === 'empty') return;
  const data = generateSeed({
    tasks: seed === 'full' ? 500 : 12,
    comments: seed === 'full' ? 2000 : 15,
    categoryIds: initial.categories.map((c) => c.id as string),
  });
  tables.members = data.members as unknown as Row[];
  tables.tasks = data.tasks as unknown as Row[];
  tables.comments = data.comments as unknown as Row[];

  // 샘플 휴가(오늘 기준): 연차 3일, 반차, 병가, 같은 날 겹치는 연차
  const day = (offset: number) =>
    new Date(Date.now() + 9 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
  const [m0, m1, m2, m3] = tables.members.filter((m) => m.active);
  const leave = (
    member: Row | undefined,
    kind: string,
    start: number,
    end: number,
    note: string | null,
  ) => ({
    id: randomUUID(),
    member_id: member?.id,
    kind,
    start_date: day(start),
    end_date: day(end),
    note,
    created_by: String(member?.name ?? ''),
    created_at: now(),
    deleted_at: null,
  });
  tables.leaves = [
    leave(m0, 'annual', 0, 2, '가족 여행'),
    leave(m1, 'half-am', 1, 1, null),
    leave(m2, 'sick', 3, 3, null),
    leave(m3, 'annual', 1, 1, null),
  ];
}

// ---------------------------------------------------------------------------
// 실시간(Phoenix 프로토콜 v2: [join_ref, ref, topic, event, payload])
// ---------------------------------------------------------------------------
interface Subscription {
  id: number;
  event: string;
  table: string;
}
interface Client {
  ws: WebSocket;
  topic: string;
  joinRef: string | null;
  subs: Subscription[];
}
const clients = new Set<Client>();
let nextSubId = 1000;

function push(client: Client, event: string, payload: unknown) {
  client.ws.send(JSON.stringify([null, null, client.topic, event, payload]));
}

function emitChange(
  table: TableName,
  type: 'INSERT' | 'UPDATE',
  record: Row,
  oldRecord: Row | null,
) {
  const visible = !SOFT_DELETE_TABLES.has(table) || record.deleted_at === null;
  for (const client of clients) {
    if (!visible) {
      // 실제 Supabase 는 SELECT 정책을 통과하지 못하는 행(소프트 삭제된 행)의 변경을 보내지 않는다.
      // 대신 004 마이그레이션의 트리거가 realtime.send 로 보내는 브로드캐스트를 흉내 낸다.
      push(client, 'broadcast', {
        type: 'broadcast',
        event: 'soft-delete',
        payload: {
          table,
          id: record.id,
          updated_by: record.updated_by ?? record.author_name ?? null,
        },
      });
      continue;
    }
    const ids = client.subs
      .filter((s) => s.table === table && (s.event === '*' || s.event === type))
      .map((s) => s.id);
    if (ids.length === 0) continue;
    push(client, 'postgres_changes', {
      ids,
      data: {
        schema: 'public',
        table,
        commit_timestamp: new Date().toISOString(),
        type,
        columns: [],
        record,
        old_record: oldRecord ?? {},
        errors: null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------
class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function visibleRows(table: TableName): Row[] {
  return SOFT_DELETE_TABLES.has(table)
    ? tables[table].filter((r) => r.deleted_at === null)
    : tables[table];
}

function matchesFilters(row: Row, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (value === 'is.null') {
      if (row[key] !== null && row[key] !== undefined) return false;
    } else if (value.startsWith('eq.')) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith('neq.')) {
      if (String(row[key]) === value.slice(4)) return false;
    }
  }
  return true;
}

function sortRows(rows: Row[], orders: string[]): Row[] {
  if (orders.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [col = '', dir = 'asc'] = order.split('.');
      const av = a[col] as string | number | null;
      const bv = b[col] as string | number | null;
      if (av === bv) continue;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

const len = (v: unknown) => String(v ?? '').trim().length;

function validate(table: TableName, row: Row, existing?: Row) {
  const check = (ok: boolean, message: string) => {
    if (!ok) throw new HttpError(400, '23514', message);
  };
  if (table === 'tasks') {
    check(len(row.title) >= 1 && len(row.title) <= 100, 'tasks_title_length');
    check(['todo', 'in-progress', 'done'].includes(String(row.status)), 'tasks_status_values');
    check(['high', 'medium', 'low'].includes(String(row.priority)), 'tasks_priority_values');
    check(row.completed_at === null || row.status === 'done', 'tasks_completed_at_done');
    check(
      row.description === null || String(row.description).length <= 2000,
      'tasks_description_length',
    );
    const assignee = row.assignee_id as string | null;
    if (assignee && assignee !== existing?.assignee_id) {
      const member = tables.members.find((m) => m.id === assignee);
      check(Boolean(member?.active), '비활성 팀원은 담당자로 지정할 수 없습니다.');
    }
  }
  if (table === 'comments')
    check(len(row.content) >= 1 && len(row.content) <= 1000, 'comments_content_length');
  if (table === 'leaves') {
    check(
      ['annual', 'half-am', 'half-pm', 'sick', 'other', 'trip'].includes(String(row.kind)),
      'leaves_kind_values',
    );
    check(String(row.end_date) >= String(row.start_date), 'leaves_period_order');
    const span = (Date.parse(String(row.end_date)) - Date.parse(String(row.start_date))) / 86400e3;
    check(span <= 90, 'leaves_period_length');
    check(
      !['half-am', 'half-pm'].includes(String(row.kind)) || row.start_date === row.end_date,
      'leaves_half_one_day',
    );
    check(
      row.note === null || row.note === undefined || String(row.note).length <= 50,
      'leaves_note_length',
    );
    const member = tables.members.find((m) => m.id === row.member_id);
    check(Boolean(member?.active), '비활성 팀원의 휴가는 등록할 수 없습니다.');
  }
  if (table === 'members') {
    check(len(row.name) >= 1 && len(row.name) <= 20, 'members_name_length');
    if (row.active) {
      const dup = tables.members.find((m) => m.active && m.name === row.name && m.id !== row.id);
      if (dup) throw new HttpError(409, '23505', 'members_active_name_uniq');
    }
  }
  if (table === 'categories') {
    check(len(row.name) >= 1 && len(row.name) <= 20, 'categories_name_length');
    const dup = tables.categories.find((c) => c.name === row.name && c.id !== row.id);
    if (dup) throw new HttpError(409, '23505', 'categories_name_key');
  }
  if (table === 'holidays') {
    check(len(row.name) >= 1 && len(row.name) <= 30, 'holidays_name_length');
    if (tables.holidays.some((h) => h.date === row.date))
      throw new HttpError(409, '23505', 'holidays_pkey');
  }
}

function withDefaults(table: TableName, input: Row): Row {
  const t = now();
  switch (table) {
    case 'tasks':
      return {
        id: randomUUID(),
        description: null,
        status: 'todo',
        priority: 'medium',
        assignee_id: null,
        category_id: null,
        due_date: null,
        completed_at: null,
        created_at: t,
        updated_at: t,
        deleted_at: null,
        ...input,
        title: String(input.title ?? '').trim(),
      };
    case 'comments':
      return { id: randomUUID(), created_at: t, deleted_at: null, ...input };
    case 'leaves':
      return {
        id: randomUUID(),
        kind: 'annual',
        note: null,
        created_at: t,
        deleted_at: null,
        ...input,
      };
    case 'members':
      return { id: randomUUID(), color: 'avatar-1', active: true, created_at: t, ...input };
    case 'categories':
      return { id: randomUUID(), sort_order: 0, active: true, ...input };
    default:
      return { ...input };
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : null;
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers':
      'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': '*',
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function wantsObject(req: IncomingMessage): boolean {
  return String(req.headers.accept ?? '').includes('vnd.pgrst.object+json');
}
function wantsRepresentation(req: IncomingMessage): boolean {
  return String(req.headers.prefer ?? '').includes('return=representation');
}

function respondRows(req: IncomingMessage, res: ServerResponse, rows: Row[], status: number) {
  if (wantsObject(req)) {
    if (rows.length !== 1) {
      return send(res, 406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      });
    }
    return send(res, status, rows[0]);
  }
  return send(res, status, rows);
}

function rpc(name: string, args: Row) {
  const byId = (table: TableName) => tables[table].find((r) => r.id === args.p_id);
  if (name === 'soft_delete_task') {
    const row = byId('tasks');
    if (row && row.deleted_at === null) {
      const old = { ...row };
      Object.assign(row, { deleted_at: now(), updated_by: args.p_updated_by, updated_at: now() });
      emitChange('tasks', 'UPDATE', row, old);
    }
  } else if (name === 'restore_task') {
    const row = byId('tasks');
    if (
      row &&
      row.deleted_at !== null &&
      Date.now() - Date.parse(String(row.deleted_at)) < 60_000
    ) {
      const old = { ...row };
      Object.assign(row, { deleted_at: null, updated_by: args.p_updated_by, updated_at: now() });
      emitChange('tasks', 'UPDATE', row, old);
    }
  } else if (name === 'soft_delete_leave') {
    const row = byId('leaves');
    if (row && row.deleted_at === null) {
      const old = { ...row };
      row.deleted_at = now();
      emitChange('leaves', 'UPDATE', row, old);
    }
  } else if (name === 'soft_delete_comment') {
    const row = byId('comments');
    if (row && row.deleted_at === null) {
      const old = { ...row };
      row.deleted_at = now();
      emitChange('comments', 'UPDATE', row, old);
    }
  } else {
    throw new HttpError(404, 'PGRST202', `unknown function ${name}`);
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'OPTIONS') return send(res, 204);

  // 제어용 엔드포인트
  if (url.pathname === '/__reset') {
    const body = (await readBody(req)) as { seed?: 'empty' | 'sample' | 'full' } | null;
    reset(body?.seed ?? 'sample');
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/__outage') {
    const body = (await readBody(req)) as { on: boolean };
    outage = body.on;
    if (outage) for (const c of clients) c.ws.terminate();
    return send(res, 200, { outage });
  }
  // 실시간 이벤트를 보내지 않고 데이터만 바꾼다("연결이 끊긴 사이 놓친 변경"을 흉내 낸다)
  if (url.pathname === '/__mutate') {
    const body = (await readBody(req)) as { table: TableName; id: string; patch: Row };
    const row = tables[body.table].find((r) => r.id === body.id);
    if (!row) return send(res, 404, { message: 'no row' });
    Object.assign(row, body.patch);
    if (body.table === 'tasks') row.updated_at = now();
    return send(res, 200, row);
  }
  if (url.pathname === '/__state') {
    return send(res, 200, Object.fromEntries(Object.entries(tables)));
  }

  if (outage) return send(res, 503, { message: 'outage' });

  try {
    const rpcMatch = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
    if (rpcMatch && req.method === 'POST') {
      rpc(rpcMatch[1] as string, ((await readBody(req)) ?? {}) as Row);
      return send(res, 204);
    }

    const match = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
    const table = match?.[1] as TableName | undefined;
    if (!table || !(table in tables)) return send(res, 404, { message: 'not found' });

    if (req.method === 'GET') {
      let rows = visibleRows(table).filter((r) => matchesFilters(r, url.searchParams));
      rows = sortRows(rows, url.searchParams.getAll('order'));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = url.searchParams.has('limit')
        ? Number(url.searchParams.get('limit'))
        : rows.length;
      return respondRows(req, res, rows.slice(offset, offset + limit), 200);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const inputs = (Array.isArray(body) ? body : [body]) as Row[];
      const created: Row[] = [];
      for (const input of inputs) {
        const row = withDefaults(table, input);
        validate(table, row);
        tables[table].push(row);
        created.push(row);
        emitChange(table, 'INSERT', row, null);
      }
      if (!wantsRepresentation(req)) return send(res, 201);
      return respondRows(req, res, created, 201);
    }

    if (req.method === 'PATCH') {
      const patch = (await readBody(req)) as Row;
      const targets = visibleRows(table).filter((r) => matchesFilters(r, url.searchParams));
      const updated: Row[] = [];
      for (const row of targets) {
        const old = { ...row };
        const next: Row = { ...row, ...patch };
        if (table === 'tasks') {
          next.updated_at = now();
          next.created_at = old.created_at;
          next.title = String(next.title).trim();
        }
        validate(table, next, old);
        Object.assign(row, next);
        updated.push(row);
        emitChange(table, 'UPDATE', row, old);
      }
      if (!wantsRepresentation(req)) return send(res, 204);
      return respondRows(req, res, updated, 200);
    }

    if (req.method === 'DELETE') {
      return send(res, 401, { code: '42501', message: `permission denied for table ${table}` });
    }
    return send(res, 405, { message: 'method not allowed' });
  } catch (error) {
    if (error instanceof HttpError)
      return send(res, error.status, { code: error.code, message: error.message });
    console.error(error);
    return send(res, 500, { message: String(error) });
  }
}

const server = createServer((req, res) => {
  void handle(req, res);
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (outage || !req.url?.startsWith('/realtime/v1/websocket')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws: WebSocket) => {
  const client: Client = { ws, topic: '', joinRef: null, subs: [] };
  clients.add(client);

  ws.on('message', (raw) => {
    const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw)) as [
      string | null,
      string | null,
      string,
      string,
      { config?: { postgres_changes?: { event: string; table: string }[] } },
    ];
    const reply = (response: unknown) =>
      ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));

    if (event === 'phx_join') {
      client.topic = topic;
      client.joinRef = joinRef;
      client.subs = (payload.config?.postgres_changes ?? []).map((f) => ({
        id: nextSubId++,
        event: f.event,
        table: f.table,
      }));
      reply({
        postgres_changes: client.subs.map((s) => ({
          id: s.id,
          event: s.event,
          schema: 'public',
          table: s.table,
        })),
      });
    } else if (event === 'heartbeat' || event === 'access_token' || event === 'phx_leave') {
      reply({});
    }
  });
  ws.on('close', () => clients.delete(client));
});

reset((process.env.MOCK_SEED as 'empty' | 'sample' | 'full' | undefined) ?? 'sample');
server.listen(PORT, () => console.log(`mock supabase listening on http://localhost:${PORT}`));
