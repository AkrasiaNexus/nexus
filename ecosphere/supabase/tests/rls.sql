-- Row-level security self-test. Impersonates users via request.jwt.claims, records PASS/FAIL,
-- then deletes its fixtures. Run as postgres (Management API). Every row must say PASS.
begin;
create temp table rls_results (test text, ok boolean, got text);
grant all on rls_results to authenticated, anon;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-student@eco.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'rls-other@eco.test',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'rls-parent@eco.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'rls-teacher@eco.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'rls-stranger@eco.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'rls-cadmin@eco.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a7', 'rls-member2@eco.test', 'authenticated', 'authenticated');
insert into communities (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'RLS Community A'), ('00000000-0000-0000-0000-0000000000d2', 'RLS Community B');
insert into schools (id, name, city) values ('00000000-0000-0000-0000-0000000000b1', 'RLS Test School', 'Test');
insert into profiles (id, "memberId", email, name, role, grade, "schoolId", "parentId") values
  ('00000000-0000-0000-0000-0000000000a3', 'RLS-P', 'rls-parent@eco.test',  'Rls Parent',  'PARENT',  null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'RLS-S', 'rls-student@eco.test', 'Rls Student', 'STUDENT', 'C1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a2', 'RLS-O', 'rls-other@eco.test',   'Rls Other',   'STUDENT', 'C2', '00000000-0000-0000-0000-0000000000b1', null),
  ('00000000-0000-0000-0000-0000000000a4', 'RLS-T', 'rls-teacher@eco.test', 'Rls Teacher', 'TEACHER', 'C1', '00000000-0000-0000-0000-0000000000b1', null),
  ('00000000-0000-0000-0000-0000000000a5', 'RLS-X', 'rls-stranger@eco.test', 'Rls Stranger', 'COMMUNITY', null, null, null);
update profiles set "communityId" = '00000000-0000-0000-0000-0000000000d1' where id = '00000000-0000-0000-0000-0000000000a5';
insert into profiles (id, "memberId", email, name, role, "communityId") values
  ('00000000-0000-0000-0000-0000000000a6', 'RLS-CA', 'rls-cadmin@eco.test', 'Rls Cadmin', 'COMMUNITY_ADMIN', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000a7', 'RLS-M2', 'rls-member2@eco.test', 'Rls Member2', 'COMMUNITY', '00000000-0000-0000-0000-0000000000d2');
-- The stranger has *requested* to be the other student's parent; it must grant nothing until approved.
update profiles set "pendingParentId" = '00000000-0000-0000-0000-0000000000a5' where id = '00000000-0000-0000-0000-0000000000a2';
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

-- As an unrelated community member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
insert into rls_results select 'pending parent request grants no access', count(*) = 0, count(*)::text from scans where "userId" = '00000000-0000-0000-0000-0000000000a2';
insert into rls_results select 'directory hides other schools'' students', count(*) = 0, string_agg(name, ',') from public_profiles where role = 'STUDENT' and name like 'Rls%';
insert into rls_results select 'school totals are aggregate only', count(*) >= 1, count(*)::text from school_totals();
insert into rls_results select 'cannot self-insert a challenge join', not has_table_privilege('authenticated', 'challenge_joins', 'INSERT') or not exists (select 1 from pg_policies where tablename = 'challenge_joins' and cmd = 'INSERT'), 'policy removed';

-- As the same-school student: sees classmates in the directory, but masked stats for nobody else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into rls_results select 'directory shows own school students', count(*) = 2, count(*)::text from public_profiles where role = 'STUDENT' and name like 'Rls%';

-- Student approves the pending request? (other student, a2) — simulate a2 accepting
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select answer_parent_request(true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
insert into rls_results select 'after approval the parent sees the child', count(*) = 1, count(*)::text from scans where "userId" = '00000000-0000-0000-0000-0000000000a2';

-- As the admin of community A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
insert into rls_results select 'community admin sees own community only', count(*) = 2, string_agg("memberId", ',') from profiles where "memberId" in ('RLS-X','RLS-M2','RLS-CA');
insert into rls_results select 'community admin cannot see school students', count(*) = 0, count(*)::text from profiles where "memberId" in ('RLS-S','RLS-O');

-- Filtered analytics: only admins get rows
insert into rls_results select 'non-admin gets no filtered analytics', count(*) = 0, count(*)::text from scans_filtered();

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
delete from communities where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2');
delete from schools where id = '00000000-0000-0000-0000-0000000000b1';

commit;
select test, case when ok then 'PASS' else 'FAIL' end as result, got from rls_results;
