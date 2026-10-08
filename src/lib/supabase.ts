import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** .env 가 비어 있으면 false. 앱은 이 값을 보고 설정 안내 화면을 먼저 보여준다. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// 클라이언트에는 anon key 만 쓴다. service_role key 는 절대 넣지 않는다(PRD §5.4).
// 미설정일 때도 모듈 로딩이 깨지지 않도록 자리표시 값으로 만든다(실제 호출은 일어나지 않는다).
export const supabase = createClient(
  url || 'http://localhost.invalid',
  anonKey || 'missing-anon-key',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
