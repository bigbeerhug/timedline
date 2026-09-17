# Supabase security baseline

Timedline must fail closed in cloud mode: an unavailable or misconfigured Supabase connection must never silently save private ideas to an unrelated local store.

## Findings addressed by this change

- Supabase configuration was duplicated and hard-coded in browser source.
- A development-only identity bypass could impersonate a fixed user without a real Supabase session.
- The interface displayed direct database diagnostics, including a sample entry.
- The repository did not contain a reproducible row-level security baseline.

The browser-safe Supabase anon key is not a privileged service credential, but it still belongs in environment configuration. Database and storage access must be protected by authentication and row-level security rather than by concealing that key.

## Read-only preflight

Run these queries in the Supabase SQL editor before applying the migration and save the results with the deployment record:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('entries', 'activity')
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('entries', 'activity'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select id, name, public
from storage.buckets
where id = 'vault';

select user_id, count(*)
from public.entries
group by user_id
order by user_id;

select user_id, count(*)
from public.activity
group by user_id
order by user_id;
```

Confirm every existing `user_id` belongs to the intended Supabase Auth user before enforcing the policies. Do not rewrite ownership identifiers speculatively.

## Controlled rollout

1. Create a Supabase database backup or point-in-time recovery checkpoint.
2. Confirm the intended account can sign in through Supabase Auth.
3. Review `supabase/migrations/202609170001_harden_existing_data.sql` against the live schema.
4. Apply the migration in the Supabase SQL editor.
5. Verify the owner can list, create, and delete a test entry and upload/read/delete a test file.
6. Verify a signed-out browser cannot read or mutate `entries`, `activity`, or `vault` objects.
7. Verify a second authenticated test account cannot access the owner's records or files.

The migration is intentionally committed but is not automatically applied to the live project.

## Deployment configuration

Set these variables in the deployment environment:

```text
VITE_STORAGE_DRIVER=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_ANON_KEY=<browser-safe anon key>
```

Never place a Supabase service-role key in a `VITE_` variable. Vite exposes `VITE_` variables to the browser bundle.
