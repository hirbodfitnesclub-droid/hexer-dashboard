-- 38.5_fix_permissions.sql
-- Granting usage permissions on marketing schema and select access on views to all roles (anon, authenticated, and service_role)
-- and reloading PostgREST schema cache to apply the grants cleanly.

-- 1. Grant usage on marketing schema to all API and administrative roles
GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;

-- 2. Grant explicit select permissions on the helper view
GRANT SELECT ON marketing.v_first_touch_attribution TO anon, authenticated, service_role;

-- 3. Grant explicit select permissions on all 6 Materialized Views (PostgreSQL requires explicit GRANTS for materialized views)
GRANT SELECT ON marketing.mv_traffic_overview TO anon, authenticated, service_role;
GRANT SELECT ON marketing.mv_funnel_by_channel TO anon, authenticated, service_role;
GRANT SELECT ON marketing.mv_purchase_timing TO anon, authenticated, service_role;
GRANT SELECT ON marketing.mv_retention_by_channel TO anon, authenticated, service_role;
GRANT SELECT ON marketing.mv_channel_roi TO anon, authenticated, service_role;
GRANT SELECT ON marketing.mv_campaign_detail TO anon, authenticated, service_role;

-- 4. Set default privileges for any future tables/views in marketing schema (does not affect existing ones, but good practice)
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT SELECT ON TABLES TO anon, authenticated, service_role;

-- 5. Force PostgREST to reload its schema cache to recognize the table lists & new permissions immediately
NOTIFY pgrst, 'reload schema';
