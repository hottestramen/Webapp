import { supabase } from '../supabase';
import type { Holiday } from '../../types';
import { unwrap } from './errors';

// holidays 는 조회와 등록만 가능하다(RLS: SELECT + 003_holidays_insert.sql 의 INSERT). 수정·삭제는 관리자가 콘솔에서 한다.
export async function listHolidays(): Promise<Holiday[]> {
  return unwrap<Holiday[]>(
    await supabase.from('holidays').select('*').order('date', { ascending: true }),
  );
}

/** 임시공휴일 등록(설정 화면). 같은 날짜가 있으면 중복(23505) 오류가 난다. */
export async function createHoliday(input: Holiday): Promise<Holiday> {
  return unwrap<Holiday>(await supabase.from('holidays').insert(input).select().single());
}
