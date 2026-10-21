-- Dedupe key so a scheduled job re-run never sends the same reminder twice
-- (e.g. 'due:<assignment>:2026-10-22'). Null for ordinary notifications.
alter table public.notifications add column ref text;
create unique index notifications_user_ref on public.notifications (user_id, ref);
