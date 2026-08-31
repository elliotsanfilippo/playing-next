# Erasure test environment — NOT the Playing Next database

This directory stands up a **throwaway second Supabase Free project**
whose only purpose is to prove that the manual-erasure transaction in
`erase_personal_fields` behaves correctly.

## Read this before trusting anything it tells you

**This is not a copy of Production and proves nothing about it.**

The source-table definitions in `schema.test-only.sql` were derived from
the PostgREST/OpenAPI description of the Production schema. That
description exposes column names, types, NOT NULL, defaults, primary keys
and foreign keys. It does **not** expose:

- CHECK constraints
- Row Level Security policies
- role grants
- triggers
- indexes

So this environment **cannot** be used to make any claim about
Production's constraints, security or behaviour. Production security was
tested separately, against Production, read-only, on 2026-08-31. Do not
infer it from here.

**Never load Production data into this project.** Synthetic fixtures
only. The test suite creates its own rows and removes them afterwards.

## What it does prove

The two things actually under test are the **real, canonical
definitions**, applied from `supabase/migrations/` rather than copied:

- `data_erasures`, including the `request_reference` CHECK the rollback
  test depends on
- `erase_personal_fields`, the transaction itself

The fixture tables exist only so those two have something to act on.
Their fidelity matters for column names and types, and for nothing else.

## Setup order

Apply in this order. The fixture tables must exist before the function
that references them.

1. `test-environment/erasure/schema.test-only.sql` — fixture source tables
2. `supabase/migrations/20260819_not_played_reports.sql` — canonical
3. `supabase/migrations/20260831_data_erasures.sql` — canonical
4. `supabase/migrations/20260831_data_erasures_revoke.sql` — canonical
5. `supabase/migrations/20260831_erase_atomically.sql` — canonical

Then:

```
TEST_SUPABASE_URL=https://<test-project>.supabase.co \
TEST_SERVICE_ROLE_KEY=<test project service role key> \
npx tsx scripts/erasure-writepath.test.mts
```

The suite refuses to run against the Production project ref, with no
override.

## Why this is not in supabase/migrations

Because it is not a migration and must never be mistaken for one.
`supabase/migrations/` is the canonical record of changes actually
applied to Production. These definitions were **inferred**, they are
incomplete by construction, and Production's real tables predate the
checked-in migrations entirely.

That gap — only 5 of 13 Production tables have a `create table` in this
repository — is tracked as technical debt in ROADMAP §11. **Do not close
that debt by promoting these files.** Inferred definitions presented as
history would be worse than the honest absence, because the next person
would believe them.
