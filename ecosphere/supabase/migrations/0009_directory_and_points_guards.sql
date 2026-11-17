-- 1) Directory: only APPROVED listings make a seller visible (pending/rejected listings leaked names across schools).
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
     or exists (select 1 from listings l where l."ownerId" = p.id and l.active and l.status = 'APPROVED')
     or exists (select 1 from events e where e."organizerId" = p.id);

-- 2) Super admins can't adjust their own (or another super admin's) points.
create or replace function adjust_points(p_user uuid, p_delta int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null or me.role <> 'SUPER_ADMIN' then raise exception 'Not allowed.'; end if;
  if p_user = me.id or exists (select 1 from profiles where id = p_user and role = 'SUPER_ADMIN') then raise exception 'Not allowed for admin accounts.'; end if;
  if p_delta = 0 or abs(p_delta) > 10000 or char_length(trim(p_reason)) < 3 then raise exception 'Give a reason and a sensible amount.'; end if;
  perform award(p_user, p_delta, 'Adjustment: ' || left(trim(p_reason), 120), 'adjustment');
  insert into notifications ("userId", kind, title, body) values (p_user, 'REWARD', case when p_delta > 0 then 'You received ' else 'Points adjusted: ' end || p_delta || ' pts', left(trim(p_reason), 200));
  insert into audit_logs ("actorId", action, detail) values (me.id, 'POINTS_ADJUSTED', p_user || ' ' || p_delta || ' ' || left(trim(p_reason), 80));
end $$;
revoke execute on function adjust_points(uuid, int, text) from anon, public;
grant execute on function adjust_points(uuid, int, text) to authenticated;
