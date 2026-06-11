-- supabase/sql/35.5_fix_security_definer_view.sql
-- Drop the existing view to allow altering options
drop view if exists public.pending_push_reminders cascade;

-- Recreate the view specifying security_invoker as true
-- This ensures Row Level Security (RLS) is evaluated against the querying user, resolving the critical security warning.
create view public.pending_push_reminders with (security_invoker = true) as
select
  t.id as task_id,
  t.user_id,
  t.title,
  coalesce(t.description, '') as description,
  t.due_date,
  s.endpoint,
  s.p256dh,
  s.auth
from public.tasks t
join public.push_subscriptions s on s.user_id = t.user_id
where t.due_date <= now()
  and t.completed_at is null
  and not exists (
    select 1
    from public.reminders r
    where r.related_entity_id = t.id
      and r.related_entity_type = 'task'
      and r.is_sent = true
  );

notify pgrst, 'reload schema';
