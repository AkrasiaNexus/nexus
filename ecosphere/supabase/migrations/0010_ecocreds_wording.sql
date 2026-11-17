-- Currency renamed to EcoCreds (short: EC) in user-facing notices.
create or replace function adjust_points(p_user uuid, p_delta int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null or me.role <> 'SUPER_ADMIN' then raise exception 'Not allowed.'; end if;
  if p_user = me.id or exists (select 1 from profiles where id = p_user and role = 'SUPER_ADMIN') then raise exception 'Not allowed for admin accounts.'; end if;
  if p_delta = 0 or abs(p_delta) > 10000 or char_length(trim(p_reason)) < 3 then raise exception 'Give a reason and a sensible amount.'; end if;
  perform award(p_user, p_delta, 'Adjustment: ' || left(trim(p_reason), 120), 'adjustment');
  insert into notifications ("userId", kind, title, body) values (p_user, 'REWARD', case when p_delta > 0 then 'You received ' else 'EcoCreds adjusted: ' end || p_delta || ' EC', left(trim(p_reason), 200));
  insert into audit_logs ("actorId", action, detail) values (me.id, 'POINTS_ADJUSTED', p_user || ' ' || p_delta || ' ' || left(trim(p_reason), 80));
end $$;
revoke execute on function adjust_points(uuid, int, text) from anon, public;
grant execute on function adjust_points(uuid, int, text) to authenticated;
