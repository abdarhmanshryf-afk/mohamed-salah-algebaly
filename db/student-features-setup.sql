-- =====================================================================
-- متقن — سكريبت واحد شامل: الإضافة اليدوية + مميزات الطالب
-- (ملاحظات، مفضلة، تقييمات، شهادات) — شغّله كاملًا في SQL Editor
-- آمن للتكرار. يغني عن admin-manual-enroll.sql (متضمّن هنا).
-- =====================================================================

-- 1) الإضافة اليدوية: السماح للأستاذ/الأدمن بإنشاء اشتراك
drop policy if exists staff_insert_enrollments on public.enrollments;
create policy staff_insert_enrollments on public.enrollments
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- 2) ملاحظات الطالب لكل درس
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
alter table public.lesson_notes enable row level security;
drop policy if exists notes_select_own on public.lesson_notes;
create policy notes_select_own on public.lesson_notes
  for select to authenticated using (auth.uid() = student_id);
drop policy if exists notes_insert_own on public.lesson_notes;
create policy notes_insert_own on public.lesson_notes
  for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists notes_update_own on public.lesson_notes;
create policy notes_update_own on public.lesson_notes
  for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
drop policy if exists notes_delete_own on public.lesson_notes;
create policy notes_delete_own on public.lesson_notes
  for delete to authenticated using (auth.uid() = student_id);
grant select, insert, update, delete on public.lesson_notes to authenticated;

-- 3) الدروس المفضلة
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
alter table public.favorites enable row level security;
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated using (auth.uid() = student_id);
drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (auth.uid() = student_id);
grant select, insert, delete on public.favorites to authenticated;

-- 4) تقييم الكورسات (نجوم + تعليق اختياري + إخفاء بواسطة الأستاذ)
create table if not exists public.course_ratings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);
alter table public.course_ratings enable row level security;
drop policy if exists ratings_select_visible on public.course_ratings;
create policy ratings_select_visible on public.course_ratings
  for select to authenticated
  using (is_hidden = false or auth.uid() = student_id or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));
drop policy if exists ratings_insert_own on public.course_ratings;
create policy ratings_insert_own on public.course_ratings
  for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists ratings_update_own on public.course_ratings;
create policy ratings_update_own on public.course_ratings
  for update to authenticated
  using (auth.uid() = student_id) with check (auth.uid() = student_id);
drop policy if exists ratings_staff_moderate on public.course_ratings;
create policy ratings_staff_moderate on public.course_ratings
  for update to authenticated
  using (public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
  with check (public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));
grant select, insert, update on public.course_ratings to authenticated;

-- 5) شهادات الإتمام
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  unique (student_id, course_id)
);
alter table public.certificates enable row level security;
drop policy if exists certificates_select_own on public.certificates;
create policy certificates_select_own on public.certificates
  for select to authenticated using (auth.uid() = student_id or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));
drop policy if exists certificates_insert_own on public.certificates;
create policy certificates_insert_own on public.certificates
  for insert to authenticated with check (auth.uid() = student_id);
grant select, insert on public.certificates to authenticated;

-- 6) تحقق — لازم كل صف يطلع 1
select 'policy staff_insert_enrollments' as check_name, count(*)::int as ok
from pg_policies where schemaname='public' and tablename='enrollments' and policyname='staff_insert_enrollments'
union all select 'table lesson_notes', count(*)::int from information_schema.tables where table_schema='public' and table_name='lesson_notes'
union all select 'table favorites', count(*)::int from information_schema.tables where table_schema='public' and table_name='favorites'
union all select 'table course_ratings', count(*)::int from information_schema.tables where table_schema='public' and table_name='course_ratings'
union all select 'table certificates', count(*)::int from information_schema.tables where table_schema='public' and table_name='certificates';
