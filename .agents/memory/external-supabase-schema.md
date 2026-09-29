---
name: External Supabase schema
description: Migration and runtime verification constraint for the external cloud vault
---

Do not assume that a committed migration has been applied to the external Supabase database. Confirm the live schema before claiming that newly typed captures work.

**Why:** The app received a durable entry-classification migration in source, but a runtime cloud save reported that the classification column was absent. The post-merge script installs packages and builds; it does not migrate an external database. Failed saves must remain visible and fail closed.

**How to apply:** When a feature depends on an external Supabase schema change, check the target environment and obtain the user's authorization before applying the migration. Never treat a Replit-managed database or a local build as proof about the external Supabase schema.