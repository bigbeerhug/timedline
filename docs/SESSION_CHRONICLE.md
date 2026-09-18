# Session Chronicle contract

A Session Chronicle preserves one meaningful working or life session as one
chronological Timedline entry. Its transcript, summary, decisions, and actions
remain sections of the same originating event rather than unrelated entries.

## Consent

- A Chronicle is never saved merely because a file was selected.
- Import first loads the complete source into the entry editor for review.
- The person must explicitly choose **Save Entry** before durable storage is
  changed.
- New Chronicles are private by default when privacy controls are introduced.

## Current implementation

The first implementation intentionally uses the existing general `entries`
contract:

- Markdown and plain-text Chronicle files can be imported.
- Their complete text is placed in `content`, making it searchable now.
- The source file is attached and uploaded through the existing storage driver.
- The existing authenticated save path writes the entry to Supabase.
- No new table, navigation commitment, or permanent interface is introduced.

This is a reversible bridge. A later schema migration may add structured title,
entry type, privacy, branch, transcript, and relationship metadata without
moving or discarding the original chronological entry.

## Future protocol

The conversational command **“Life-log this”** may eventually prepare a
Chronicle with:

- original timestamps and source
- a verbatim transcript
- a distilled summary
- decisions and foundational principles
- extracted ideas and actions
- project, branch, and related pull-request links

Saving remains consent-based. Intelligent reminders may offer to prepare an
entry at meaningful session boundaries, but routine conversations are not
captured automatically.
