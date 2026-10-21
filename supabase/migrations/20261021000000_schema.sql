-- CampusOS schema: every table belongs to an institution; RLS checks institution first, then role.
create extension if not exists vector with schema extensions;

-- ───────────── Tables ─────────────

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null check (currency in ('INR', 'USD')),
  term_type text not null check (term_type in ('semester', 'quarter', 'trimester')),
  grading_scale text not null check (grading_scale in ('gpa4', 'cgpa10', 'percentage')),
  current_term text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  institution_id uuid not null references public.institutions on delete cascade,
  role text not null check (role in ('student', 'professor', 'admin')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);
create index on public.profiles (institution_id, role);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  code text not null,
  name text not null,
  professor_id uuid not null references public.profiles on delete cascade,
  term text not null,
  created_at timestamptz not null default now()
);
create index on public.courses (institution_id);
create index on public.courses (professor_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);
create index on public.enrollments (student_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  title text not null,
  instructions text not null,
  rubric jsonb not null default '[]', -- array of rubric item strings
  due_at timestamptz not null,
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.assignments (course_id, due_at);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  assignment_id uuid not null references public.assignments on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  file_path text not null,
  file_name text not null,
  is_late boolean not null default false,
  precheck text,
  precheck_status text not null default 'pending' check (precheck_status in ('pending', 'done', 'failed')),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id) -- one active submission per student per assignment
);
create index on public.submissions (student_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  course_id uuid references public.courses on delete cascade, -- null = college-wide
  uploaded_by uuid not null references public.profiles on delete cascade,
  title text not null,
  file_path text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error text,
  summary text,
  page_count int,
  created_at timestamptz not null default now()
);
create index on public.documents (institution_id, course_id);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions on delete cascade,
  document_id uuid not null references public.documents on delete cascade,
  course_id uuid references public.courses on delete cascade,
  page int not null,
  content text not null,
  embedding extensions.vector(384) not null
);
create index on public.document_chunks (document_id);
create index on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.fee_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  description text not null,
  term text not null,
  amount_due numeric(12, 2) not null check (amount_due > 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  due_date date not null,
  status text generated always as (
    case when amount_paid >= amount_due then 'paid' when amount_paid > 0 then 'partial' else 'unpaid' end
  ) stored,
  created_at timestamptz not null default now()
);
create index on public.fee_records (student_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  fee_record_id uuid not null references public.fee_records on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null,
  stripe_session_id text not null unique, -- webhook idempotency
  receipt_url text,
  paid_at timestamptz not null default now()
);
create index on public.payments (student_id);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  agent text not null,
  trigger text not null check (trigger in ('event', 'schedule', 'chat')),
  user_id uuid references public.profiles on delete cascade, -- whom the run acted for
  input jsonb,
  output jsonb,
  tools_called text[] not null default '{}',
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.agent_runs (institution_id, agent, started_at desc);
create index on public.agent_runs (user_id, started_at desc);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  kind text not null check (kind in ('feedback_draft', 'announcement', 'reminder_batch')),
  reviewer_role text not null check (reviewer_role in ('professor', 'admin')),
  course_id uuid references public.courses on delete cascade,
  agent_run_id uuid references public.agent_runs on delete set null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.approvals (institution_id, status);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  course_id uuid references public.courses on delete cascade, -- null = college-wide
  author_id uuid not null references public.profiles on delete cascade,
  title text not null,
  body text not null,
  approval_id uuid references public.approvals on delete set null,
  published_at timestamptz not null default now()
);
create index on public.announcements (institution_id, published_at desc);

create table public.professor_ratings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  professor_id uuid not null references public.profiles on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  term text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, term) -- one rating per student per course per term
);
create index on public.professor_ratings (course_id);

create table public.rating_summaries ( -- Feedback Agent output
  course_id uuid primary key references public.courses on delete cascade,
  institution_id uuid not null references public.institutions on delete cascade,
  professor_id uuid not null references public.profiles on delete cascade,
  themes text not null,
  updated_at timestamptz not null default now()
);

