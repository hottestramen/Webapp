// 시드 데이터 생성기. scripts/seed.ts(실제 Supabase 로 업로드)와 scripts/mock-supabase.ts(로컬 목 서버)가 함께 쓴다.
// 난수는 고정 시드라서 실행할 때마다 같은 데이터가 나온다.

export interface SeedMember {
  id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
}

export interface SeedTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  category_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: null;
}

export interface SeedComment {
  id: string;
  task_id: string;
  author_name: string;
  content: string;
  created_at: string;
  deleted_at: null;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  '김하늘',
  '이도윤',
  '박서연',
  '최민준',
  '정하은',
  '강지후',
  '조수아',
  '윤태오',
  '장예린',
  '한지우',
  '오승현',
  '서다인',
];
const VERBS = [
  '보고서 작성',
  '회의 준비',
  '기획안 검토',
  '운영 점검',
  '교육 자료 정리',
  '예산 집계',
  '일정 조율',
  '자료 취합',
  '현황 공유',
  '결과 정리',
];
const COMMENTS = [
  '확인했습니다.',
  '자료 취합 완료, 내일 초안 공유합니다.',
  '일정 조율이 필요합니다.',
  '검토 의견 반영했습니다.',
  '내일 오전까지 마무리하겠습니다.',
];

/** 짧은 결정적 UUID 형식(v4 모양). 실제 UUID 와 형식만 같다. */
function uuid(rand: () => number): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function generateSeed(opts: {
  tasks?: number;
  comments?: number;
  categoryIds: string[];
  now?: Date;
}) {
  const rand = mulberry32(20261007);
  const now = opts.now ?? new Date();
  const taskCount = opts.tasks ?? 500;
  const commentCount = opts.comments ?? 2000;

  const members: SeedMember[] = NAMES.map((name, i) => ({
    id: uuid(rand),
    name,
    color: `avatar-${(i % 8) + 1}`,
    active: i < NAMES.length - 1,
    created_at: addDays(now, -90).toISOString(),
  }));

  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
  const statuses = ['todo', 'in-progress', 'done'] as const;
  const priorities = ['high', 'medium', 'low'] as const;

  const tasks: SeedTask[] = Array.from({ length: taskCount }, (_, i) => {
    const status = pick(statuses);
    const createdAt = addDays(now, -Math.floor(rand() * 60));
    const assignee = rand() < 0.1 ? null : pick(members.filter((m) => m.active));
    return {
      id: uuid(rand),
      title: `[${i + 1}] ${pick(VERBS)}`,
      description: rand() < 0.5 ? '시드 데이터 설명입니다. https://example.com/doc 참고' : null,
      status,
      priority: pick(priorities),
      assignee_id: assignee?.id ?? null,
      category_id: rand() < 0.8 ? pick(opts.categoryIds) : null,
      due_date: rand() < 0.85 ? ymd(addDays(now, Math.floor(rand() * 60) - 20)) : null,
      completed_at: status === 'done' ? addDays(now, -Math.floor(rand() * 56)).toISOString() : null,
      created_by: pick(NAMES),
      updated_by: pick(NAMES),
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      deleted_at: null,
    };
  });

  const comments: SeedComment[] = Array.from({ length: commentCount }, () => {
    const task = pick(tasks);
    return {
      id: uuid(rand),
      task_id: task.id,
      author_name: pick(NAMES),
      content: pick(COMMENTS),
      created_at: addDays(new Date(task.created_at), rand() * 5).toISOString(),
      deleted_at: null,
    };
  });

  return { members, tasks, comments };
}
