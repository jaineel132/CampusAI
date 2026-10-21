-- Assignment agent: a professor uploads the assignment PDF, the agent drafts the assignment for approval.
alter table public.approvals drop constraint approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
  check (kind in ('feedback_draft', 'announcement', 'reminder_batch', 'assignment_draft'));

-- The original brief, kept so students can open it. Lives in the materials bucket under <institution>/<course>/briefs/.
alter table public.assignments add column file_path text
  check (file_path is null or file_path like institution_id::text || '/' || course_id::text || '/briefs/%');
