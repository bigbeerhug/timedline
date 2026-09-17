-- Timedline security baseline for the existing entries, activity, and vault data.
-- Review docs/SECURITY.md and take a database backup before applying this file.

begin;

alter table public.entries enable row level security;
alter table public.activity enable row level security;

revoke all on table public.entries from anon;
revoke all on table public.activity from anon;

grant select, insert, update, delete on table public.entries to authenticated;
grant select, insert, update, delete on table public.activity to authenticated;

drop policy if exists "entries_select_own" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;
drop policy if exists "entries_owner_boundary" on public.entries;

-- RESTRICTIVE boundaries are ANDed with any legacy permissive policies, so an
-- older broad policy cannot bypass ownership while it is being inventoried.
create policy "entries_owner_boundary"
on public.entries as restrictive for all
to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "entries_select_own"
on public.entries for select
to authenticated
using (auth.uid() = user_id);

create policy "entries_insert_own"
on public.entries for insert
to authenticated
with check (auth.uid() = user_id);

create policy "entries_update_own"
on public.entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "entries_delete_own"
on public.entries for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "activity_select_own" on public.activity;
drop policy if exists "activity_insert_own" on public.activity;
drop policy if exists "activity_update_own" on public.activity;
drop policy if exists "activity_delete_own" on public.activity;
drop policy if exists "activity_owner_boundary" on public.activity;

create policy "activity_owner_boundary"
on public.activity as restrictive for all
to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "activity_select_own"
on public.activity for select
to authenticated
using (auth.uid() = user_id);

create policy "activity_insert_own"
on public.activity for insert
to authenticated
with check (auth.uid() = user_id);

create policy "activity_update_own"
on public.activity for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "activity_delete_own"
on public.activity for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do update set public = false;

drop policy if exists "vault_select_own" on storage.objects;
drop policy if exists "vault_insert_own" on storage.objects;
drop policy if exists "vault_update_own" on storage.objects;
drop policy if exists "vault_delete_own" on storage.objects;
drop policy if exists "vault_owner_boundary" on storage.objects;

create policy "vault_owner_boundary"
on storage.objects as restrictive for all
to public
using (
  bucket_id <> 'vault'
  or (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id <> 'vault'
  or (storage.foldername(name))[1] = auth.uid()::text
);

create policy "vault_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "vault_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "vault_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'vault'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "vault_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
