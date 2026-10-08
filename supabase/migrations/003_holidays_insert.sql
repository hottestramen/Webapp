-- 003_holidays_insert.sql — 임시공휴일 등록을 위해 holidays INSERT 허용
--
-- [변경 이유] 002_rls.sql 은 PRD §5.4 에 따라 holidays 를 SELECT 만 허용했다.
-- 그런데 PRD §4.8 은 "임시공휴일은 설정 화면에서 추가한다"고 정하고 있어(P1),
-- 설정 화면에서 날짜·이름을 등록하려면 anon 에게 INSERT 가 필요하다.
--
-- [범위] INSERT 만 추가한다. UPDATE·DELETE 는 여전히 허용하지 않는다.
--   - 잘못 넣은 임시공휴일의 수정·삭제는 관리자가 Supabase 콘솔에서 한다.
--   - 값 검증은 001_init.sql 의 PK(date) 와 CHECK(name 1~30자)가 맡는다.
-- [한계] 인증이 없으므로 누가 등록하는지는 구분하지 못한다(002_rls.sql 상단 설명과 같다).
--
-- 적용 순서: 001_init.sql → 002_rls.sql → 003_holidays_insert.sql

grant insert on public.holidays to anon;

create policy holidays_insert on public.holidays
  for insert to anon with check (true);
