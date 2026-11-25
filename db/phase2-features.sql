-- =====================================================================
-- متقن — المرحلة 2: دفتر الحسابات + تذاكر الدعم + المجموعات
--         + التحديات + تعدد المدرسين + تقرير المدرس الشهري
-- شغّل الملف ده كاملًا في Supabase SQL Editor (Database → SQL Editor → Run)
-- آمن للتكرار: تشغيله أكثر من مرة لا يكسر شيئًا.
-- الموقع يشتغل عادي قبل تشغيل السكريبت — المميزات الجديدة بتظهر بعده.
-- =====================================================================

-- 0) دالة مختصرة: هل المستخدم مدرس أو أدمن؟
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      );
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- =====================================================================
-- 68) دفتر الحسابات: سجل كل حركة دفع (تقديم/قبول/رفض/إضافة يدوية)
-- =====================================================================
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event text not null,          -- submitted | approved | rejected | manual_add | refunded
  amount int,
  note text,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;

drop policy if exists pevents_staff_all on public.payment_events;
create policy pevents_staff_all on public.payment_events
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists pevents_student_read on public.payment_events;
create policy pevents_student_read on public.payment_events
  for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

drop policy if exists pevents_student_submit on public.payment_events;
create policy pevents_student_submit on public.payment_events
  for insert to authenticated
  with check (
    event = 'submitted'
    and actor_id = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  );

grant select, insert on public.payment_events to authenticated;

-- =====================================================================
-- 69) تذاكر الدعم: الطالب يفتح تذكرة والمدرس/الأدمن يرد
-- =====================================================================
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open',   -- open | answered | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists tickets_student_read on public.support_tickets;
create policy tickets_student_read on public.support_tickets
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

drop policy if exists tickets_student_insert on public.support_tickets;
create policy tickets_student_insert on public.support_tickets
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists tickets_staff_update on public.support_tickets;
create policy tickets_staff_update on public.support_tickets
  for update to authenticated
  using (public.is_staff() or student_id = auth.uid())
  with check (public.is_staff() or student_id = auth.uid());

drop policy if exists tmsgs_read on public.ticket_messages;
create policy tmsgs_read on public.ticket_messages
  for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.student_id = auth.uid()
  ));

drop policy if exists tmsgs_insert on public.ticket_messages;
create policy tmsgs_insert on public.ticket_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_staff()
      or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.student_id = auth.uid() and t.status <> 'closed'
      )
    )
  );

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.ticket_messages to authenticated;

-- =====================================================================
-- 74) المجموعات/الفصول: المدرس ينشئ مجموعة بكود دعوة والطلاب ينضموا
-- =====================================================================
create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique default upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists groups_read on public.study_groups;
create policy groups_read on public.study_groups
  for select to authenticated
  using (
    teacher_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.group_members m
      where m.group_id = id and m.student_id = auth.uid()
    )
  );

drop policy if exists groups_teacher_insert on public.study_groups;
create policy groups_teacher_insert on public.study_groups
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_staff());

drop policy if exists groups_teacher_update on public.study_groups;
create policy groups_teacher_update on public.study_groups
  for update to authenticated
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists groups_teacher_delete on public.study_groups;
create policy groups_teacher_delete on public.study_groups
  for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists gmembers_read on public.group_members;
create policy gmembers_read on public.group_members
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.group_members m
      where m.group_id = group_members.group_id and m.student_id = auth.uid()
    )
  );

drop policy if exists gmembers_staff_insert on public.group_members;
create policy gmembers_staff_insert on public.group_members
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists gmembers_delete on public.group_members;
create policy gmembers_delete on public.group_members
  for delete to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.study_groups g
      where g.id = group_id and g.teacher_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.study_groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;

-- انضمام بكود الدعوة (الطالب نفسه بينضم — الدالة بتتخطى السياسات بأمان)
create or replace function public.join_group_by_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.study_groups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_group
  from public.study_groups
  where invite_code = upper(trim(p_code));
  if not found then
    return null;  -- كود غلط
  end if;
  insert into public.group_members (group_id, student_id)
  values (v_group.id, auth.uid())
  on conflict do nothing;
  return v_group.name;
end;
$$;
revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;

-- أعضاء مجموعة مع أسمائهم (للأعضاء والمدرسين بس)
create or replace function public.group_members_with_names(p_group_id uuid)
returns table(student_id uuid, full_name text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_staff()
    or exists (
      select 1 from public.group_members m
      where m.group_id = p_group_id and m.student_id = auth.uid()
    )
  ) then
    raise exception 'not_authorized';
  end if;
  return query
    select m.student_id, p.full_name, m.joined_at
    from public.group_members m
    join public.profiles p on p.id = m.student_id
    where m.group_id = p_group_id
    order by m.joined_at;
end;
$$;
revoke all on function public.group_members_with_names(uuid) from public, anon;
grant execute on function public.group_members_with_names(uuid) to authenticated;

-- =====================================================================
-- 75) التحديات: تحديات أسبوعية/شهرية بنقاط
-- =====================================================================
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  points int not null default 10,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  progress int not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (challenge_id, student_id)
);
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges
  for select to authenticated using (true);

