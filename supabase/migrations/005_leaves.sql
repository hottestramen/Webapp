-- 005_leaves.sql — 팀원 휴가 표시
--
-- 휴가는 "누가 언제 쉬는지"를 캘린더에 보여 주기 위한 기록이다(할일과는 별개).
-- 기존 규칙(PRD §5.4)을 그대로 따른다:
--   * RLS 켬. anon 은 SELECT/INSERT/UPDATE 만, DELETE 는 권한 자체를 주지 않는다.
--   * 삭제는 deleted_at 소프트 삭제. SELECT 정책이 deleted_at is null 이라 직접 UPDATE 로는
--     삭제할 수 없어(002 참고) SECURITY DEFINER 함수 soft_delete_leave 로 처리한다.
--   * 값 제약은 CHECK 로도 건다.
--
-- 적용 순서: 001 → 002 → 003 → 004 → 005

create table public.leaves (
  id         uuid        primary key default gen_random_uuid(),
  member_id  uuid        not null references public.members (id),
  kind       text        not null default 'annual',
  start_date date        not null,
  end_date   date        not null,
  note       text,
  created_by text        not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leaves_kind_values   check (kind in ('annual', 'half-am', 'half-pm', 'sick', 'other')),
  constraint leaves_period_order  check (end_date >= start_date),
  -- 너무 긴 기간은 입력 실수일 가능성이 크다(최대 90일, 시작일 포함 91일)
  constraint leaves_period_length check (end_date - start_date <= 90),
  -- 반차는 하루만
  constraint leaves_half_one_day  check (kind not in ('half-am', 'half-pm') or start_date = end_date),
  constraint leaves_note_length   check (note is null or char_length(note) <= 50),
  constraint leaves_created_by_length check (char_length(btrim(created_by)) between 1 and 20)
);

create index leaves_period_idx on public.leaves (start_date, end_date) where deleted_at is null;
create index leaves_member_idx on public.leaves (member_id);

-- 비활성 팀원에게 새 휴가를 등록할 수 없다(담당자 지정과 같은 규칙)
create function public.leaves_before_write() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.member_id is distinct from old.member_id)
     and not exists (select 1 from public.members m where m.id = new.member_id and m.active)
  then
    raise exception '비활성 팀원의 휴가는 등록할 수 없습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger leaves_before_write
  before insert or update on public.leaves
  for each row execute function public.leaves_before_write();

-- RLS ------------------------------------------------------------------------
alter table public.leaves enable row level security;

revoke all on public.leaves from anon, authenticated;
grant select, insert, update on public.leaves to anon;

create policy leaves_select on public.leaves
  for select to anon using (deleted_at is null);

create policy leaves_insert on public.leaves
  for insert to anon with check (true);

create policy leaves_update on public.leaves
  for update to anon using (true) with check (true);

-- 소프트 삭제 함수 (deleted_at 만 바꾼다)
create function public.soft_delete_leave(p_id uuid) returns void
language sql security definer set search_path = public as $fn$
  update public.leaves set deleted_at = now() where id = p_id and deleted_at is null;
$fn$;

revoke all on function public.soft_delete_leave(uuid) from public;
grant execute on function public.soft_delete_leave(uuid) to anon;

-- 실시간(004 와 같은 방식): 발행에 추가 + 소프트 삭제 알림 트리거
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leaves'
     )
  then
    alter publication supabase_realtime add table public.leaves;
  end if;
end;
$$;

create trigger leaves_notify_soft_delete
  after update of deleted_at on public.leaves
  for each row execute function public.notify_soft_delete();
