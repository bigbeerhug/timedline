# Timedline foundation

## Product north star

Timedline is a long-lived personal archive: a place to capture thoughts immediately, preserve the original material, find it later in ordinary language, and develop any item without losing where it came from.

The foundation intentionally separates permanent information from replaceable presentation. We can begin capturing and organizing now, then incorporate the recovered legacy navigation and design later without migrating or renumbering the underlying ideas.

## Responsibilities

| Layer | Responsibility |
| --- | --- |
| ChatGPT Project | Shared product conversations, uploaded source material, project instructions, decisions, and research |
| Codex | Repository inspection, implementation, testing, and preparation of reviewable pull requests |
| GitHub | Canonical code, technical documents, branches, reviews, and release history |
| Replit | Fast visual iteration, runtime testing, and deployment from the GitHub repository |
| Supabase | Authenticated PostgreSQL records plus durable audio/file storage |

ChatGPT Project context is not a substitute for checked-in technical documentation. Decisions that affect implementation belong in this repository so future development sessions can recover them reliably.

## Branch and release policy

1. Keep `main` as the deployable, known-good checkpoint.
2. Start one focused branch for one outcome.
3. Run the relevant build and tests.
4. Open a pull request with scope, verification, data impact, and rollback notes.
5. Review before merging.

Suggested branch prefixes are `foundation/`, `feature/`, `fix/`, `security/`, `docs/`, and `legacy/`.

## Legacy intake

When the old programmer's version is recovered:

1. Preserve its files and database dump unchanged in a separate private repository or isolated import branch.
2. Record its runtime requirements, screens, navigation, terminology, schemas, and key behaviors.
3. Identify what is essential, nostalgic, obsolete, or unsafe.
4. Translate selected concepts into small modern PRs rather than combining both codebases at once.
5. Keep original artifacts available for comparison throughout the rebuild.

## Foundation phases

- **Phase 0 — Preserve:** checkpoint working code, document decisions, remove tracked environment configuration, and secure the workflow.
- **Phase 1 — Trust:** verify authentication, row-level security, storage policies, backups/exports, and per-user isolation.
- **Phase 2 — Capture:** implement the voice-first Idea Stream and reliable offline/retry behavior.
- **Phase 3 — Retrieve:** add natural-language search, filters, relationships, and statistics.
- **Phase 4 — Reconcile:** study the recovered legacy version and deliberately merge the best structure and behaviors.

These phases are sequencing guidance, not a permanent interface specification.
