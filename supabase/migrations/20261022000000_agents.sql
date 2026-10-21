-- Submission agent output + professor-approved feedback
alter table public.submissions alter column precheck type jsonb using precheck::jsonb;
alter table public.submissions add column feedback text, add column feedback_released_at timestamptz;

-- Materials agent status (indexing status stays in documents.status)
alter table public.documents add column summary_status text not null default 'pending'
  check (summary_status in ('pending', 'done', 'failed'));

-- Students could previously update their own row directly (e.g. flip is_late or write a precheck).
-- Submissions are now written only by server code after validation; RLS still governs reads.
drop policy "student submits" on public.submissions;
drop policy "student resubmits" on public.submissions;
