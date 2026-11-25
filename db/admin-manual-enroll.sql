-- =====================================================================
-- متقن — السماح للأستاذ/الأدمن بإضافة طالب لكورس يدويًا
-- شغّل الملف ده كاملًا في Supabase SQL Editor (مرة واحدة، آمن للتكرار)
-- يكمل سكريبت admin-payments-setup.sql (لازم يكون اتشغّل قبله)
-- =====================================================================

-- سياسة إضافية فقط: لا تغيّر ولا تمسح أي سياسة موجودة
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

-- تحقق — لازم يطلع 1
select count(*)::int as ok
from pg_policies
where schemaname = 'public'
  and tablename = 'enrollments'
  and policyname = 'staff_insert_enrollments';
