# File text indexing and search

Timedline extracts document text in the browser before upload. It makes no
language-model or third-party AI request. The original attachment stays in the
private `vault` bucket; extracted text and factual indexing metadata are saved
on the corresponding authenticated `entries` row.

## Supported extraction

- PDF files with selectable text: first 150 pages and up to 250,000 characters
- DOCX files: up to 250,000 extracted characters
- Plain text, Markdown, CSV, JSON, HTML, XML, and log files: up to 250,000 characters
- Other file types remain uploadable and searchable by filename and the user's
  entry text
- Image-only PDFs and images do not receive OCR in this release; their
  filenames and user-entered context remain searchable
- Files over 25 MB are saved without text extraction

The user-entered entry text remains authoritative. Suggested keywords are
deterministic terms weighted from that text, the filename, and extracted body
text. They are searchable metadata, not generated descriptions or guaranteed
entity labels.

## Search design

The database migration adds extracted text, JSON metadata, a weighted generated
Postgres search vector, and a GIN index. Entry text and filename have higher
weight than suggested keywords; extracted document body has lower weight.
Search uses Postgres web-style full-text queries and returns ranked entry IDs
and short excerpts. The client then fetches only the result metadata and file
references, not every matching document's full extracted body. Existing row
level security remains in force because the search function uses invoker
permissions.

Local mode uses the same extracted text and keyword metadata with deterministic
client-side matching and ranking.

## Rollout

Apply `supabase/migrations/202609290001_add_document_search.sql` to the intended
Supabase project before using cloud file indexing. A build or Replit preview
does not prove that an external database has the migration. The app will keep
loading older entries during rollout, but indexed cloud saves require the new
columns and fail visibly until the migration has been applied.
