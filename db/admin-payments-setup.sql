-- =====================================================================
-- متقن — إعداد لوحة الإدارة + الدفع اليدوي
-- شغّل الملف ده كاملًا في Supabase SQL Editor (Database → SQL Editor → Run)
-- آمن للتكرار: تشغيله أكثر من مرة لا يكسر شيئًا.
-- =====================================================================

-- 1) أعمدة جديدة: إيقاف الحسابات + إثبات الدفع اليدوي
alter table public.profiles
  add column if not exists banned_at timestamptz;

alter table public.enrollments
  add column if not exists payment_reference text;
alter table public.enrollments
  add column if not exists payment_proof_path text;
alter table public.enrollments
  add column if not exists review_note text;

-- 2) دالة التحقق من الأدمن (تُستخدم في السياسات والحذف)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = '1297f9ef-89c8-45d9-82a4-01d5f48206fc'::uuid
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3) حذف حساب نهائيًا (للأدمن فقط، ولا يمكن حذف حسابك أنت)
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot delete your own account';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 4) سياسات إضافية للأدمن (تُضاف للموجود ولا تستبدله)
drop policy if exists admin_read_profiles on public.profiles;
create policy admin_read_profiles on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists admin_update_profiles on public.profiles;
create policy admin_update_profiles on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_read_enrollments on public.enrollments;
create policy admin_read_enrollments on public.enrollments
  for select to authenticated using (public.is_admin());

drop policy if exists admin_update_enrollments on public.enrollments;
create policy admin_update_enrollments on public.enrollments
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_delete_enrollments on public.enrollments;
create policy admin_delete_enrollments on public.enrollments
  for delete to authenticated using (public.is_admin());

drop policy if exists admin_read_courses on public.courses;
create policy admin_read_courses on public.courses
  for select to authenticated using (public.is_admin());

drop policy if exists admin_update_courses on public.courses;
create policy admin_update_courses on public.courses
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_delete_courses on public.courses;
create policy admin_delete_courses on public.courses
  for delete to authenticated using (public.is_admin());

drop policy if exists admin_delete_lessons on public.lessons;
create policy admin_delete_lessons on public.lessons
  for delete to authenticated using (public.is_admin());

-- 5) مخزن إيصالات الدفع (خاص — كل طالب يرفع في مجلد باسم حسابه)
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists proof_insert_own on storage.objects;
create policy proof_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists proof_read_own_or_staff on storage.objects;
create policy proof_read_own_or_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      )
    )
  );

-- 6) تحقق — لازم كل صف يطلع 1
select 'profiles.banned_at' as check_name,
       count(*)::int as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'banned_at'
union all
select 'enrollments.payment_reference',
       count(*)::int
from information_schema.columns
where table_schema = 'public' and table_name = 'enrollments' and column_name = 'payment_reference'
union all
select 'enrollments.review_note',
       count(*)::int
from information_schema.columns
where table_schema = 'public' and table_name = 'enrollments' and column_name = 'review_note'
union all
select 'function is_admin',
       count(*)::int
from pg_proc where proname = 'is_admin'
union all
select 'function admin_delete_user',
       count(*)::int
from pg_proc where proname = 'admin_delete_user'
union all
select 'bucket payment-proofs',
       count(*)::int
from storage.buckets where id = 'payment-proofs';
