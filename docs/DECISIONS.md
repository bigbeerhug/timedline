# Decision log

## 2026-09-17 — Formal foundation

- The official product and project name remains **Timedline**.
- The existing `bigbeerhug/timedline` repository remains the code source of truth; no replacement repository will be created.
- The working `main` branch is preserved while all new work proceeds through focused branches and pull requests.
- ChatGPT Project, Codex, GitHub, Replit, and Supabase have distinct responsibilities documented in `FOUNDATION.md`.
- The future Idea Stream is a modular, voice-first capture system whose durable data contract is independent from the final navigation and visual design.
- The legacy Timedline version will be recovered and evaluated separately before selected concepts are merged.
- Supabase is used for durable, authenticated, multi-device data and media—not because Codex stores an application's database.
- Production tables and storage must use real authentication and row-level security.

## Open decisions

- Final navigation and visual architecture after legacy review
- Exact Idea Stream PostgreSQL schema and migration strategy
- One-tap iPhone capture surface and offline queue behavior
- Private ChatGPT connection for verified `create_idea` and retrieval actions

## 2026-09-19 — Contained Idea Stream MVP

- The first Direct Capture implementation remains a lens over the existing
  authenticated `entries` collection instead of creating a second database or
  prematurely freezing a new PostgreSQL schema.
- A successful capture is acknowledged only after the active storage driver
  returns the created record. In Supabase mode, the returned durable row ID is
  presented as the permanent entry number.
- The stream is newest-first, searchable, and expandable without requiring a
  title, category, project, or other classification at capture time.
- Existing entries and the imported Development Chronicle remain untouched;
  this PR includes no production migration or data rewrite.
