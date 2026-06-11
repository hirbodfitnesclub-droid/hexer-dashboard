-- supabase/sql/35_reminder_dispatch.sql
-- View and query functions for scheduling and dispatching Web Push notifications

-- 1. View to find pending, uncompleted task reminders to be sent via Web Push
create or replace view public.pending_push_reminders as
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

-- 2. Function to locate users that due to have a friendly Daily Nudge today
create or replace function public.get_daily_nudge_candidates()
returns table (
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text
) language plpgsql security definer set search_path = public as $$
begin
  -- Restrict daily nudge triggers to waking hours (hour >= 9 AM in Tehran)
  if extract(hour from now() at time zone 'Asia/Tehran') >= 9 then
    return query
    select distinct
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth
    from public.push_subscriptions s
    -- The user must have at least one uncompleted task due today
    where exists (
      select 1 from public.tasks t
      where t.user_id = s.user_id
        and t.completed_at is null
        and (t.due_date at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    )
    -- The user must not have received a daily nudge today yet
    and not exists (
      select 1 from public.reminders r
      where r.user_id = s.user_id
        and r.type = 'custom'
        and r.related_entity_type = 'daily_nudge'
        and (r.created_at at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    );
  end if;
end; $$;

-- 3. pg_cron Setup for running push dispatch every minute
create extension if not exists pg_cron;

-- Remove the old job if it already exists to guarantee idempotency
-- We wrap pg_cron's native cron.unschedule function in an exception block to avoid errors if the job does not exist yet
do $$
begin
  perform cron.unschedule('push-dispatch-cron');
exception
  when others then
    raise notice 'Job push-dispatch-cron was not found or could not be unscheduled, proceeding...';
end;
$$;

-- Schedule the cron job to make a POST request to push-dispatch every minute
select cron.schedule(
  'push-dispatch-cron',
  '* * * * *',
  $$
  select net.http_post(
    url := coalesce(nullif(current_setting('app.settings.supabase_url', true), ''), 'http://kong:8000') || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.settings.service_role_key', true), ''), nullif(current_setting('app.settings.supabase_service_role_key', true), ''), '')
    ),
    body := '{}'::jsonb
  );
  $$
);

notify pgrst, 'reload schema';
