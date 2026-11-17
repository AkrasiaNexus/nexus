-- Admin analytics with filters. Aggregate rows only (no user identity).
-- Super admins may filter anything; school admins are pinned to their own school; nobody else may call it.
create function scans_filtered(
  p_school uuid default null, p_community uuid default null, p_class text default null, p_role "Role" default null,
  p_since timestamptz default null, p_until timestamptz default null)
returns table ("wasteType" "WasteType", "weightKg" real, "createdAt" timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me profiles := my_profile(); school uuid := p_school;
begin
  if me.id is null or me.role not in ('SUPER_ADMIN', 'SCHOOL_ADMIN') then return; end if;
  if me.role = 'SCHOOL_ADMIN' then school := me."schoolId"; end if;
  return query select s."wasteType", s."weightKg", s."createdAt" from scans s join profiles u on u.id = s."userId"
  where (school is null or u."schoolId" = school)
    and (p_community is null or u."communityId" = p_community)
    and (p_class is null or u.grade = p_class)
    and (p_role is null or u.role = p_role)
    and (p_since is null or s."createdAt" >= p_since)
    and (p_until is null or s."createdAt" < p_until);
end $$;
revoke execute on function scans_filtered from anon, public;
grant execute on function scans_filtered to authenticated;
