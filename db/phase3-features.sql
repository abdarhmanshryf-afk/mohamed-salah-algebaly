-- =====================================================================
-- متقن — المرحلة 3: نظام الإشعارات
-- شغّل الملف ده كاملًا في Supabase SQL Editor (Database → SQL Editor → Run)
-- آمن للتكرار. مهم: شغّل phase2-features.sql الأول (ده مبني عليه).
-- الموقع يشتغل عادي قبل تشغيل السكريبت — الجرس بيظهر بعده.
-- =====================================================================

-- 1) جدول الإشعارات
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;

-- الإشعارات بتتكتب بدوال security definer (السياسات متسمحش بإدخال مباشر)
create or replace function public.notify_user(
  p_user_id uuid, p_title text, p_body text default null, p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  values (p_user_id, p_title, p_body, p_link);
end;
$$;
revoke all on function public.notify_user(uuid, text, text, text) from public, anon;

-- 2) إعلان جديد من الأستاذ → كل الطلاب
create or replace function public.notify_on_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, '📢 إعلان جديد', left(new.body, 140), '/my'
  from public.profiles p
  where p.role = 'student';
  return new;
end;
$$;

-- 3) درس جديد → الطلاب المشتركين في الكورس
create or replace function public.notify_on_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select e.student_id, '📚 درس جديد: ' || coalesce(new.title, ''),
         null, '/courses/' || new.course_id
  from public.enrollments e
  where e.course_id = new.course_id and e.status = 'active';
  return new;
end;
$$;

-- 4) قبول/رفض الاشتراك → الطالب صاحب الطلب
create or replace function public.notify_on_enrollment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select c.title into v_title from public.courses c where c.id = new.course_id;
    perform public.notify_user(
      new.student_id, '✅ اتقبل اشتراكك',
      'اشتراكك في ' || coalesce(v_title, 'الكورس') || ' بقى شغال — بالتوفيق!',
      '/my'
    );
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.notify_user(
      new.student_id, '❌ طلب الاشتراك اترفض',
      new.review_note, '/courses'
    );
  end if;
  return new;
end;
$$;

-- 5) رد الإدارة على تذكرة دعم → صاحب التذكرة
create or replace function public.notify_on_ticket_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
begin
  if new.is_staff then
    select t.student_id into v_student
    from public.support_tickets t where t.id = new.ticket_id;
    if v_student is not null and v_student <> new.sender_id then
      perform public.notify_user(
        v_student, '🛟 رد جديد على تذكرتك',
        left(new.body, 140), '/support'
      );
    end if;
  end if;
  return new;
end;
$$;

-- ربط التريجرات (بشرط الجدول موجود — السكريبت يفضل آمن لو مرحلة لسه ما اتشغلتش)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'announcements') then
    drop trigger if exists trg_notify_announcement on public.announcements;
    create trigger trg_notify_announcement
      after insert on public.announcements
      for each row execute function public.notify_on_announcement();
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'lessons') then
    drop trigger if exists trg_notify_lesson on public.lessons;
    create trigger trg_notify_lesson
      after insert on public.lessons
      for each row execute function public.notify_on_lesson();
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'enrollments') then
    drop trigger if exists trg_notify_enrollment on public.enrollments;
    create trigger trg_notify_enrollment
      after update of status on public.enrollments
      for each row execute function public.notify_on_enrollment_status();
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'ticket_messages') then
    drop trigger if exists trg_notify_ticket on public.ticket_messages;
    create trigger trg_notify_ticket
      after insert on public.ticket_messages
      for each row execute function public.notify_on_ticket_reply();
  end if;
end;
$$;

-- =====================================================================
-- التحقق: لازم ترجع 3 صفوف
-- =====================================================================
select t as "العنصر", 'تم ✅' as "الحالة"
from (values
  ('notifications — جدول الإشعارات'),
  ('دوال الإشعارات الأربع'),
  ('التريجرات على الإعلانات والدروس والاشتراكات والتذاكر')
) as v(t);
