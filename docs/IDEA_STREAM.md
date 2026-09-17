# Idea Stream contract

The Idea Stream is Timedline's frictionless capture module. Its records must survive redesigns, platform moves, and later incorporation of the legacy Timedline structure.

## Capture promise

The primary action is one-tap voice capture. A successful save returns the permanent idea number. The interface must never claim an idea was saved until durable storage confirms it; failed captures remain visibly queued for retry.

## Core record

Each idea should support:

- permanent internal ID
- immutable sequential display number
- owner ID
- original creation timestamp and timezone
- capture source and media type
- raw transcript or raw text
- raw audio/file reference when present
- optional AI title, summary, tags, and search embedding
- status
- parent idea ID for branches
- soft-deletion/archive markers
- created and updated audit timestamps

The exact database schema will be proposed and reviewed separately before implementation.

## Status vocabulary

Initial statuses are `raw`, `developing`, `ready`, `in_progress`, `executed`, `archived`, and `discarded`. Changing a status adds a history event; it does not erase the original record.

## History and relationships

- Edits preserve prior content or create auditable revisions.
- A branch remains linked to its parent while receiving its own permanent number.
- Cross-links and merges record relationships without collapsing source ideas.
- Deletion is recoverable by default.
- AI enrichment is replaceable metadata, never the sole copy of the idea.

## Retrieval

The module must support chronological browsing, exact idea-number lookup, full-text search, semantic search, tags, status filters, parent/branch navigation, and aggregate counts. Natural-language requests such as “find the coffee prank idea” should resolve to durable records, not merely the current chat transcript.
