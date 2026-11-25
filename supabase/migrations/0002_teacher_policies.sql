-- منصة الأستاذ محمد صلاح الجبالي
-- Teacher dashboard policies.
-- Run AFTER 0001_initial_schema.sql in the Supabase SQL Editor.
-- Also run this once to promote the teacher account (put his user id):
--   update public.profiles set role = 'teacher' where id = '<teacher-user-id>';

-- Helper: true when the current user has the teacher role.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- Teachers can read every profile (student lists, subscription requests).
create policy "profiles_teacher_read_all" on public.profiles
for select to authenticated using (public.is_teacher());

-- Teachers can read, add and update all courses (publish, price, duration).
create policy "courses_teacher_read_all" on public.courses
for select to authenticated using (public.is_teacher());

create policy "courses_teacher_insert" on public.courses
for insert to authenticated with check (public.is_teacher());

create policy "courses_teacher_update" on public.courses
for update to authenticated using (public.is_teacher())
with check (public.is_teacher());

-- Teachers can read all enrollments and update them (approve / reject requests).
create policy "enrollments_teacher_read_all" on public.enrollments
for select to authenticated using (public.is_teacher());

create policy "enrollments_teacher_update" on public.enrollments
for update to authenticated using (public.is_teacher())
with check (public.is_teacher());

-- Teachers can manage lessons of their courses (ready for the lessons screen).
create policy "lessons_teacher_read_all" on public.lessons
for select to authenticated using (public.is_teacher());

create policy "lessons_teacher_insert" on public.lessons
for insert to authenticated with check (public.is_teacher());

create policy "lessons_teacher_update" on public.lessons
for update to authenticated using (public.is_teacher())
with check (public.is_teacher());
