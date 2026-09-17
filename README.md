# Timedline

Timedline is a permanent, searchable, timeline-first archive for thoughts, ideas, notes, files, and media. The current repository contains the known-good React/Vite MVP with logging, search, archive, timeline views, local-first storage, and optional Supabase persistence.

This repository is the source of truth for application code and technical decisions. Product conversations and source material may live in a ChatGPT Project, visual iteration may use Replit, and durable user data may use Supabase, but changes to the product arrive here through reviewed pull requests.

## Current checkpoint

`main` is the preserved working MVP checkpoint. Do not redesign or replace it directly. New work begins on focused branches and is merged only after review and verification.

The original legacy Timedline implementation is being recovered separately. Its navigation, layout, behavior, and data model will be studied before any deliberate merge into the modern application.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Required variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit `.env` files or privileged database keys.

## Working agreements

- GitHub is the code source of truth.
- Use one focused branch and pull request per outcome.
- Keep `main` deployable and preserve working behavior.
- Replit is for visual iteration and deployment, not the authoritative database or code history.
- Supabase is the durable backend for authentication, structured data, and media storage when cloud persistence is required.
- Keep the Idea Stream data model independent from the interface so the navigation can evolve without losing ideas.

See [docs/FOUNDATION.md](docs/FOUNDATION.md), [docs/IDEA_STREAM.md](docs/IDEA_STREAM.md), and [docs/DECISIONS.md](docs/DECISIONS.md).
