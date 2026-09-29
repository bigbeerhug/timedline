-- Add durable entry classification without guessing the meaning of existing rows.
-- Existing entries intentionally remain NULL and continue to appear in the
-- Timeline, Archive, search, and exports. New writes classify entries explicitly.

begin;

alter table public.entries
  add column if not exists type text;

alter table public.entries
  drop constraint if exists entries_type_check;

alter table public.entries
  add constraint entries_type_check
  check (type is null or type in ('idea', 'note', 'chronicle'));

commit;