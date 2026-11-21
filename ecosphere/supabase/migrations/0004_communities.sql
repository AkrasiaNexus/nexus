-- Communities become real records with admins, campaigns and collection points.
-- Non-destructive: the old free-text profiles.community stays (kept in sync for display).

create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  city text not null default '',
  description text not null default '',
  "createdAt" timestamptz not null default now()
);
alter table profiles add column "communityId" uuid references communities(id);
create index on profiles ("communityId");

-- Backfill from the existing free-text field.
insert into communities (name) select distinct community from profiles where community is not null on conflict do nothing;
update profiles p set "communityId" = c.id from communities c where p.community = c.name and p."communityId" is null;

-- Events (campaigns) can belong to a community.
alter table events add column "communityId" uuid references communities(id);

-- Collection points managed by community admins (null community = platform-wide, managed by super admins).
create table collection_points (
  id uuid primary key default gen_random_uuid(),
  "communityId" uuid references communities(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  address text not null default '',
  accepts text not null default '',
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

-- Teachers can create class challenges; null school = platform-wide challenge.
alter table challenges add column "schoolId" uuid references schools(id);
alter table challenges add column "className" text;
alter table challenges add column "creatorId" uuid references profiles(id) on delete set null;

alter table communities enable row level security;
alter table collection_points enable row level security;
create policy "communities readable" on communities for select using (true); -- names are public (signup picker)
create policy "collection points readable" on collection_points for select to authenticated using (active or (my_profile()).role in ('COMMUNITY_ADMIN','SUPER_ADMIN'));

-- Community admins see their own community's members.
create or replace function can_see_user(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles t, profiles me
    where t.id = uid and me.id = auth.uid() and me.active and (
      t.id = me.id
      or me.role = 'SUPER_ADMIN'
      or (me.role = 'SCHOOL_ADMIN' and t."schoolId" = me."schoolId")
      or t."parentId" = me.id
      or (me.role in ('TEACHER','HEALTH_MONITOR') and t.role = 'STUDENT' and t."schoolId" = me."schoolId" and t.grade = me.grade)
      or (me.role = 'COMMUNITY_ADMIN' and t."communityId" = me."communityId" and t.role in ('COMMUNITY','COMMUNITY_ADMIN'))
    ))
$$;

-- Events: open ones, my school's, my children's schools', and my community's.
drop policy "events visible" on events;
create policy "events visible" on events for select to authenticated using (
  ("schoolId" is null and "communityId" is null)
  or "schoolId" = (my_profile())."schoolId"
  or "communityId" = (my_profile())."communityId"
  or (my_profile()).role = 'SUPER_ADMIN'
  or exists (select 1 from profiles c where c."parentId" = auth.uid() and c."schoolId" = events."schoolId"));

-- Challenges: platform-wide ones, plus class challenges for that class.
drop policy "challenges readable" on challenges;
create policy "challenges visible" on challenges for select to authenticated
  using ("schoolId" is null or can_see_class("schoolId", "className") or "creatorId" = auth.uid());

-- Community scope by membership, not by free-text name.
create or replace function scans_in_scope(p_scope text, p_since timestamptz default null, p_until timestamptz default null)
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
    when 'community' then me."communityId" is not null and u."communityId" = me."communityId"
    when 'platform' then true
    else false end;
end $$;

-- Directory: community members see each other (names only; stats stay school-scoped).
create or replace view public_profiles as
  select p.id, p.name, p.avatar, p.role, p.active, p.department, p.community,
    case when visible_school then p.points end as points,
    case when visible_school then p.grade end as grade,
    case when visible_school then p."schoolId" end as "schoolId"
  from profiles p
  cross join lateral (select me.* from profiles me where me.id = auth.uid() and me.active) me
  cross join lateral (select (p.id = me.id or me.role = 'SUPER_ADMIN' or (p."schoolId" is not null and p."schoolId" = me."schoolId")) as visible_school) v
  where visible_school
     or (p.role = 'EMPLOYEE' and me.role = 'EMPLOYEE' and p.department = me.department)
     or (p."communityId" is not null and p."communityId" = me."communityId")
     or p.role in ('TEACHER', 'SCHOOL_ADMIN', 'COMMUNITY', 'COMMUNITY_ADMIN', 'SUPER_ADMIN', 'HEALTH_MONITOR')
     or exists (select 1 from listings l where l."ownerId" = p.id and l.active)
     or exists (select 1 from events e where e."organizerId" = p.id);
