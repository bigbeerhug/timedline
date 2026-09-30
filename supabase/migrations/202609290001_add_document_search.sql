-- Store locally extracted document text and make file contents searchable.
-- The migration adds derived indexing data; it does not rewrite entry content.

begin;

alter table public.entries
  add column if not exists extracted_text text not null default '',
  add column if not exists file_metadata jsonb not null default '{}'::jsonb;

alter table public.entries
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(content, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(file->>'name', '')), 'A') ||
    setweight(to_tsvector('english', coalesce(file_metadata->>'keywords', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(file_metadata->>'category', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(date::text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_text, '')), 'D')
  ) stored;

create index if not exists entries_search_vector_gin_idx
  on public.entries using gin (search_vector);

drop function if exists public.search_entries(text, integer);
drop function if exists public.search_entries(text, integer, integer);

create function public.search_entries(
  search_query text,
  result_limit integer default 25,
  result_offset integer default 0
)
returns table (
  entry_id text,
  rank real,
  total_count bigint,
  excerpt text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parsed_query as (
    select
      pg_catalog.websearch_to_tsquery('english', coalesce(search_query, '')) as value,
      btrim(coalesce(search_query, '')) as normalized,
      btrim(coalesce(search_query, '')) ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$' as is_date
  ), ranked as (
    select
      e.id::text as entry_id,
      e.ts as sort_ts,
      case
        when parsed_query.is_date then 1::real
        when e.search_vector @@ parsed_query.value then pg_catalog.ts_rank_cd(e.search_vector, parsed_query.value)::real
        else 1::real
      end as rank,
      pg_catalog.count(*) over () as total_count,
      pg_catalog.ts_headline(
        'english',
        pg_catalog.concat_ws(' ', coalesce(e.content, ''), coalesce(e.file->>'name', ''), coalesce(e.extracted_text, '')),
        parsed_query.value,
        'StartSel=, StopSel=, MaxFragments=2, MinWords=6, MaxWords=24'
      ) as excerpt
    from public.entries as e
    cross join parsed_query
    where case
      when parsed_query.is_date then e.date::text like parsed_query.normalized || '%'
      else e.search_vector @@ parsed_query.value
    end
  )
  select ranked.entry_id, ranked.rank, ranked.total_count, ranked.excerpt
  from ranked
  order by ranked.rank desc, ranked.sort_ts desc
  limit least(greatest(coalesce(result_limit, 25), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

revoke all on function public.search_entries(text, integer, integer) from public, anon;
grant execute on function public.search_entries(text, integer, integer) to authenticated;

commit;
