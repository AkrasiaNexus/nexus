-- Scanner learning loop: when a user logs a scan (and hasn't opted out), keep the photo's CLIP fingerprint
-- (512 numbers, never the photo) with the model's guess and the bin the user confirmed. Kept 180 days.
-- scripts/retrain-scanner.mts trains on these.
create table scan_feedback (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references profiles(id) on delete cascade,
  embedding real[] not null check (array_length(embedding, 1) = 512),
  predicted "WasteType" not null,
  chosen "WasteType" not null,
  confidence real not null check (confidence between 0 and 1),
  "createdAt" timestamptz not null default now()
);
create index scan_feedback_created on scan_feedback ("createdAt");
alter table scan_feedback enable row level security;
-- No insert/update/delete policies: writes only through log_scan_feedback. Reads only for super admins (training uses the service key).
create policy "feedback for super admins" on scan_feedback for select to authenticated using ((my_profile()).role = 'SUPER_ADMIN');

create or replace function log_scan_feedback(p_embedding real[], p_predicted "WasteType", p_chosen "WasteType", p_confidence real)
returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null then raise exception 'not signed in'; end if;
  if array_length(p_embedding, 1) is distinct from 512 or array_position(p_embedding, null) is not null
     or exists (select 1 from unnest(p_embedding) v where v = 'NaN'::real or v in ('Infinity'::real, '-Infinity'::real) or abs(v) > 100) then
    raise exception 'invalid embedding';
  end if;
  -- CLIP fingerprints are unit length; anything else is a crafted vector that would dominate training.
  if (select sqrt(sum(v * v)) from unnest(p_embedding) v) not between 0.99 and 1.01 then raise exception 'invalid embedding'; end if;
  -- Only alongside a real scan the caller just logged with that bin.
  if not exists (select 1 from scans where "userId" = me.id and "wasteType" = p_chosen and "createdAt" > now() - interval '2 minutes') then
    raise exception 'no matching scan';
  end if;
  perform pg_advisory_xact_lock(hashtext('fb' || me.id::text));
  -- Same hourly cap as scans, so one account can't flood the training data.
  if (select count(*) from scan_feedback where "userId" = me.id and "createdAt" > now() - interval '1 hour') >= 60 then
    raise exception 'feedback limit';
  end if;
  delete from scan_feedback where "createdAt" < now() - interval '180 days'; -- retention
  insert into scan_feedback ("userId", embedding, predicted, chosen, confidence)
  values (me.id, p_embedding, p_predicted, p_chosen, least(greatest(coalesce(p_confidence, 0), 0), 1));
end $$;

revoke all on scan_feedback from anon, authenticated;
grant select on scan_feedback to authenticated;
revoke execute on function log_scan_feedback from anon, public;
grant execute on function log_scan_feedback to authenticated;
