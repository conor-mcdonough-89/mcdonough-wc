# McDonough World Cup Pool

Private salary-cap prediction pool for the 2026 World Cup. ~16 players, pre-provisioned accounts.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth, RLS). Deployed on Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + keys
npm run dev
```

### Supabase

1. Create a new project.
2. **Enable the Phone provider in Auth → Providers.** Sign-in uses `signInWithPassword({ phone })` and never sends SMS — accounts are admin-created with `phone_confirm: true`. If the hosted dashboard requires SMS credentials to enable the provider, dummy values are fine (they're never used).
3. Run the SQL in `supabase/schema.sql` in the SQL editor (creates tables, RLS, seeds teams + fixtures).
4. To grant yourself admin, set `is_admin = true` on your `profiles` row directly via the dashboard after your account exists.

#### Fallback (only if the phone provider truly can't be enabled)

Flip `USE_PHONE_PROVIDER = false` in `lib/phone.ts`. Accounts will then be created with synthesized emails `${digits}@mcdpool.local` (`email_confirm: true`) instead, keeping the phone-only UX.

## Pre-creating players

Bulk-import a CSV of `phone,full_name,entry_name` (`entry_name` optional):

```bash
npm run bulk-import -- path/to/players.csv
```

Outputs the phone → temp-password list so you can send invites. Same flow is available in the admin UI.

## Scoring

`lib/scoring.ts` is the single source of truth (rulebook v2). Unit tests in `lib/scoring.test.ts` cover the rulebook examples.

## Reference

- `rulebook-v2.md` — pool rules and scoring (authoritative).
- `teams-seed.json` — 48 teams, tiers, prices, groups, confederations.
