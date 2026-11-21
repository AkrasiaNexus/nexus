-- Points ledger, reward rules, cosmetics, marketplace moderation, notification read-state.
-- Non-destructive: existing points become an "opening balance" ledger entry.

-- ── Points ledger: every change to profiles.points also writes a row here (only via award()).
create table point_events (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references profiles(id) on delete cascade,
  delta int not null,
  reason text not null,
  "refType" text not null default '',
  "createdAt" timestamptz not null default now()
);
create index on point_events ("userId", "createdAt");
insert into point_events ("userId", delta, reason, "refType")
  select id, points, 'Balance before points history', 'opening' from profiles where points <> 0;

alter table point_events enable row level security;
create policy "points history in scope" on point_events for select to authenticated using (can_see_user("userId"));

-- The single place points move. Internal: not executable by clients directly.
create function award(p_user uuid, p_delta int, p_reason text, p_ref text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_delta = 0 then return; end if;
  update profiles set points = points + p_delta where id = p_user and points + p_delta >= 0;
  if not found then raise exception 'Not enough points.'; end if;
  insert into point_events ("userId", delta, reason, "refType") values (p_user, p_delta, p_reason, p_ref);
end $$;

-- ── Reward rules (admin-editable). waste_points() reads them, falling back to the defaults.
create table reward_rules (
  action text primary key,
  points int not null check (points between 0 and 1000),
  description text not null
);
insert into reward_rules values
  ('scan', 10, 'Logging a recyclable item (plastic, paper, glass, metal, organic)'),
  ('scan_ewaste', 15, 'Logging e-waste'),
  ('scan_textile', 15, 'Logging textiles'),
  ('scan_other', 2, 'Logging general (non-recyclable) waste'),
  ('donation_claimed', 10, 'Your donated item was claimed by someone');
alter table reward_rules enable row level security;
create policy "rules readable" on reward_rules for select to authenticated using (true);

create or replace function waste_points(t "WasteType") returns int language sql stable security definer set search_path = public as $$
  select coalesce((select points from reward_rules where action = case t when 'EWASTE' then 'scan_ewaste' when 'TEXTILE' then 'scan_textile' when 'OTHER' then 'scan_other' else 'scan' end),
                  case t when 'EWASTE' then 15 when 'TEXTILE' then 15 when 'OTHER' then 2 else 10 end)
$$;

-- ── Cosmetics catalogue + unlocks + what's equipped.
create table reward_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('STICKER','BACKGROUND','BORDER','TOKEN')),
  name text not null,
  value text not null,  -- emoji for stickers/tokens, CSS colour/gradient key for backgrounds/borders
  price int not null check (price >= 0),
  active boolean not null default true
);
create table user_unlocks (
  "userId" uuid not null references profiles(id) on delete cascade,
  "itemId" uuid not null references reward_items(id) on delete cascade,
  "unlockedAt" timestamptz not null default now(),
  primary key ("userId", "itemId")
);
alter table profiles add column "equippedBackground" uuid references reward_items(id) on delete set null;
alter table profiles add column "equippedBorder" uuid references reward_items(id) on delete set null;
alter table profiles add column "equippedSticker" uuid references reward_items(id) on delete set null;
alter table reward_items enable row level security;
alter table user_unlocks enable row level security;
create policy "catalogue readable" on reward_items for select to authenticated using (active or (my_profile()).role = 'SUPER_ADMIN');
create policy "unlocks in scope" on user_unlocks for select to authenticated using (can_see_user("userId"));

insert into reward_items (kind, name, value, price) values
  ('STICKER', 'Seedling', '🌱', 40), ('STICKER', 'Recycler', '♻️', 60), ('STICKER', 'Earth Hugger', '🌍', 80), ('STICKER', 'Bee Friend', '🐝', 100),
  ('BACKGROUND', 'Forest Mist', 'forest', 120), ('BACKGROUND', 'Ocean Calm', 'ocean', 120), ('BACKGROUND', 'Sunrise', 'sunrise', 150),
  ('BORDER', 'Leaf Ring', 'leaf', 90), ('BORDER', 'Gold Ring', 'gold', 200),
  ('TOKEN', 'Clean Seas Token', '🐢', 150), ('TOKEN', 'Tree Planter Token', '🌳', 250);

create function unlock_item(p_item uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); it reward_items;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into it from reward_items where id = p_item and active;
  if it.id is null then raise exception 'That item is not available.'; end if;
  if exists (select 1 from user_unlocks where "userId" = me.id and "itemId" = it.id) then return; end if;
  perform award(me.id, -it.price, 'Unlocked ' || it.name, 'unlock');
  insert into user_unlocks ("userId", "itemId") values (me.id, it.id);
end $$;

create function equip_item(p_item uuid, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); it reward_items;
begin
  select r.* into it from reward_items r join user_unlocks u on u."itemId" = r.id and u."userId" = me.id where r.id = p_item;
  if it.id is null then return; end if;
  update profiles set
    "equippedBackground" = case when it.kind = 'BACKGROUND' then (case when p_on then it.id end) else "equippedBackground" end,
    "equippedBorder"     = case when it.kind = 'BORDER' then (case when p_on then it.id end) else "equippedBorder" end,
    "equippedSticker"    = case when it.kind in ('STICKER','TOKEN') then (case when p_on then it.id end) else "equippedSticker" end
  where id = me.id;
end $$;

