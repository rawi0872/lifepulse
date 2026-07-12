# Private Beta Feedback Review Guide

## Purpose

This guide is for reviewing feedback submitted through the Life Pulse private beta feedback modal.

It is for the founder/developer only. Do not send this guide to testers.

## Where Feedback Lives

The feedback table is defined in `supabase/migrations/00011_beta_feedback.sql`.

Table: `public.beta_feedback`

Columns from the migration:

- `id` - UUID primary key.
- `user_id` - Supabase auth user ID, nullable if the user is later deleted.
- `page_path` - route where feedback was submitted.
- `rating` - optional 1-5 rating.
- `category` - optional category: `bug`, `confusing`, `idea`, `praise`, or `other`.
- `message` - required tester message.
- `browser_info` - user agent, screen size, and viewport captured by the feedback modal.
- `created_at` - timestamp when feedback was submitted.

The feedback modal inserts:

- `user_id`
- `page_path`
- `rating`
- `category`
- `message`
- `browser_info`

## Safe Supabase Review Process

1. Open Supabase Dashboard.
2. Confirm you are in the correct production project.
3. Open SQL Editor.
4. Run only read-only `select` queries during review.
5. Do not update or delete rows during beta review.
6. Copy only the summarized feedback needed into `docs/private-beta-round-1-issue-log.md`.

## Read-Only SQL Queries

### Latest Feedback First

```sql
select
  id,
  created_at,
  user_id,
  page_path,
  rating,
  category,
  message,
  browser_info
from public.beta_feedback
order by created_at desc
limit 50;
```

### Feedback From The Last 24 Hours

```sql
select
  id,
  created_at,
  user_id,
  page_path,
  rating,
  category,
  message,
  browser_info
from public.beta_feedback
where created_at >= now() - interval '24 hours'
order by created_at desc;
```

### Feedback Grouped By Route/Page

```sql
select
  coalesce(page_path, '(unknown)') as page_path,
  count(*) as feedback_count,
  max(created_at) as latest_feedback_at
from public.beta_feedback
group by coalesce(page_path, '(unknown)')
order by feedback_count desc, latest_feedback_at desc;
```

### Feedback Grouped By Category

```sql
select
  coalesce(category, '(uncategorized)') as category,
  count(*) as feedback_count,
  avg(rating) as average_rating,
  max(created_at) as latest_feedback_at
from public.beta_feedback
group by coalesce(category, '(uncategorized)')
order by feedback_count desc, latest_feedback_at desc;
```

### Feedback From A Specific User

Use this only when needed for internal triage. Replace the UUID with the tester's `user_id`.

```sql
select
  id,
  created_at,
  page_path,
  rating,
  category,
  message,
  browser_info
from public.beta_feedback
where user_id = '00000000-0000-0000-0000-000000000000'
order by created_at desc;
```

### Feedback Count Per Day

```sql
select
  date_trunc('day', created_at) as feedback_day,
  count(*) as feedback_count
from public.beta_feedback
group by date_trunc('day', created_at)
order by feedback_day desc;
```

## Privacy And Safety Rules

- Treat tester messages as private beta data.
- Do not share raw tester feedback publicly.
- Do not screenshot private email addresses, user IDs, or raw messages unless needed internally.
- Prefer summarizing feedback into the issue log instead of copying full raw messages.
- Do not edit production feedback rows casually.
- Do not delete feedback just because it is negative.
- Do not export feedback to public tools without checking what personal data is included.

## Transfer Feedback Into The Issue Log

Use `docs/private-beta-round-1-issue-log.md` for the working triage log.

Map submitted feedback like this:

- ID: use a short issue ID such as `R1-001`; keep the raw `beta_feedback.id` only if useful internally.
- Date: use `created_at`.
- Tester: use tester name if known; otherwise reference the internal tester label, not a public user ID.
- Device/browser: summarize from `browser_info`.
- Route/page: use `page_path`.
- Category: use submitted `category`, then adjust if triage needs a clearer category.
- Severity: assign P0-P3 using `docs/private-beta-feedback-triage.md`.
- Feedback summary: summarize the message without copying unnecessary private details.
- Screenshot/video?: mark yes/no and link internal storage if available.
- Reproduced?: yes/no/not yet.
- Decision: choose a bucket such as fix before more testers, fix this week, watch, save for later, or reject.
- Status: open, in progress, fixed, deferred, rejected.
- Linked commit/fix: add commit hash after a fix ships.

## Daily Review Rhythm

- Check feedback once or twice per day.
- Add important items to the Round 1 issue log.
- Group repeated issues before deciding fixes.
- Pick only the top 1-3 fixes after the first wave.
- Avoid overreacting to one opinion.
- Run production QA after every shipped fix.

## What Not To Do

- Do not run destructive SQL.
- Do not update or delete feedback rows during normal review.
- Do not immediately build every request.
- Do not change product direction from one tester.
- Do not add big features during Round 1 unless there is a blocker.
- Do not build admin pages just to review a small amount of feedback.

## Optional Improvement Later

A protected founder-only feedback dashboard could be built later if feedback volume becomes hard to manage in Supabase.

If built later, it must be secured carefully, avoid exposing tester data unnecessarily, and should not be added during this waiting phase unless the manual review process becomes a bottleneck.
