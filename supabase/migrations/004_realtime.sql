-- 004_realtime.sql — 실시간 동기화(PRD §5.7)를 위한 설정
--
-- 1) tasks·comments·members·categories 를 Realtime 발행(supabase_realtime)에 추가한다.
--    → 클라이언트가 postgres_changes 로 INSERT/UPDATE 를 구독할 수 있다.
--
-- 2) 소프트 삭제 알림 트리거.
--    [이유] 002_rls.sql 의 SELECT 정책이 deleted_at is null 인 행만 허용하므로, deleted_at 이 채워진
--    UPDATE(= 삭제)는 Realtime 이 anon 구독자에게 보내지 않는다(변경 후 행이 SELECT 정책을 통과하지 못함).
--    그래서 다른 팀원의 화면에서 삭제가 반영되지 않는다. 이를 보완하려고, 소프트 삭제가 일어나면
--    realtime.send(브로드캐스트)로 "soft-delete" 이벤트를 따로 보낸다. 내용(제목·본문)은 보내지 않고
--    테이블 이름·id·수정자 이름만 보낸다.
--    realtime.send 가 없는 환경(구버전 Supabase, 로컬 테스트)에서는 오류를 삼키고 넘어간다.
--    그 경우에도 탭 복귀·재연결·폴링 때의 전체 다시 불러오기로 삭제가 반영된다.
--
-- 적용 순서: 001 → 002 → 003 → 004

-- 1) Realtime 발행에 테이블 추가 (이미 들어 있거나 발행이 없으면 건너뛴다)
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tasks', 'comments', 'members', 'categories'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- 2) 소프트 삭제 브로드캐스트
create function public.notify_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    begin
      perform realtime.send(
        jsonb_build_object(
          'table', tg_table_name,
          'id', new.id,
          'updated_by', coalesce(to_jsonb(new) ->> 'updated_by', to_jsonb(new) ->> 'author_name')
        ),
        'soft-delete',
        'team-calendar',
        false
      );
    exception when others then
      null; -- 알림 실패가 삭제 자체를 막지 않게 한다
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_soft_delete() from public;

create trigger tasks_notify_soft_delete
  after update of deleted_at on public.tasks
  for each row execute function public.notify_soft_delete();

create trigger comments_notify_soft_delete
  after update of deleted_at on public.comments
  for each row execute function public.notify_soft_delete();
