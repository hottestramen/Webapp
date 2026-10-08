import { supabase } from '../supabase';
import type { Category, CategoryInsert, CategoryUpdate } from '../../types';
import { unwrap } from './errors';

export async function listCategories(): Promise<Category[]> {
  return unwrap<Category[]>(
    await supabase.from('categories').select('*').order('sort_order', { ascending: true }),
  );
}

export async function createCategory(input: CategoryInsert): Promise<Category> {
  return unwrap<Category>(await supabase.from('categories').insert(input).select().single());
}

export async function updateCategory(id: string, patch: CategoryUpdate): Promise<Category> {
  return unwrap<Category>(
    await supabase.from('categories').update(patch).eq('id', id).select().single(),
  );
}

/** 카테고리 숨김 처리(삭제 대신, F-T-08). */
export function hideCategory(id: string): Promise<Category> {
  return updateCategory(id, { active: false });
}
