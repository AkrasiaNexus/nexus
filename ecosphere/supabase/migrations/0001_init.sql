-- EcoSphere AI on Supabase: schema, row-level security and atomic RPCs.
-- Column names are camelCase (quoted) to match the app's TypeScript objects 1:1.

create extension if not exists pgcrypto;

create type "Role" as enum ('STUDENT','PARENT','EMPLOYEE','SCHOOL_ADMIN','COMMUNITY','SUPER_ADMIN','TEACHER','HEALTH_MONITOR');
create type "WasteType" as enum ('PLASTIC','PAPER','GLASS','METAL','ORGANIC','EWASTE','TEXTILE','OTHER');
create type "NoticeKind" as enum ('ANNOUNCEMENT','CHALLENGE','PICKUP','EVENT','TASK','HEALTH');

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null
);

-- One row per Supabase Auth user.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  "memberId" text not null unique,
  email text not null unique,
  name text not null check (char_length(name) between 2 and 60),
  role "Role" not null,
  points int not null default 0 check (points >= 0),
  avatar text not null default '🌱',
  grade text,
  department text,
  community text,
  active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "schoolId" uuid references schools(id),
  "parentId" uuid references profiles(id) on delete set null
);
create index on profiles ("schoolId", grade);
create index on profiles ("parentId");

create table scans (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  "wasteType" "WasteType" not null,
  confidence real not null check (confidence between 0 and 1),
  "weightKg" real not null check ("weightKg" > 0 and "weightKg" <= 50),
  points int not null,
  "createdAt" timestamptz not null default now()
);
create index on scans ("userId", "createdAt");

create table listings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'REWARD' check (kind in ('REWARD','SELL','DONATE','EXCHANGE')),
  title text not null,
  description text not null,
  category text not null,
  emoji text not null,
  "pricePoints" int not null check ("pricePoints" >= 0),
  stock int not null check (stock >= 0),
  active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "ownerId" uuid references profiles(id) on delete set null
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references profiles(id) on delete cascade,
  "listingId" uuid not null references listings(id) on delete cascade,
  points int not null,
  "createdAt" timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references profiles(id) on delete cascade, -- null = broadcast to everyone
  kind "NoticeKind" not null,
  title text not null,
  body text not null,
  "createdAt" timestamptz not null default now()
);
create index on notifications ("userId", "createdAt");

create table challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  "wasteType" "WasteType" not null,
  "targetKg" real not null,
  "rewardPoints" int not null,
  "endsAt" timestamptz not null
);

create table challenge_joins (
  "userId" uuid not null references profiles(id) on delete cascade,
  "challengeId" uuid not null references challenges(id) on delete cascade,
  completed boolean not null default false,
  "completedAt" timestamptz,
  "joinedAt" timestamptz not null default now(),
  primary key ("userId", "challengeId")
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  "actorId" uuid references profiles(id) on delete set null,
  action text not null,
  detail text not null default '',
  "createdAt" timestamptz not null default now()
);
create index on audit_logs (action, detail, "createdAt");

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  "className" text not null,
  "schoolId" uuid not null references schools(id),
  points int not null check (points between 0 and 200),
  "dueAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "creatorId" uuid not null references profiles(id) on delete cascade
);

create table task_dones (
  "taskId" uuid not null references tasks(id) on delete cascade,
  "userId" uuid not null references profiles(id) on delete cascade,
  approved boolean not null default false,
  "doneAt" timestamptz not null default now(),
  primary key ("taskId", "userId")
);

create table health_reports (
  id uuid primary key default gen_random_uuid(),
  "schoolId" uuid not null references schools(id),
  "className" text not null,
  "reporterId" uuid not null references profiles(id) on delete cascade,
  "airQuality" text not null check ("airQuality" in ('GOOD','MODERATE','POOR')),
  "temperatureC" real not null,
  hygiene int not null check (hygiene between 1 and 5),
  cleaning text not null check (cleaning in ('CLEAN','IN_PROGRESS','NEEDS_CLEANING')),
  "wasteLevel" text not null check ("wasteLevel" in ('LOW','MEDIUM','FULL')),
  present int not null,
  total int not null check (total >= 1 and present between 0 and total),
  incident text not null default '',
  "createdAt" timestamptz not null default now()
);
create index on health_reports ("schoolId", "className", "createdAt");

create table events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('EVENT','WORKSHOP','CAMPAIGN','PROGRAM')),
  title text not null,
  description text not null,
  location text not null,
  "startsAt" timestamptz not null,
  "schoolId" uuid references schools(id), -- null = open to everyone
  "organizerId" uuid references profiles(id) on delete set null
);

