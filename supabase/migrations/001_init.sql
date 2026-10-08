-- 001_init.sql — 부서 공용 업무 캘린더 스키마 (PRD §4.8)
-- Supabase SQL Editor 에서 이 파일 → 002_rls.sql 순서로 실행한다.
-- 모든 길이·값 제약은 CHECK 제약으로 건다(클라이언트 검증만 믿지 않는다, PRD §5.4).

-- ---------------------------------------------------------------------------
-- members (팀원)
-- ---------------------------------------------------------------------------
create table public.members (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  color      text        not null default 'avatar-1',
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  constraint members_name_length check (char_length(btrim(name)) between 1 and 20),
  constraint members_color_key   check (color ~ '^avatar-[1-8]$')
);

-- 활성 팀원끼리만 이름 중복 불가 (비활성 팀원과는 같은 이름 허용)
create unique index members_active_name_uniq on public.members (name) where active;

-- ---------------------------------------------------------------------------
-- categories (카테고리)
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null unique,
  color      text    not null,
  sort_order int     not null default 0,
  active     boolean not null default true,
  constraint categories_name_length check (char_length(btrim(name)) between 1 and 20),
  constraint categories_color_key   check (color ~ '^cat-[1-8]$')
);

-- ---------------------------------------------------------------------------
-- tasks (할일)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  status       text        not null default 'todo',
  priority     text        not null default 'medium',
  assignee_id  uuid        references public.members (id),
  category_id  uuid        references public.categories (id),
  due_date     date,
  completed_at timestamptz,
  created_by   text        not null,
  updated_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint tasks_title_length        check (char_length(btrim(title)) between 1 and 100),
  constraint tasks_description_length  check (description is null or char_length(description) <= 2000),
  constraint tasks_status_values       check (status in ('todo', 'in-progress', 'done')),
  constraint tasks_priority_values     check (priority in ('high', 'medium', 'low')),
  constraint tasks_completed_at_done   check (completed_at is null or status = 'done'),
  constraint tasks_created_by_length   check (char_length(btrim(created_by)) between 1 and 20),
  constraint tasks_updated_by_length   check (char_length(btrim(updated_by)) between 1 and 20)
);

create index tasks_due_date_idx    on public.tasks (due_date) where deleted_at is null;
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_status_idx      on public.tasks (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- comments (댓글) — 수정 불가, 소프트 삭제만
-- ---------------------------------------------------------------------------
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.tasks (id),
  author_name text        not null,
  content     text        not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint comments_author_length  check (char_length(btrim(author_name)) between 1 and 20),
  constraint comments_content_length check (char_length(btrim(content)) between 1 and 1000)
);

create index comments_task_id_idx on public.comments (task_id, created_at);

-- ---------------------------------------------------------------------------
-- holidays (공휴일)
-- ---------------------------------------------------------------------------
create table public.holidays (
  date date primary key,
  name text not null,
  constraint holidays_name_length check (char_length(btrim(name)) between 1 and 30)
);

-- ---------------------------------------------------------------------------
-- 트리거
-- ---------------------------------------------------------------------------

-- tasks: 제목 공백 제거, 수정 때마다 updated_at 갱신(충돌 판정 기준, PRD §5.8),
--        id·created_at 변경 방지, 비활성 팀원 신규 지정 방지
create function public.tasks_before_write() returns trigger
language plpgsql as $$
begin
  new.title := btrim(new.title);

  if tg_op = 'UPDATE' then
    new.id         := old.id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (select 1 from public.members m where m.id = new.assignee_id and m.active)
  then
    raise exception '비활성 팀원은 담당자로 지정할 수 없습니다.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- comments: 내용 수정 불가(소프트 삭제 deleted_at 만 변경 허용)
create function public.comments_before_update() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.task_id is distinct from old.task_id
     or new.author_name is distinct from old.author_name
     or new.content is distinct from old.content
     or new.created_at is distinct from old.created_at
  then
    raise exception '댓글은 수정할 수 없고 삭제만 할 수 있습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger comments_before_update
  before update on public.comments
  for each row execute function public.comments_before_update();

-- ---------------------------------------------------------------------------
-- 초기 데이터: 카테고리 (PRD §4.8)
-- ---------------------------------------------------------------------------
insert into public.categories (name, color, sort_order) values
  ('보고', 'cat-1', 1),
  ('회의', 'cat-2', 2),
  ('기획', 'cat-3', 3),
  ('운영', 'cat-4', 4),
  ('교육', 'cat-5', 5),
  ('기타', 'cat-6', 6);

-- ---------------------------------------------------------------------------
-- 초기 데이터: 2026~2027년 법정 공휴일·대체공휴일
-- 법령·공고로 바뀔 수 있으므로 배포 전 관리자가 한 번 대조한다.
-- ---------------------------------------------------------------------------
insert into public.holidays (date, name) values
  -- 2026
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '대체공휴일(삼일절)'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '대체공휴일(부처님오신날)'),
  ('2026-06-03', '전국동시지방선거'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '대체공휴일(광복절)'),
  ('2026-09-24', '추석 연휴'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 연휴'),
  ('2026-09-28', '대체공휴일(추석)'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '대체공휴일(개천절)'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '성탄절'),
  -- 2027
  ('2027-01-01', '신정'),
  ('2027-02-06', '설날 연휴'),
  ('2027-02-07', '설날'),
  ('2027-02-08', '설날 연휴'),
  ('2027-02-09', '대체공휴일(설날)'),
  ('2027-03-01', '삼일절'),
  ('2027-05-05', '어린이날'),
  ('2027-05-13', '부처님오신날'),
  ('2027-06-06', '현충일'),
  ('2027-08-15', '광복절'),
  ('2027-08-16', '대체공휴일(광복절)'),
  ('2027-09-14', '추석 연휴'),
  ('2027-09-15', '추석'),
  ('2027-09-16', '추석 연휴'),
  ('2027-10-03', '개천절'),
  ('2027-10-04', '대체공휴일(개천절)'),
  ('2027-10-09', '한글날'),
  ('2027-10-11', '대체공휴일(한글날)'),
  ('2027-12-25', '성탄절'),
  ('2027-12-27', '대체공휴일(성탄절)');
