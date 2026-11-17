-- Fixes from the security review of 0001.

-- HIGH: parent links need the student's approval. Requests park in "pendingParentId";
-- only "parentId" grants visibility (can_see_user / can_see_class).
alter table profiles add column "pendingParentId" uuid references profiles(id) on delete set null;

create function answer_parent_request(p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null or me.role <> 'STUDENT' or me."pendingParentId" is null then return; end if;
  update profiles set "parentId" = case when p_accept then "pendingParentId" else "parentId" end, "pendingParentId" = null where id = me.id;
end $$;

-- HIGH: the directory view no longer lists every student platform-wide.
-- Rows: self, same school, same department (employees), staff/community/admin roles, and people
-- who chose to appear publicly (active listing owners, event organisers). Grade/points/school are
-- only shown to the same school (or super admins).
drop view public_profiles;
create view public_profiles as
  select p.id, p.name, p.avatar, p.role, p.active, p.department, p.community,
    case when visible_school then p.points end as points,
    case when visible_school then p.grade end as grade,
    case when visible_school then p."schoolId" end as "schoolId"
  from profiles p
  cross join lateral (select me.* from profiles me where me.id = auth.uid() and me.active) me
  cross join lateral (select (p.id = me.id or me.role = 'SUPER_ADMIN' or (p."schoolId" is not null and p."schoolId" = me."schoolId")) as visible_school) v
  where visible_school
     or (p.role = 'EMPLOYEE' and me.role = 'EMPLOYEE' and p.department = me.department)
     or p.role in ('TEACHER', 'SCHOOL_ADMIN', 'COMMUNITY', 'SUPER_ADMIN', 'HEALTH_MONITOR')
     or exists (select 1 from listings l where l."ownerId" = p.id and l.active)
     or exists (select 1 from events e where e."organizerId" = p.id);
revoke all on public_profiles from anon;
grant select on public_profiles to authenticated;

-- Cross-school leaderboard as totals only (no individual students leave the function).
create function school_totals() returns table (id uuid, name text, points bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, coalesce(sum(p.points) filter (where p.role = 'STUDENT' and p.active), 0)
  from schools s left join profiles p on p."schoolId" = s.id
  where auth.uid() is not null
  group by s.id, s.name
$$;

-- MEDIUM: challenge joins happen server-side only (joinedAt can't be backdated), and expired challenges can't be claimed.
drop policy "join a challenge" on challenge_joins;
create or replace function claim_challenge(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); j challenge_joins; c challenges; done real;
begin
  if me.id is null then return; end if;
  select * into j from challenge_joins where "userId" = me.id and "challengeId" = p_challenge for update;
  if j."userId" is null or j.completed then return; end if;
  select * into c from challenges where id = p_challenge;
  if c."endsAt" < now() then return; end if;
  select coalesce(sum("weightKg"), 0) into done from scans where "userId" = me.id and "wasteType" = c."wasteType" and "createdAt" >= j."joinedAt";
  if done < c."targetKg" then return; end if;
  update challenge_joins set completed = true, "completedAt" = now() where "userId" = me.id and "challengeId" = p_challenge;
  update profiles set points = points + c."rewardPoints" where id = me.id;
end $$;

-- LOW: approving tasks requires an active teacher profile, not just a still-valid JWT.
create or replace function approve_task(p_task uuid, p_student uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); t tasks;
begin
  if me.id is null or me.role <> 'TEACHER' then return; end if;
  select * into t from tasks where id = p_task and "creatorId" = me.id;
  if t.id is null then return; end if;
  update task_dones set approved = true where "taskId" = p_task and "userId" = p_student and not approved;
  if not found then return; end if;
  update profiles set points = points + t.points where id = p_student;
  insert into notifications ("userId", kind, title, body) values (p_student, 'TASK', 'Task approved: ' || t.title, '+' || t.points || ' green points');
end $$;

-- LOW: the hourly scan limit can't be raced by parallel requests.
create or replace function log_scan(p_label text, p_type "WasteType", p_confidence real, p_weight real)
returns int language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); pts int := waste_points(p_type);
begin
  if me.id is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext(me.id::text));
  if (select count(*) from scans where "userId" = me.id and "createdAt" > now() - interval '1 hour') >= 60 then
    raise exception 'Scan limit reached for this hour. Take a break!';
  end if;
  insert into scans ("userId", label, "wasteType", confidence, "weightKg", points) values (me.id, left(trim(p_label), 80), p_type, p_confidence, p_weight, pts);
  update profiles set points = points + pts where id = me.id;
  return pts;
end $$;

-- LOW: RSVPs only by active users, for events they can see that haven't started.
drop policy "rsvp myself" on event_rsvps;
create policy "rsvp myself" on event_rsvps for insert to authenticated with check (
  "userId" = auth.uid() and (my_profile()).id is not null
  and exists (select 1 from events e where e.id = "eventId" and e."startsAt" > now()));

revoke execute on all functions in schema public from anon, public;
grant execute on function log_scan, redeem, claim_challenge, approve_task, scans_in_scope, my_profile, can_see_user, can_see_class,
  waste_points, answer_parent_request, school_totals to authenticated;
