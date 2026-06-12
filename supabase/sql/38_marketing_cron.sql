-- 38_marketing_cron.sql
-- Sets up scheduled background job to refresh materialized marketing report views concurrently every 30 minutes

-- 1. Create a function to trigger refreshes sequentially using CONCURRENTLY to avoid blocking read queries
CREATE OR REPLACE FUNCTION marketing.refresh_all()
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Triggering concurrent refresh on all marketing materialized views...';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_traffic_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_funnel_by_channel;
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_purchase_timing;
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_retention_by_channel;
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_channel_roi;
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketing.mv_campaign_detail;
    
    RAISE NOTICE 'Marketing views successfully updated.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marketing, public;

-- Enable cron companion extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Idempotent background scheduler linkage
-- Safely unschedule previous 'mkt_refresh' job to prevent duplicate entries
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mkt_refresh';

-- Schedule the view update to trigger precisely every 30 minutes
SELECT cron.schedule(
    'mkt_refresh',
    '*/30 * * * *',
    $$ SELECT marketing.refresh_all(); $$
);
