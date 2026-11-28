-- =====================================================================
-- phase4-notifications.sql
-- 1) إشعار للطلاب أول ما الأستاذ ينزّل اختبار جديد أو تحدي جديد
-- 2) إصلاح إشعار حذف الدرس (كان من غير اسم الدرس) + تنضيف الإشعارات القديمة
-- 3) السماح للطالب يحذف إشعاراته من صفحة الإشعارات
--
-- شغّله في Supabase → SQL Editor مرة واحدة.
-- السكريبت آمن لو اتشغّل أكتر من مرة.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (أ) نشيل أي تريجر إشعارات قديم على الدروس/الاختبارات/التحديات
--     (بس التريجرات اللي فنكشنها بتكتب في جدول notifications — مش أي تريجر تاني)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  if to_regclass('public.lessons') is not null then
    for r in
      select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.lessons'::regclass
        and not t.tgisinternal
        and pg_get_functiondef(p.oid) ilike '%notifications%'
    loop
      execute format('drop trigger if exists %I on public.lessons', r.tgname);
    end loop;
  end if;

  if to_regclass('public.exams') is not null then
    for r in
      select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.exams'::regclass
        and not t.tgisinternal
        and pg_get_functiondef(p.oid) ilike '%notifications%'
    loop
      execute format('drop trigger if exists %I on public.exams', r.tgname);
    end loop;
  end if;

  if to_regclass('public.challenges') is not null then
    for r in
      select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.challenges'::regclass
        and not t.tgisinternal
        and pg_get_functiondef(p.oid) ilike '%notifications%'
    loop
      execute format('drop trigger if exists %I on public.challenges', r.tgname);
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- (ب) الدوال
-- ---------------------------------------------------------------------

-- درس جديد → الطلاب المشتركين في نفس الكورس
create or replace function public.notify_on_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select e.student_id,
         '📚 درس جديد: ' || coalesce(new.title, ''),
         null,
         '/courses/' || new.course_id
  from public.enrollments e
  where e.course_id = new.course_id
    and e.status = 'active';
  return new;
end;
$$;

-- درس اتحذف → الطلاب المشتركين في نفس الكورس (باسم الدرس)
create or replace function public.notify_on_lesson_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select e.student_id,
         '🗑️ اتشال درس: ' || coalesce(old.title, 'درس'),
         'الدرس ده اتشال من الكورس.',
         '/courses/' || old.course_id
  from public.enrollments e
  where e.course_id = old.course_id
    and e.status = 'active';
  return old;
end;
$$;

-- اختبار جديد → الطلاب المشتركين في الكورس (أول ما يتنشر)
create or replace function public.notify_on_exam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course text;
begin
  if new.is_published is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- لو كان منشور قبل كده خلاص، مش بنبعت تاني
    if old.is_published is true then
      return new;
    end if;
  end if;

  select c.title into v_course from public.courses c where c.id = new.course_id;

  insert into public.notifications (user_id, title, body, link)
  select e.student_id,
         '📝 اختبار جديد: ' || coalesce(new.title, ''),
         case when v_course is null then null else 'في كورس: ' || v_course end,
         '/exams'
  from public.enrollments e
  where e.course_id = new.course_id
    and e.status = 'active';
  return new;
end;
$$;

-- تحدي جديد → كل الطلاب
create or replace function public.notify_on_challenge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.active, true) is false then
    return new;
  end if;

  insert into public.notifications (user_id, title, body, link)
  select p.id,
         '🏆 تحدي جديد: ' || coalesce(new.title, ''),
         nullif(left(coalesce(new.description, ''), 140), ''),
         '/challenges'
  from public.profiles p
  where p.role = 'student';
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- (ج) ربط التريجرات
-- ---------------------------------------------------------------------
drop trigger if exists trg_notify_lesson on public.lessons;
create trigger trg_notify_lesson
  after insert on public.lessons
  for each row execute function public.notify_on_lesson();

drop trigger if exists trg_notify_lesson_delete on public.lessons;
create trigger trg_notify_lesson_delete
  after delete on public.lessons
  for each row execute function public.notify_on_lesson_delete();

drop trigger if exists trg_notify_exam on public.exams;
create trigger trg_notify_exam
  after insert or update of is_published on public.exams
  for each row execute function public.notify_on_exam();

drop trigger if exists trg_notify_challenge on public.challenges;
create trigger trg_notify_challenge
  after insert on public.challenges
  for each row execute function public.notify_on_challenge();

-- ---------------------------------------------------------------------
-- (د) الطالب يقدر يحذف إشعاراته (dismiss / clear)
-- ---------------------------------------------------------------------
drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

grant delete on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- (هـ) تنضيف الإشعارات القديمة اللي بتقول «تم حذف درس» من غير اسم الدرس
--     (اسم الدرس القديم مش متسجل، فبنكتب نص واضح بدل النص الناقص)
-- ---------------------------------------------------------------------
update public.notifications
set title = '🗑️ اتشال درس',
    body  = coalesce(
      nullif(trim(body), ''),
      'الدرس ده اتشال من الكورس — تقدر تحذف الإشعار من صفحة الإشعارات.'
    )
where title ilike '%حذف%'
  and title ilike '%درس%';

-- ---------------------------------------------------------------------
-- التحقق
-- ---------------------------------------------------------------------
select 'تريجرات الإشعارات (لازم 4)' as "العنصر",
       count(*)::text as "الحالة"
from pg_trigger
where not tgisinternal
  and tgname in (
    'trg_notify_lesson',
    'trg_notify_lesson_delete',
    'trg_notify_exam',
    'trg_notify_challenge'
  );

select 'سياسة حذف الإشعارات (لازم 1)' as "العنصر",
       count(*)::text as "الحالة"
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
  and policyname = 'notif_delete_own';
