-- =====================================================================
-- متقن — Phase 1 سكريبت واحد شامل: فصول الفيديو + التكرار المتباعد
-- + الامتحان التكيفي + غرف المذاكرة
-- شغّله كاملًا في SQL Editor — آمن للتكرار (idempotent).
-- لا يلغي أي سكريبت سابق؛ student-features-setup.sql يفضل مطلوب.
-- =====================================================================

-- 1) فصول الفيديو (chapters) لكل درس
create table if not exists public.lesson_chapters (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  seconds int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.lesson_chapters enable row level security;
drop policy if exists chapters_read_all on public.lesson_chapters;
create policy chapters_read_all on public.lesson_chapters
  for select to authenticated using (true);
drop policy if exists chapters_write_staff on public.lesson_chapters;
create policy chapters_write_staff on public.lesson_chapters
  for all to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role = 'teacher')
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role = 'teacher')
  );

-- 2) التكرار المتباعد: جدولة مراجعة الأسئلة
create table if not exists public.review_schedule (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  stage int not null default 0,            -- 0=يوم، 1=3 أيام، 2=أسبوع، 3=خلصت
  due_at timestamptz not null default now() + interval '1 day',
  last_result boolean,
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);
alter table public.review_schedule enable row level security;
drop policy if exists review_select_own on public.review_schedule;
create policy review_select_own on public.review_schedule
  for select to authenticated using (auth.uid() = student_id);
drop policy if exists review_insert_own on public.review_schedule;
create policy review_insert_own on public.review_schedule
  for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists review_update_own on public.review_schedule;
create policy review_update_own on public.review_schedule
  for update to authenticated using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
drop policy if exists review_delete_own on public.review_schedule;
create policy review_delete_own on public.review_schedule
  for delete to authenticated using (auth.uid() = student_id);

-- 3) الامتحان التكيفي: صعوبة السؤال + محاولات تحديد المستوى
alter table public.questions add column if not exists difficulty int not null default 2;
create table if not exists public.level_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  estimated_level int not null,            -- 1 سهل - 3 صعب
  created_at timestamptz not null default now()
);
alter table public.level_checks enable row level security;
drop policy if exists level_select_own on public.level_checks;
create policy level_select_own on public.level_checks
  for select to authenticated
  using (auth.uid() = student_id or public.is_admin()
         or exists (select 1 from public.profiles p
                    where p.id = auth.uid() and p.role = 'teacher'));
drop policy if exists level_insert_own on public.level_checks;
create policy level_insert_own on public.level_checks
  for insert to authenticated with check (auth.uid() = student_id);

-- 4) غرف المذاكرة (pomodoro)
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  phase text not null default 'study',     -- study | break
  phase_started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.study_room_members (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  minutes_this_week int not null default 0,
  primary key (room_id, student_id)
);
alter table public.study_rooms enable row level security;
alter table public.study_room_members enable row level security;
drop policy if exists rooms_read_all on public.study_rooms;
create policy rooms_read_all on public.study_rooms
  for select to authenticated using (true);
drop policy if exists rooms_insert_auth on public.study_rooms;
create policy rooms_insert_auth on public.study_rooms
  for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists rooms_update_member on public.study_rooms;
create policy rooms_update_member on public.study_rooms
  for update to authenticated
  using (auth.uid() = created_by
         or exists (select 1 from public.study_room_members m
                    where m.room_id = id and m.student_id = auth.uid()));
drop policy if exists rooms_delete_owner on public.study_rooms;
create policy rooms_delete_owner on public.study_rooms
  for delete to authenticated using (auth.uid() = created_by);
drop policy if exists members_read_all on public.study_room_members;
create policy members_read_all on public.study_room_members
  for select to authenticated using (true);
drop policy if exists members_insert_own on public.study_room_members;
create policy members_insert_own on public.study_room_members
  for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists members_update_own on public.study_room_members;
create policy members_update_own on public.study_room_members
  for update to authenticated using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
drop policy if exists members_delete_own on public.study_room_members;
create policy members_delete_own on public.study_room_members
  for delete to authenticated using (auth.uid() = student_id);

-- 5) دالة جدولة المراجعة بعد الامتحان (الأسئلة الغلط ترجع)
create or replace function public.schedule_review(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answers jsonb;
  v_q record;
  v_ans text;
begin
  select answers into v_answers
  from public.exam_attempts
  where exam_id = p_exam_id and student_id = auth.uid()
  order by created_at desc
  limit 1;
  if v_answers is null then
    return;
  end if;
  for v_q in
    select id, correct_answer from public.questions where exam_id = p_exam_id
  loop
    v_ans := v_answers ->> v_q.id::text;
    if v_ans is null or v_ans <> v_q.correct_answer then
      insert into public.review_schedule
        (student_id, question_id, stage, due_at, last_result)
      values (auth.uid(), v_q.id, 0, now() + interval '1 day', false)
      on conflict (student_id, question_id) do update
        set stage = 0,
            due_at = now() + interval '1 day',
            last_result = false,
            updated_at = now();
    end if;
  end loop;
end;
$$;
revoke all on function public.schedule_review(uuid) from public, anon;
grant execute on function public.schedule_review(uuid) to authenticated;

-- صلاحيات
grant select, insert, delete on public.lesson_chapters to authenticated;
grant update on public.lesson_chapters to authenticated;
grant select, insert, update, delete on public.review_schedule to authenticated;
grant select, insert on public.level_checks to authenticated;
grant select, insert, update, delete on public.study_rooms to authenticated;
grant select, insert, update, delete on public.study_room_members to authenticated;

-- تحقق: المفروض يطلع 7 صفوف
select 'lesson_chapters' as check_item, count(*)::int as found
from pg_tables where schemaname='public' and tablename='lesson_chapters'
union all
select 'review_schedule', count(*)::int
from pg_tables where schemaname='public' and tablename='review_schedule'
union all
select 'level_checks', count(*)::int
from pg_tables where schemaname='public' and tablename='level_checks'
union all
select 'study_rooms', count(*)::int
from pg_tables where schemaname='public' and tablename='study_rooms'
union all
select 'study_room_members', count(*)::int
from pg_tables where schemaname='public' and tablename='study_room_members'
union all
select 'questions.difficulty column', count(*)::int
from information_schema.columns
where table_schema='public' and table_name='questions' and column_name='difficulty'
union all
select 'function schedule_review', count(*)::int
from pg_proc where proname = 'schedule_review';
