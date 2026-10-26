-- ============================================================
-- Klar Schiff – Datenbank
-- Einmal komplett im Supabase SQL Editor ausführen.
-- ============================================================

-- ---------- Tabellen ----------
create table if not exists public.households (
  id             uuid primary key default gen_random_uuid(),
  invite_code    text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  default_mode   text not null default 'fair' check (default_mode in ('fair','rotate','fixed','open')),
  vacation_since timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 30),
  color           text not null default 'sky',
  remind_hour     int  default 8 check (remind_hour between 0 and 23),   -- null = keine Morgen-Erinnerung
  notify_handover boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  type         text not null default 'other',
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  freq         int  not null default 7 check (freq between 1 and 365),
  minutes      int  not null default 10 check (minutes between 1 and 600),
  points       int  check (points between 0 and 999),                  -- null = so viele Punkte wie Minuten
  mode         text not null default 'fair' check (mode in ('fair','rotate','fixed','open')),
  person       uuid references public.members(id) on delete set null,
  tip          text not null default '',
  last_done    timestamptz,
  last_by      uuid references public.members(id) on delete set null,
  claimed_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Folgeaufgaben und spontane Aufgaben (v3)
alter table public.tasks add column if not exists after_task uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists after_delay_min int not null default 0 check (after_delay_min between 0 and 20160);
alter table public.tasks add column if not exists one_off boolean not null default false;
alter table public.tasks add column if not exists ready_notified_at timestamptz;

create table if not exists public.completions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete set null,
  task_name    text not null,
  room_id      uuid references public.rooms(id) on delete set null,
  done_by      uuid references public.members(id) on delete set null,
  done_at      timestamptz not null default now(),
  minutes      int not null default 0,
  points       int not null default 0,
  prev_last    timestamptz,
  prev_last_by uuid
);
create index if not exists completions_household_time on public.completions (household_id, done_at desc);
create index if not exists tasks_household on public.tasks (household_id);
create index if not exists rooms_household on public.rooms (household_id);

create table if not exists public.push_subscriptions (
  endpoint      text primary key,
  member_id     uuid not null references public.members(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  p256dh        text not null,
  auth          text not null,
  tz            text not null default 'Europe/Berlin',
  last_reminded date,
  created_at    timestamptz not null default now()
);

-- Schlüssel für Push-Nachrichten. Legt die Edge Function beim ersten Aufruf selbst an.
-- Keine Policies: nur der Server (Service Role) kommt heran.
create table if not exists public.push_config (
  id          int primary key default 1 check (id = 1),
  public_key  text not null,
  private_key text not null
);

-- ---------- Hilfsfunktionen ----------
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.members where user_id = auth.uid()
$$;

create or replace function public.my_member() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

-- Neuen Haushalt anlegen; die aufrufende Person wird erstes Mitglied.
create or replace function public.create_household(p_name text, p_mode text default 'fair') returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  insert into households (default_mode) values (coalesce(nullif(p_mode, ''), 'fair')) returning id into h;
  insert into members (household_id, user_id, name, color) values (h, auth.uid(), trim(p_name), 'sky');
  return h;
end $$;

-- Mit Einladungscode beitreten.
create or replace function public.join_household(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  select id into h from households where invite_code = upper(trim(p_code));
  if h is null then raise exception 'invalid_code'; end if;
  select count(*) into n from members where household_id = h;
  if n >= 4 then raise exception 'household_full'; end if;
  insert into members (household_id, user_id, name, color)
  values (h, auth.uid(), trim(p_name), (array['sky','rose','sand','mint'])[n + 1]);
  return h;
end $$;

-- Urlaub beenden: alle Fälligkeiten um die Urlaubsdauer nach hinten schieben.
create or replace function public.end_vacation() returns void
language plpgsql security definer set search_path = public as $$
declare h uuid := public.my_household(); since timestamptz;
begin
  if h is null then raise exception 'no_household'; end if;
  select vacation_since into since from households where id = h;
  if since is null then return; end if;
  update tasks set last_done = last_done + (now() - since) where household_id = h and last_done is not null;
  update households set vacation_since = null where id = h;
end $$;

revoke all on function public.my_household() from public, anon;
revoke all on function public.my_member()    from public, anon;
grant execute on function public.my_household() to authenticated;
grant execute on function public.my_member()    to authenticated;
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text)   from public, anon;
revoke all on function public.end_vacation()               from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text)   to authenticated;
grant execute on function public.end_vacation()               to authenticated;

-- ---------- Zugriffsregeln (Row Level Security) ----------
alter table public.households         enable row level security;
alter table public.members            enable row level security;
alter table public.rooms              enable row level security;
alter table public.tasks              enable row level security;
alter table public.completions        enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_config        enable row level security;

drop policy if exists "household read"   on public.households;
drop policy if exists "household update" on public.households;
create policy "household read"   on public.households for select to authenticated using (id = public.my_household());
create policy "household update" on public.households for update to authenticated
  using (id = public.my_household()) with check (id = public.my_household());

drop policy if exists "members read"       on public.members;
drop policy if exists "members update own" on public.members;
drop policy if exists "members leave"      on public.members;
create policy "members read"       on public.members for select to authenticated using (household_id = public.my_household());
create policy "members update own" on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and household_id = public.my_household());
create policy "members leave"      on public.members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "rooms of household" on public.rooms;
create policy "rooms of household" on public.rooms for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());

drop policy if exists "tasks of household" on public.tasks;
create policy "tasks of household" on public.tasks for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());

drop policy if exists "completions of household" on public.completions;
create policy "completions of household" on public.completions for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (member_id = public.my_member())
  with check (member_id = public.my_member() and household_id = public.my_household());

-- ---------- Live-Abgleich zwischen den Handys ----------
alter table public.households  replica identity full;
alter table public.members     replica identity full;
alter table public.rooms       replica identity full;
alter table public.tasks       replica identity full;
alter table public.completions replica identity full;

do $$
declare t text;
begin
  foreach t in array array['households','members','rooms','tasks','completions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
