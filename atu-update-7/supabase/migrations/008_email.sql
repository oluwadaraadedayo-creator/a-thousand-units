-- A Thousand Units migration 008
-- Run ONCE in the Supabase SQL Editor, after 002 to 007 (007 is the admin one).
-- Adds the records the email system needs: whether a receipt was sent, and a log of every email attempt.

alter table public.orders add column if not exists receipt_sent_at timestamptz;
-- (Migration 006 limits which order columns signed-in users can read. This new column is not on that list, so it stays hidden from them.)

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  template text not null,
  ref text,                                   -- the order or report this email was about
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_recent_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;   -- no policies: server only. It holds no email addresses.