-- ── Marketplace: condition, photo, moderation status, reports.
alter table listings add column condition text not null default 'GOOD' check (condition in ('NEW','LIKE_NEW','GOOD','FAIR'));
alter table listings add column "imageUrl" text;
alter table listings add column status text not null default 'APPROVED' check (status in ('PENDING','APPROVED','REJECTED','REMOVED'));
alter table listings add column "moderationNote" text not null default '';
create table listing_reports (
  id uuid primary key default gen_random_uuid(),
  "listingId" uuid not null references listings(id) on delete cascade,
  "reporterId" uuid references profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 280),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  "createdAt" timestamptz not null default now()
);
alter table listing_reports enable row level security;
create policy "own or admin reports" on listing_reports for select to authenticated using ("reporterId" = auth.uid() or (my_profile()).role = 'SUPER_ADMIN');

drop policy "listings visible" on listings;
create policy "listings visible" on listings for select to authenticated
  using ((active and status = 'APPROVED') or "ownerId" = auth.uid() or (my_profile()).role = 'SUPER_ADMIN');
-- Sellers can see the transactions on their own listings.
create policy "sales on my listings" on purchases for select to authenticated
  using (exists (select 1 from listings l where l.id = "listingId" and l."ownerId" = auth.uid()));

-- Photos: public-read bucket; uploads happen server-side after validation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('listing-images', 'listing-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

-- ── Points-moving RPCs now go through award() (ledger) and respect approval status.
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
  perform award(me.id, pts, 'Scanned ' || left(trim(p_label), 60), 'scan');
  return pts;
end $$;

create or replace function redeem(p_listing uuid) returns text language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); l listings; bonus int;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into l from listings where id = p_listing for update;
  if l.id is null or not l.active or l.status <> 'APPROVED' or l.stock < 1 then raise exception 'No longer available.'; end if;
  if l."ownerId" = me.id then raise exception 'That''s your own listing.'; end if;
  perform award(me.id, -l."pricePoints", case when l."ownerId" is null then 'Redeemed ' else 'Bought ' end || l.title, 'purchase');
  update listings set stock = stock - 1, active = case when "ownerId" is not null and stock = 1 then false else active end where id = l.id;
  insert into purchases ("userId", "listingId", points) values (me.id, l.id, l."pricePoints");
  if l."ownerId" is not null then
    perform award(l."ownerId", l."pricePoints", 'Sold ' || l.title, 'sale');
    if l.kind = 'DONATE' then
      select points into bonus from reward_rules where action = 'donation_claimed';
      perform award(l."ownerId", coalesce(bonus, 0), 'Donation claimed: ' || l.title, 'donation');
    end if;
    insert into notifications ("userId", kind, title, body) values (l."ownerId", 'MARKETPLACE',
      me.name || ' claimed "' || l.title || '"', 'Arrange hand-over with ' || me.name || ' (ID ' || me."memberId" || ').');
  end if;
  insert into audit_logs ("actorId", action, detail) values (me.id, 'REDEEM', l.title);
  return case when l."ownerId" is not null then 'Claimed! The owner has been notified.' else 'Redeemed ' || l.title || '!' end;
end $$;

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
  perform award(me.id, c."rewardPoints", 'Challenge: ' || c.title, 'challenge');
end $$;

create or replace function approve_task(p_task uuid, p_student uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile(); t tasks;
begin
  if me.id is null or me.role <> 'TEACHER' then return; end if;
  select * into t from tasks where id = p_task and "creatorId" = me.id;
  if t.id is null then return; end if;
  update task_dones set approved = true where "taskId" = p_task and "userId" = p_student and not approved;
  if not found then return; end if;
  perform award(p_student, t.points, 'Task: ' || t.title, 'task');
  insert into notifications ("userId", kind, title, body) values (p_student, 'TASK', 'Task approved: ' || t.title, '+' || t.points || ' green points');
end $$;

-- Super-admin manual adjustment (audited).
create function adjust_points(p_user uuid, p_delta int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := my_profile();
begin
  if me.id is null or me.role <> 'SUPER_ADMIN' then raise exception 'Not allowed.'; end if;
  if p_delta = 0 or abs(p_delta) > 10000 or char_length(trim(p_reason)) < 3 then raise exception 'Give a reason and a sensible amount.'; end if;
  perform award(p_user, p_delta, 'Adjustment: ' || left(trim(p_reason), 120), 'adjustment');
  insert into notifications ("userId", kind, title, body) values (p_user, 'REWARD', case when p_delta > 0 then 'You received ' else 'Points adjusted: ' end || p_delta || ' pts', left(trim(p_reason), 200));
  insert into audit_logs ("actorId", action, detail) values (me.id, 'POINTS_ADJUSTED', p_user || ' ' || p_delta || ' ' || left(trim(p_reason), 80));
end $$;

-- ── Notification read state (per user, also for broadcasts) + muted categories.
create table notification_reads (
  "userId" uuid not null references profiles(id) on delete cascade,
  "notificationId" uuid not null references notifications(id) on delete cascade,
  "readAt" timestamptz not null default now(),
  primary key ("userId", "notificationId")
);
alter table notification_reads enable row level security;
create policy "my reads" on notification_reads for select to authenticated using ("userId" = auth.uid());
create policy "mark read" on notification_reads for insert to authenticated with check ("userId" = auth.uid());
alter table profiles add column "mutedKinds" text[] not null default '{}';

-- ── Audit log is append-only.
create function audit_append_only() returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only'; end $$;
create trigger audit_logs_no_update before update on audit_logs for each row execute function audit_append_only();

revoke execute on all functions in schema public from anon, public;
grant execute on function log_scan, redeem, claim_challenge, approve_task, scans_in_scope, scans_filtered, my_profile, can_see_user, can_see_class,
  waste_points, answer_parent_request, school_totals, unlock_item, equip_item, adjust_points to authenticated;
-- award() stays internal (no grant): clients can never call it directly.
