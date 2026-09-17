# Timedline project guidance

## Identity and purpose

- The official product name is **Timedline**. Do not silently rename it to Timeline.
- Timedline is a permanent, searchable, timeline-first archive for thoughts, ideas, notes, files, audio, and media.
- The immediate foundation must remain flexible. Preserve durable data and history while allowing navigation and visual structure to change later.

## Source-of-truth workflow

- GitHub is the source of truth for code and technical documentation.
- Preserve `main` as the known-good MVP checkpoint.
- Make every change on a focused branch and deliver it through a pull request.
- Prefer small, reviewable PRs. Do not bundle unrelated cleanup or redesign.
- Replit may run, preview, and deploy the GitHub code, but it must not become the only copy of code or data.
- Supabase provides authentication, PostgreSQL data, and file/audio storage when durable multi-device persistence is needed.

## Legacy preservation

- The original programmer's Timedline version is pending recovery.
- Keep recovered legacy code and database artifacts separate from the modern app until they are inventoried.
- Do not overwrite the modern app with legacy code or prematurely recreate the old interface.
- Extract behaviors, navigation concepts, data relationships, and visual ideas deliberately through separate PRs.

## Idea Stream guarantees

- Every accepted idea receives one immutable sequential display number and a permanent internal ID.
- Preserve the original capture timestamp, timezone, raw transcript, and raw audio when present.
- AI-generated titles, summaries, tags, and embeddings are derived metadata and may be regenerated without altering the original capture.
- Revisions, branches, status changes, merges, and soft deletion must remain auditable.
- Prefer append-only history and soft deletion over destructive overwrites.
- Keep the data contract independent of any specific screen or navigation scheme.

## Security and quality

- Never commit `.env` files, passwords, service-role keys, access tokens, or private user content.
- Browser-safe Supabase anon keys may be configured through environment variables; privileged service-role keys must remain server-side only.
- Require real authentication and row-level security before production use. Never solve access problems by leaving user tables or storage publicly writable.
- Before proposing a merge, run the relevant build/tests and report what was verified.
- Do not modify production data, deployments, or infrastructure unless the task explicitly authorizes it.
