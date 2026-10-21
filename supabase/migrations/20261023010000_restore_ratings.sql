-- Professor ratings restored (reverses 20261023000000_drop_ratings.sql). Copied from the original schema.

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

alter table public.professor_ratings enable row level security;
alter table public.rating_summaries enable row level security;

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


-- Anonymous aggregates: runs with owner rights, filters to caller's own courses (or all for admin).
create view public.rating_aggregates as
  select r.course_id, r.professor_id, round(avg(r.rating), 2) as average, count(*)::int as count
  from public.professor_ratings r
  where r.institution_id = public.my_institution()
    and (r.professor_id = auth.uid() or public.my_role() = 'admin')
  group by r.course_id, r.professor_id;
grant select on public.rating_aggregates to authenticated;
