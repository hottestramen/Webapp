import type { PostgrestError } from '@supabase/supabase-js';
import { toApiError } from './errors';

// Supabase(PostgREST)는 한 번에 최대 1,000행만 돌려준다. 댓글 2,000건 같은 규모에서도
// 잘리지 않도록 페이지 단위로 끝까지 읽는다.
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw toApiError(error);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}