create table public.notifications ( -- student activity feed: reminders, agent results
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  agent_run_id uuid references public.agent_runs on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- ───────────── RLS helpers (security definer avoids policy recursion) ─────────────

create function public.my_institution() returns uuid
language sql stable security definer set search_path = '' as
$$ select institution_id from public.profiles where id = auth.uid() $$;

create function public.my_role() returns text
language sql stable security definer set search_path = '' as
$$ select role from public.profiles where id = auth.uid() $$;

create function public.is_enrolled(course uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.enrollments where course_id = course and student_id = auth.uid()) $$;

create function public.teaches(course uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.courses where id = course and professor_id = auth.uid()) $$;

-- course visible to me: admin sees all in college, professor sees taught, student sees enrolled
create function public.can_see_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select public.my_role() = 'admin' or public.teaches(course) or public.is_enrolled(course) $$;

-- ───────────── RLS policies ─────────────

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.fee_records enable row level security;
alter table public.payments enable row level security;
alter table public.agent_runs enable row level security;
alter table public.approvals enable row level security;
alter table public.announcements enable row level security;
alter table public.professor_ratings enable row level security;
alter table public.rating_summaries enable row level security;
alter table public.notifications enable row level security;

create policy "own college" on public.institutions for select to authenticated
  using (id = public.my_institution());

-- students see themselves plus staff; staff see everyone in their college
create policy "college members" on public.profiles for select to authenticated
  using (institution_id = public.my_institution()
    and (id = auth.uid() or role <> 'student' or public.my_role() <> 'student'));

create policy "visible courses" on public.courses for select to authenticated
  using (institution_id = public.my_institution() and public.can_see_course(id));

create policy "visible enrollments" on public.enrollments for select to authenticated
  using (institution_id = public.my_institution()
    and (student_id = auth.uid() or public.teaches(course_id) or public.my_role() = 'admin'));

create policy "visible assignments" on public.assignments for select to authenticated
  using (institution_id = public.my_institution() and public.can_see_course(course_id));
create policy "professor writes assignments" on public.assignments for insert to authenticated
  with check (institution_id = public.my_institution() and public.teaches(course_id) and created_by = auth.uid());
create policy "professor edits assignments" on public.assignments for update to authenticated
  using (institution_id = public.my_institution() and public.teaches(course_id));

create policy "own or taught submissions" on public.submissions for select to authenticated
  using (institution_id = public.my_institution() and (
    student_id = auth.uid() or public.my_role() = 'admin'
    or exists (select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id))));
create policy "student submits" on public.submissions for insert to authenticated
  with check (institution_id = public.my_institution() and student_id = auth.uid()
    and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled(a.course_id)));
create policy "student resubmits" on public.submissions for update to authenticated
  using (institution_id = public.my_institution() and student_id = auth.uid());

create policy "visible documents" on public.documents for select to authenticated
  using (institution_id = public.my_institution() and (course_id is null or public.can_see_course(course_id)));
create policy "staff uploads" on public.documents for insert to authenticated
  with check (institution_id = public.my_institution() and uploaded_by = auth.uid()
    and ((course_id is null and public.my_role() = 'admin') or public.teaches(course_id)));

create policy "visible chunks" on public.document_chunks for select to authenticated
  using (institution_id = public.my_institution() and (course_id is null or public.can_see_course(course_id)));

create policy "own fees" on public.fee_records for select to authenticated
  using (institution_id = public.my_institution() and (student_id = auth.uid() or public.my_role() = 'admin'));

create policy "own payments" on public.payments for select to authenticated
  using (institution_id = public.my_institution() and (student_id = auth.uid() or public.my_role() = 'admin'));

create policy "own agent runs" on public.agent_runs for select to authenticated
  using (institution_id = public.my_institution() and (user_id = auth.uid() or public.my_role() = 'admin'));

create policy "reviewer sees approvals" on public.approvals for select to authenticated
  using (institution_id = public.my_institution() and (
    (reviewer_role = 'admin' and public.my_role() = 'admin')
    or (reviewer_role = 'professor' and public.teaches(course_id))));
create policy "reviewer decides approvals" on public.approvals for update to authenticated
  using (institution_id = public.my_institution() and (
    (reviewer_role = 'admin' and public.my_role() = 'admin')
    or (reviewer_role = 'professor' and public.teaches(course_id))));

create policy "audience sees announcements" on public.announcements for select to authenticated
  using (institution_id = public.my_institution() and (course_id is null or public.can_see_course(course_id)));
create policy "staff publishes announcements" on public.announcements for insert to authenticated
  with check (institution_id = public.my_institution() and author_id = auth.uid()
    and ((course_id is null and public.my_role() = 'admin') or public.teaches(course_id)));

-- ratings: students only ever see their own rows; professors read the anonymous view below
create policy "own ratings" on public.professor_ratings for select to authenticated
  using (student_id = auth.uid());
create policy "student rates" on public.professor_ratings for insert to authenticated
  with check (institution_id = public.my_institution() and student_id = auth.uid() and public.is_enrolled(course_id)
    and professor_id = (select c.professor_id from public.courses c where c.id = course_id));
create policy "student edits rating" on public.professor_ratings for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and public.is_enrolled(course_id)
    and professor_id = (select c.professor_id from public.courses c where c.id = course_id));

create policy "professor or admin sees themes" on public.rating_summaries for select to authenticated
  using (institution_id = public.my_institution() and (professor_id = auth.uid() or public.my_role() = 'admin'));

create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- Anonymous aggregates: runs with owner rights, filters to caller's own courses (or all for admin).
create view public.rating_aggregates as
  select r.course_id, r.professor_id, round(avg(r.rating), 2) as average, count(*)::int as count
  from public.professor_ratings r
  where r.institution_id = public.my_institution()
    and (r.professor_id = auth.uid() or public.my_role() = 'admin')
  group by r.course_id, r.professor_id;
grant select on public.rating_aggregates to authenticated;

-- ───────────── RAG search (security invoker → chunk RLS limits scope) ─────────────

create function public.match_chunks(query_embedding extensions.vector(384), match_count int default 5)
returns table (document_id uuid, title text, page int, content text, similarity float)
language sql stable security invoker set search_path = public, extensions as
$$
  select c.document_id, d.title, c.page, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'ready'
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- ───────────── Storage: private buckets, no user policies (server uses signed URLs) ─────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 10485760), ('submissions', 'submissions', false, 10485760);
