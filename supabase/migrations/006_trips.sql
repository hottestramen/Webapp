-- 006: 출장(trip) 종류 추가. 휴가(leaves) 테이블을 함께 쓰며, 종류 CHECK 만 넓힌다.
alter table leaves drop constraint leaves_kind_values;
alter table leaves add constraint leaves_kind_values
  check (kind in ('annual', 'half-am', 'half-pm', 'sick', 'other', 'trip'));
