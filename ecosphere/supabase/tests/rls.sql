-- Row-level security self-test. Impersonates users via request.jwt.claims, records PASS/FAIL,
-- then deletes its fixtures. Run as postgres (Management API). Every row must say PASS.
begin;
create temp table rls_results (test text, ok boolean, got text);
grant all on rls_results to authenticated, anon;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-student@eco.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'rls-other@eco.test',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'rls-parent@eco.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'rls-teacher@eco.test', 'authenticated', 'authenticated');
insert into schools (id, name, city) values ('00000000-0000-0000-0000-0000000000b1', 'RLS Test School', 'Test');
insert into profiles (id, "memberId", email, name, role, grade, "schoolId", "parentId") values
  ('00000000-0000-0000-0000-0000000000a3', 'RLS-P', 'rls-parent@eco.test',  'Rls Parent',  'PARENT',  null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'RLS-S', 'rls-student@eco.test', 'Rls Student', 'STUDENT', 'C1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a2', 'RLS-O', 'rls-other@eco.test',   'Rls Other',   'STUDENT', 'C2', '00000000-0000-0000-0000-0000000000b1', null),
  ('00000000-0000-0000-0000-0000000000a4', 'RLS-T', 'rls-teacher@eco.test', 'Rls Teacher', 'TEACHER', 'C1', '00000000-0000-0000-0000-0000000000b1', null);
insert into scans ("userId", label, "wasteType", confidence, "weightKg", points) values
  ('00000000-0000-0000-0000-0000000000a1', 'bottle', 'PLASTIC', 0.9, 1, 10),
  ('00000000-0000-0000-0000-0000000000a2', 'can', 'METAL', 0.9, 1, 10);
insert into listings (id, title, description, category, emoji, "pricePoints", stock) values
  ('00000000-0000-0000-0000-0000000000c1', 'RLS Bottle', 'x', 'Reuse', '🧴', 15, 1);

-- As the student
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into rls_results select 'student sees only own profile', count(*) = 1, count(*)::text from profiles where "memberId" like 'RLS-%';
insert into rls_results select 'student sees only own scans', count(*) = 1, count(*)::text from scans where label in ('bottle','can');
update profiles set points = 9999 where id = '00000000-0000-0000-0000-0000000000a1';
insert into rls_results select 'log_scan awards points atomically', log_scan('rls item', 'PLASTIC', 0.8, 0.5) = 10, 'ok';
insert into rls_results select 'class scope is aggregate & limited', count(*) = 2, count(*)::text from scans_in_scope('class') ;
insert into rls_results select 'student cannot read audit log', count(*) = 0, count(*)::text from audit_logs;

-- As the parent
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
insert into rls_results select 'parent sees self + child only', count(*) = 2, count(*)::text from profiles where "memberId" like 'RLS-%';
insert into rls_results select 'parent sees child scans', count(*) = 2, count(*)::text from scans where "userId" = '00000000-0000-0000-0000-0000000000a1';

-- As the teacher of class C1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
insert into rls_results select 'teacher sees own class student, not other class', count(*) = 2, string_agg("memberId", ',') from profiles where "memberId" like 'RLS-%';

-- Anonymous (no session)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into rls_results select 'anon sees no profiles', count(*) = 0, count(*)::text from profiles;

reset role;
insert into rls_results select 'points not 9999 after direct update attempt', points = 10, points::text from profiles where id = '00000000-0000-0000-0000-0000000000a1';

-- Cleanup fixtures
delete from listings where id = '00000000-0000-0000-0000-0000000000c1';
delete from auth.users where email like 'rls-%@eco.test';
delete from schools where id = '00000000-0000-0000-0000-0000000000b1';

commit;
select test, case when ok then 'PASS' else 'FAIL' end as result, got from rls_results;