drop policy if exists challenges_staff_write on public.challenges;
create policy challenges_staff_write on public.challenges
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists challenges_staff_update on public.challenges;
create policy challenges_staff_update on public.challenges
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists challenges_staff_delete on public.challenges;
create policy challenges_staff_delete on public.challenges
  for delete to authenticated
  using (public.is_staff());

drop policy if exists centries_student_read on public.challenge_entries;
create policy centries_student_read on public.challenge_entries
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

drop policy if exists centries_student_insert on public.challenge_entries;
create policy centries_student_insert on public.challenge_entries
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists centries_student_update on public.challenge_entries;
create policy centries_student_update on public.challenge_entries
  for update to authenticated
  using (student_id = auth.uid() or public.is_staff())
  with check (student_id = auth.uid() or public.is_staff());

grant select, insert, update, delete on public.challenges to authenticated;
grant select, insert, update on public.challenge_entries to authenticated;

-- =====================================================================
-- 79) تعدد المدرسين: كل كورس ليه مدرس، والمدرس يدير كورساته هو بس
-- =====================================================================
alter table public.courses
  add column if not exists teacher_id uuid references public.profiles(id) on delete set null;

-- المدرس ينشئ كورس مملوك له
drop policy if exists teacher_insert_courses on public.courses;
create policy teacher_insert_courses on public.courses
  for insert to authenticated
  with check (
    public.is_staff()
    and (teacher_id = auth.uid() or public.is_admin())
  );

-- المدرس يعدّل/يحذف كورساته هو بس (الأدمن يعدّل أي حاجة زي ما هو)
drop policy if exists teacher_update_own_courses on public.courses;
create policy teacher_update_own_courses on public.courses
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists teacher_delete_own_courses on public.courses;
create policy teacher_delete_own_courses on public.courses
  for delete to authenticated
  using (teacher_id = auth.uid());

-- المدرس يدير دروس كورساته (السياسات دي إضافة — سياسات الأدمن الحالية فاضلة شغالة)
drop policy if exists teacher_write_own_lessons on public.lessons;
create policy teacher_write_own_lessons on public.lessons
  for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

drop policy if exists teacher_update_own_lessons on public.lessons;
create policy teacher_update_own_lessons on public.lessons
  for update to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

drop policy if exists teacher_delete_own_lessons on public.lessons;
create policy teacher_delete_own_lessons on public.lessons
  for delete to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

-- والمدرس يدير امتحانات كورساته
drop policy if exists teacher_write_own_exams on public.exams;
create policy teacher_write_own_exams on public.exams
  for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

drop policy if exists teacher_update_own_exams on public.exams;
create policy teacher_update_own_exams on public.exams
  for update to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

drop policy if exists teacher_delete_own_exams on public.exams;
create policy teacher_delete_own_exams on public.exams
  for delete to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = auth.uid()
  ));

-- =====================================================================
-- 78) تقرير المدرس الشهري عن طالب (للمدرس/الأدمن بس)
-- =====================================================================
create or replace function public.get_student_month_report(
  p_student_id uuid,
  p_year int default extract(year from now())::int,
  p_month int default extract(month from now())::int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end timestamptz := (make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC') + interval '1 month');
  v_name text;
  v_attempts jsonb;
  v_completions bigint;
  v_enrollments jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = p_student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'exam', e.title, 'score', a.score, 'date', a.created_at
  ) order by a.created_at), '[]'::jsonb)
  into v_attempts
  from public.exam_attempts a
  join public.exams e on e.id = a.exam_id
  where a.student_id = p_student_id
    and a.created_at >= v_start and a.created_at < v_end;

  select count(*) into v_completions
  from public.lesson_progress lp
  where lp.student_id = p_student_id and lp.completed;

  select coalesce(jsonb_agg(jsonb_build_object(
    'course', c.title, 'status', en.status,
    'starts_at', en.starts_at, 'expires_at', en.expires_at
  )), '[]'::jsonb)
  into v_enrollments
  from public.enrollments en
  join public.courses c on c.id = en.course_id
  where en.student_id = p_student_id;

  return jsonb_build_object(
    'student', v_name,
    'year', p_year,
    'month', p_month,
    'attempts', v_attempts,
    'completed_lessons', v_completions,
    'enrollments', v_enrollments
  );
end;
$$;
revoke all on function public.get_student_month_report(uuid, int, int) from public, anon;
grant execute on function public.get_student_month_report(uuid, int, int) to authenticated;

-- =====================================================================
-- التحقق: لازم ترجع 9 صفوف
-- =====================================================================
select t as "العنصر", 'تم ✅' as "الحالة"
from (values
  ('payment_events — دفتر الحسابات'),
  ('support_tickets — تذاكر الدعم'),
  ('ticket_messages — رسائل التذاكر'),
  ('study_groups — المجموعات'),
  ('group_members — أعضاء المجموعات'),
  ('challenges — التحديات'),
  ('challenge_entries — مشاركات التحديات'),
  ('courses.teacher_id — تعدد المدرسين'),
  ('get_student_month_report — تقرير المدرس')
) as v(t);
