-- منصة الأستاذ محمد صلاح الجبالي
-- Initial schema for a NEW, empty Supabase project.
-- Review before running on any database that contains data.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'student' check (role in ('student','teacher')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  created_at timestamptz not null default now(),
  unique(student_id, course_id)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  video_path text,
  pdf_path text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  sort_order integer not null default 0
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric(6,2),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.lessons enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;

-- Profiles: users can read/update only their own profile.
create policy "profiles_read_own" on public.profiles
for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id)
with check (auth.uid() = id and role = 'student');

-- Published course catalog is visible to signed-in users.
create policy "courses_read_published" on public.courses
for select to authenticated using (is_published = true);

-- Students can read their own enrollments.
create policy "enrollments_read_own" on public.enrollments
for select to authenticated using (auth.uid() = student_id);

-- Lessons are visible only when published and the student has an active enrollment.
create policy "lessons_read_enrolled" on public.lessons
for select to authenticated using (
  is_published = true and exists (
    select 1 from public.enrollments e
    where e.course_id = lessons.course_id
      and e.student_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "exams_read_published" on public.exams
for select to authenticated using (
  is_published = true and exists (
    select 1 from public.enrollments e
    where e.course_id = exams.course_id
      and e.student_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  )
);

-- IMPORTANT: Do not expose correct_answer to student-facing clients.
-- Fetch questions through a secure server endpoint that omits that column.
create policy "questions_read_for_enrolled_exam" on public.questions
for select to authenticated using (
  exists (
    select 1
    from public.exams x
    join public.enrollments e on e.course_id = x.course_id
    where x.id = questions.exam_id
      and x.is_published = true
      and e.student_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "attempts_read_own" on public.exam_attempts
for select to authenticated using (auth.uid() = student_id);

create policy "attempts_insert_own" on public.exam_attempts
for insert to authenticated with check (auth.uid() = student_id);

-- Create a student profile automatically after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
