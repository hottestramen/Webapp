-- 002_rls.sql — RLS 정책 (PRD §5.4)
--
-- [한계] 인증이 없으므로 RLS는 "어떤 작업을 허용할지"만 제한하고,
--        "누가 하는지"는 구분하지 못한다. URL과 anon key를 아는 사람은 누구나
--        허용된 작업(조회·등록·수정)을 할 수 있다. 내부 신뢰 환경에서만 충분한 수준이다.
--
-- 원칙
--  * 모든 테이블 RLS 활성화. RLS가 꺼진 테이블은 배포하지 않는다.
--  * anon: tasks·comments·members·categories 는 SELECT/INSERT/UPDATE 만. DELETE 정책은 만들지 않는다.
--          (삭제는 deleted_at 업데이트로만 한다. DELETE 권한도 함께 회수해 이중으로 막는다.)
--  * holidays 는 SELECT 만 허용한다.
--  * tasks·comments 의 SELECT 는 deleted_at is null 인 행만 반환한다.
--
-- [주의] SELECT 정책이 deleted_at is null 이므로, anon 이 직접 UPDATE 로 deleted_at 을 채우면
--        "갱신 후 행이 SELECT 정책을 통과하지 못한다"는 이유로 RLS 오류가 난다(PostgreSQL 동작).
--        그래서 소프트 삭제·실행 취소는 deleted_at 만 바꾸는 SECURITY DEFINER 함수로 제공한다.
--        함수는 파일 맨 아래에 있다. DELETE 는 여전히 어떤 경로로도 허용하지 않는다.

alter table public.tasks      enable row level security;
alter table public.comments   enable row level security;
alter table public.members    enable row level security;
alter table public.categories enable row level security;
alter table public.holidays   enable row level security;

-- 테이블 권한: 필요한 작업만 남긴다 (RLS 와 별개로 한 겹 더)
revoke all on public.tasks, public.comments, public.members, public.categories, public.holidays
  from anon, authenticated;

grant select, insert, update on public.tasks      to anon;
grant select, insert, update on public.members    to anon;
grant select, insert, update on public.categories to anon;
grant select                 on public.holidays   to anon;

-- 댓글은 수정 불가: UPDATE 는 deleted_at 컬럼에만 허용 (트리거로도 막혀 있다)
grant select, insert on public.comments to anon;
grant update (deleted_at) on public.comments to anon;

-- tasks ----------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to anon using (deleted_at is null);

create policy tasks_insert on public.tasks
  for insert to anon with check (true);

create policy tasks_update on public.tasks
  for update to anon using (true) with check (true);

-- comments -------------------------------------------------------------------
create policy comments_select on public.comments
  for select to anon using (deleted_at is null);

create policy comments_insert on public.comments
  for insert to anon with check (true);

create policy comments_update on public.comments
  for update to anon using (true) with check (true);

-- members --------------------------------------------------------------------
-- 비활성 팀원도 조회된다: 기존 할일에 이름을 유지해 보여주기 위해서다.
create policy members_select on public.members
  for select to anon using (true);

create policy members_insert on public.members
  for insert to anon with check (true);

create policy members_update on public.members
  for update to anon using (true) with check (true);

-- categories -----------------------------------------------------------------
create policy categories_select on public.categories
  for select to anon using (true);

create policy categories_insert on public.categories
  for insert to anon with check (true);

create policy categories_update on public.categories
  for update to anon using (true) with check (true);

-- holidays -------------------------------------------------------------------
create policy holidays_select on public.holidays
  for select to anon using (true);

-- 소프트 삭제 · 실행 취소 함수 -----------------------------------------------------
-- deleted_at(과 updated_by)만 바꾼다. 실행 취소(restore)는 삭제 후 1분 안의 행만 가능하다
-- (PRD F-T-03 의 5초 실행 취소용). 그 이후 복구는 관리자가 콘솔에서 한다.

create function public.soft_delete_task(p_id uuid, p_updated_by text) returns void
language sql security definer set search_path = public as $fn$
  update public.tasks
     set deleted_at = now(), updated_by = p_updated_by
   where id = p_id and deleted_at is null;
$fn$;

create function public.restore_task(p_id uuid, p_updated_by text) returns void
language sql security definer set search_path = public as $fn$
  update public.tasks
     set deleted_at = null, updated_by = p_updated_by
   where id = p_id and deleted_at > now() - interval '1 minute';
$fn$;

create function public.soft_delete_comment(p_id uuid) returns void
language sql security definer set search_path = public as $fn$
  update public.comments set deleted_at = now() where id = p_id and deleted_at is null;
$fn$;

revoke all on function public.soft_delete_task(uuid, text)    from public;
revoke all on function public.restore_task(uuid, text)        from public;
revoke all on function public.soft_delete_comment(uuid)       from public;
grant execute on function public.soft_delete_task(uuid, text) to anon;
grant execute on function public.restore_task(uuid, text)     to anon;
grant execute on function public.soft_delete_comment(uuid)    to anon;
