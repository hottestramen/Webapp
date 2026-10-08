-- 007_harden_functions.sql — Supabase 보안 어드바이저 경고 정리
--
-- 1) 트리거 함수 3개에 search_path 를 고정한다(function_search_path_mutable).
-- 2) notify_soft_delete() 는 트리거 전용이라 /rest/v1/rpc 로 호출될 이유가 없다.
--    anon·authenticated 의 EXECUTE 를 회수한다(트리거 실행에는 호출자 권한이 필요 없다).
--
-- [의도적으로 남기는 경고] soft_delete_task / restore_task / soft_delete_comment / soft_delete_leave 는
--   SELECT 정책(deleted_at is null) 때문에 anon 이 직접 UPDATE 로 소프트 삭제를 할 수 없어
--   SECURITY DEFINER 함수로 제공한다(002 참고). anon 이 호출해야 하므로 EXECUTE 를 유지한다.
--
-- 적용 순서: 001 → … → 006 → 007

alter function public.tasks_before_write()      set search_path = public;
alter function public.comments_before_update()  set search_path = public;
alter function public.leaves_before_write()     set search_path = public;

revoke execute on function public.notify_soft_delete() from anon, authenticated;
