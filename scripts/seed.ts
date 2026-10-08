// 성능 점검용 시드: 할일 500건 · 댓글 2,000건 · 팀원 12명을 Supabase 에 넣는다(PRD §5.2 기준 환경).
//
//   npm run seed            (.env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 사용)
//   npm run seed -- --force (이미 할일이 있어도 추가)
//
// anon key 만 쓴다(service_role 키는 쓰지 않는다). RLS 에서 anon 은 DELETE 가 막혀 있으므로
// 시드를 지우려면 Supabase SQL Editor 에서 관리자 권한으로 지운다:
//   delete from comments where author_name in (select name from members where created_at >= '<시드 시각>');
// ※ 팀원 12명도 함께 들어가므로 실제 운영 프로젝트가 아니라 테스트 프로젝트에서만 실행한다.

import { createClient } from '@supabase/supabase-js';
import { generateSeed } from './seedData.ts';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 필요합니다(.env 를 만들어 두세요).');
  process.exit(1);
}

const force = process.argv.includes('--force');
const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

async function insertInBatches(table: string, rows: object[], size: number) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table} 입력 실패(${i}~): ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + size, rows.length)} / ${rows.length}`);
  }
  process.stdout.write('\n');
}

const { data: existing, error: checkError } = await supabase.from('tasks').select('id').limit(1);
if (checkError) throw new Error(`연결 확인 실패: ${checkError.message}`);
if ((existing?.length ?? 0) > 0 && !force) {
  console.error(
    '이미 할일이 있습니다. 실제 데이터를 섞지 않도록 중단합니다. 그래도 넣으려면 --force 를 붙이세요.',
  );
  process.exit(1);
}

const { data: categories, error: categoryError } = await supabase.from('categories').select('id');
if (categoryError || !categories?.length) {
  throw new Error('카테고리를 읽지 못했습니다. 001_init.sql 을 먼저 적용했는지 확인하세요.');
}

const seed = generateSeed({ categoryIds: categories.map((c) => c.id as string) });
console.log(
  `시드 생성: 팀원 ${seed.members.length}, 할일 ${seed.tasks.length}, 댓글 ${seed.comments.length}`,
);

await insertInBatches('members', seed.members, 50);
await insertInBatches('tasks', seed.tasks, 100);
await insertInBatches('comments', seed.comments, 200);
console.log('완료');