create table event_rsvps (
  "eventId" uuid not null references events(id) on delete cascade,
  "userId" uuid not null references profiles(id) on delete cascade,
  primary key ("eventId", "userId")
);

create table user_badges (
  "userId" uuid not null references profiles(id) on delete cascade,
  "badgeId" text not null,
  "earnedAt" timestamptz not null default now(),
  primary key ("userId", "badgeId")
);

create table settings (key text primary key, value text not null);

-- ── Who am I? (SECURITY DEFINER so policies can read the caller's profile without recursion)
create function my_profile() returns profiles language sql stable security definer set search_path = public as
  $$ select * from profiles where id = auth.uid() and active $$;

-- Can the caller see this user's personal records? Mirrors the app's role scopes.
create function can_see_user(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles t, profiles me
    where t.id = uid and me.id = auth.uid() and me.active and (
      t.id = me.id
      or me.role = 'SUPER_ADMIN'
      or (me.role = 'SCHOOL_ADMIN' and t."schoolId" = me."schoolId")
      or t."parentId" = me.id
      or (me.role in ('TEACHER','HEALTH_MONITOR') and t.role = 'STUDENT' and t."schoolId" = me."schoolId" and t.grade = me.grade)
    ))
$$;

-- Can the caller see a class's records (tasks, health reports)?
create function can_see_class(school uuid, cls text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles me where me.id = auth.uid() and me.active and (
      me.role = 'SUPER_ADMIN'
      or (me."schoolId" = school and (me.role = 'SCHOOL_ADMIN' or me.grade = cls))
      or exists (select 1 from profiles c where c."parentId" = me.id and c."schoolId" = school and c.grade = cls)))
$$;

-- Display-safe directory for names on leaderboards, listings, events and tasks (no email).
create view public_profiles as
  select id, name, avatar, points, role, grade, "schoolId", department, community, active from profiles;

-- ── Row-level security: reads follow role scopes; every write goes through the server or an RPC.
alter table schools enable row level security;
alter table profiles enable row level security;
alter table scans enable row level security;
alter table listings enable row level security;
alter table purchases enable row level security;
alter table notifications enable row level security;
alter table challenges enable row level security;
alter table challenge_joins enable row level security;
alter table audit_logs enable row level security;
alter table tasks enable row level security;
alter table task_dones enable row level security;
alter table health_reports enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table user_badges enable row level security;
alter table settings enable row level security;

create policy "schools readable" on schools for select using (true);
create policy "profiles in scope" on profiles for select to authenticated using (can_see_user(id));
create policy "scans in scope" on scans for select to authenticated using (can_see_user("userId"));
create policy "listings visible" on listings for select to authenticated using (active or "ownerId" = auth.uid());
create policy "own purchases" on purchases for select to authenticated using (can_see_user("userId"));
create policy "own or broadcast notices" on notifications for select to authenticated using ("userId" = auth.uid() or "userId" is null);
create policy "challenges readable" on challenges for select to authenticated using (true);
create policy "joins in scope" on challenge_joins for select to authenticated using (can_see_user("userId"));
create policy "join a challenge" on challenge_joins for insert to authenticated with check ("userId" = auth.uid() and completed = false);
create policy "audit for super admins" on audit_logs for select to authenticated using ((my_profile()).role = 'SUPER_ADMIN');
create policy "tasks for the class" on tasks for select to authenticated using (can_see_class("schoolId", "className") or "creatorId" = auth.uid());
create policy "task progress in scope" on task_dones for select to authenticated
  using (can_see_user("userId") or exists (select 1 from tasks t where t.id = "taskId" and t."creatorId" = auth.uid()));
create policy "health for the class" on health_reports for select to authenticated using (can_see_class("schoolId", "className"));
create policy "events visible" on events for select to authenticated
  using ("schoolId" is null or "schoolId" = (my_profile())."schoolId" or (my_profile()).role = 'SUPER_ADMIN'
         or exists (select 1 from profiles c where c."parentId" = auth.uid() and c."schoolId" = events."schoolId"));
create policy "rsvp counts readable" on event_rsvps for select to authenticated using (true);
create policy "rsvp myself" on event_rsvps for insert to authenticated with check ("userId" = auth.uid());
create policy "un-rsvp myself" on event_rsvps for delete to authenticated using ("userId" = auth.uid());
create policy "badges in scope" on user_badges for select to authenticated using (can_see_user("userId"));
create policy "settings readable" on settings for select to authenticated using (true);

-- The display view runs with its owner's rights; only signed-in users may read it.
revoke all on public_profiles from anon;
grant select on public_profiles to authenticated;

-- ── Atomic RPCs: points and stock only ever change inside one transaction here.
create function waste_points(t "WasteType") returns int language sql immutable as
  $$ select case t when 'EWASTE' then 15 when 'TEXTILE' then 15 when 'OTHER' then 2 else 10 end $$;

create function log_scan(p_label text, p_type "WasteType", p_confidence real, p_weight real)
returns int language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); pts int := waste_points(p_type);
begin
  if me.id is null then raise exception 'not signed in'; end if;
  if (select count(*) from scans where "userId" = me.id and "createdAt" > now() - interval '1 hour') >= 60 then
    raise exception 'Scan limit reached for this hour. Take a break!';
  end if;
  insert into scans ("userId", label, "wasteType", confidence, "weightKg", points) values (me.id, left(trim(p_label), 80), p_type, p_confidence, p_weight, pts);
  update profiles set points = points + pts where id = me.id;
  return pts;
