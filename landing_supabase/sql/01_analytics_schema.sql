-- 01_analytics_schema.sql
-- Remote Analytics database schema for tracking web traffic, interactions, and UTM attribution
-- Run this script on the dedicated analytical Supabase project

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Events table to record page views, clicks, and transitions
CREATE TABLE IF NOT EXISTS public.events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anonymous_id UUID NOT NULL,
    event_type TEXT NOT NULL, -- e.g., 'page_view', 'cta_click_start_free', 'cta_click_login'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    landing_host TEXT,
    page_path TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Optimize queries with indexes for heavy analytics reads
CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON public.events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_events_utm_campaign ON public.events(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

-- 2. Campaigns reference and cost catalog table
CREATE TABLE IF NOT EXISTS public.campaigns (
    utm_campaign TEXT PRIMARY KEY,
    channel TEXT NOT NULL, -- e.g., 'youtube', 'instagram', 'telegram'
    source_name TEXT,     -- Specific affiliate or influencer name
    start_date DATE,
    end_date DATE,
    cost_irr BIGINT DEFAULT 0, -- Marketing expenditure in Iranian Rial (IRR)
    currency TEXT DEFAULT 'IRR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create dedicated secure non-superuser bridge role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mkt_bridge_user') THEN
    CREATE ROLE mkt_bridge_user WITH LOGIN PASSWORD 'SecureBridgePassword123!';
    END IF;
END
$$;

-- Grant schema navigation access
GRANT USAGE ON SCHEMA public TO mkt_bridge_user;

-- Enable Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies

-- Events policies
DROP POLICY IF EXISTS "Allow anonymous inserts on events" ON public.events;
CREATE POLICY "Allow anonymous inserts on events"
    ON public.events
    FOR INSERT
    TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow mkt_bridge_user select on events" ON public.events;
CREATE POLICY "Allow mkt_bridge_user select on events"
    ON public.events
    FOR SELECT
    TO mkt_bridge_user
    USING (true);

-- Campaigns policies
DROP POLICY IF EXISTS "Allow mkt_bridge_user all operations on campaigns" ON public.campaigns;
CREATE POLICY "Allow mkt_bridge_user all operations on campaigns"
    ON public.campaigns
    FOR ALL
    TO mkt_bridge_user
    USING (true)
    WITH CHECK (true);

-- Grant tables access privileges
GRANT SELECT ON public.events TO mkt_bridge_user;
GRANT ALL ON public.campaigns TO mkt_bridge_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mkt_bridge_user;
