-- منصة الأستاذ محمد صلاح الجبالي
-- Fix the admin's display name + make profile edits safe.
-- Idempotent: safe to run more than once.

-- 1) His real name on the admin account.
update public.profiles
set full_name = 'عبدالرحمن شريف'
where id = (select id from auth.users where email = 'abdarhmanshryf@gmail.com');

-- 2) The role column can no longer be changed through the app's API:
--    profile edits are limited to the name and phone columns.
--    (SQL Editor runs as postgres and is not affected by this.)
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- 3) Replace the old self-update policy: it forced role back to 'student'
--    on any profile edit, which would have demoted the teacher.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Verification: one row, his name, role = teacher.
select
  p.full_name,
  p.role,
  u.email
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'abdarhmanshryf@gmail.com';