end $$;

create function redeem(p_listing uuid) returns text language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); l listings;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into l from listings where id = p_listing for update;
  if l.id is null or not l.active or l.stock < 1 then raise exception 'No longer available.'; end if;
  if l."ownerId" = me.id then raise exception 'That''s your own listing.'; end if;
  update profiles set points = points - l."pricePoints" where id = me.id and points >= l."pricePoints";
  if not found then raise exception 'Not enough points.'; end if;
  update listings set stock = stock - 1, active = case when "ownerId" is not null and stock = 1 then false else active end where id = l.id;
  insert into purchases ("userId", "listingId", points) values (me.id, l.id, l."pricePoints");
  if l."ownerId" is not null then
    update profiles set points = points + l."pricePoints" where id = l."ownerId";
    insert into notifications ("userId", kind, title, body) values (l."ownerId", 'ANNOUNCEMENT',
      me.name || ' claimed "' || l.title || '"', 'Arrange hand-over with ' || me.name || ' (ID ' || me."memberId" || ').');
  end if;
  insert into audit_logs ("actorId", action, detail) values (me.id, 'REDEEM', l.title);
  return case when l."ownerId" is not null then 'Claimed! The owner has been notified.' else 'Redeemed ' || l.title || '!' end;
end $$;

create function claim_challenge(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); j challenge_joins; c challenges; done real;
begin
  select * into j from challenge_joins where "userId" = me.id and "challengeId" = p_challenge for update;
  if j."userId" is null or j.completed then return; end if;
  select * into c from challenges where id = p_challenge;
  select coalesce(sum("weightKg"), 0) into done from scans where "userId" = me.id and "wasteType" = c."wasteType" and "createdAt" >= j."joinedAt";
  if done < c."targetKg" then return; end if;
  update challenge_joins set completed = true, "completedAt" = now() where "userId" = me.id and "challengeId" = p_challenge;
  update profiles set points = points + c."rewardPoints" where id = me.id;
end $$;

create function approve_task(p_task uuid, p_student uuid) returns void language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task and "creatorId" = auth.uid();
  if t.id is null then return; end if;
  update task_dones set approved = true where "taskId" = p_task and "userId" = p_student and not approved;
  if not found then return; end if;
  update profiles set points = points + t.points where id = p_student;
  insert into notifications ("userId", kind, title, body) values (p_student, 'TASK', 'Task approved: ' || t.title, '+' || t.points || ' green points');
end $$;

-- Aggregate-only scan rows for wider scopes (no user identity leaves the function).
create function scans_in_scope(p_scope text, p_since timestamptz default null, p_until timestamptz default null)
returns table ("wasteType" "WasteType", "weightKg" real, "createdAt" timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null then return; end if;
  return query select s."wasteType", s."weightKg", s."createdAt" from scans s join profiles u on u.id = s."userId"
  where (p_since is null or s."createdAt" >= p_since) and (p_until is null or s."createdAt" < p_until) and case p_scope
    when 'me' then u.id = me.id
    when 'children' then u."parentId" = me.id
    when 'class' then u.role = 'STUDENT' and u."schoolId" = me."schoolId" and u.grade = me.grade
    when 'school' then u."schoolId" = me."schoolId" and me."schoolId" is not null
    when 'department' then u.role = 'EMPLOYEE' and u.department = me.department and me.role = 'EMPLOYEE'
    when 'community' then u.role = 'COMMUNITY' and (me.community is null or u.community = me.community)
    when 'platform' then true
    else false end;
end $$;

-- Lock RPCs to signed-in users only.
revoke execute on all functions in schema public from anon, public;
grant execute on function log_scan, redeem, claim_challenge, approve_task, scans_in_scope, my_profile, can_see_user, can_see_class, waste_points to authenticated;
