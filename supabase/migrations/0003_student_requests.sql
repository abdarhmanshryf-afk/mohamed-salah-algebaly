-- منصة الأستاذ محمد صلاح الجبالي
-- Student subscription-request flow: insert policy + hardening trigger.
-- Idempotent: safe to run more than once.
-- Run AFTER teacher-fix-policies.sql.

-- Students can create a subscription request for themselves only,
-- and only as a pending request (never active).
drop policy if exists "enrollments_insert_own" on public.enrollments;
create policy "enrollments_insert_own" on public.enrollments
for insert to authenticated
with check (auth.uid() = student_id and status = 'pending');

-- Hardening: whatever a student tries to send, the server forces
-- status = pending, starts_at = now(), expires_at = null.
-- Applies only to app users (role authenticated); direct SQL as
-- postgres (SQL Editor, migrations) is unaffected.
create or replace function public.enforce_pending_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.status := 'pending';
    new.starts_at := now();
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enrollments_force_pending on public.enrollments;
create trigger enrollments_force_pending
before insert on public.enrollments
for each row execute function public.enforce_pending_enrollment();

-- Verification: one policy + one trigger + one function.
select 'policy' as kind, policyname as name from pg_policies
where schemaname = 'public' and policyname = 'enrollments_insert_own'
union all
select 'trigger', tgname from pg_trigger where tgname = 'enrollments_force_pending'
union all
select 'function', proname from pg_proc where proname = 'enforce_pending_enrollment';
