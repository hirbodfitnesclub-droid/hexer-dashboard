-- 37_marketing_views.sql
-- Materialized Views for Aras Marketing Board presenting traffic, funnel, timing, cohort retention, channel ROI, and campaigns analytics

-- 0. First-Touch Attribution helper query (standard SQL view)
CREATE OR REPLACE VIEW marketing.v_first_touch_attribution AS
WITH first_utm AS (
    SELECT DISTINCT ON (anonymous_id)
        anonymous_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term
    FROM marketing.events_fdw
    WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL
    ORDER BY anonymous_id, created_at ASC
)
SELECT 
    e.anonymous_id,
    COALESCE(f.utm_source, 'direct') as utm_source,
    COALESCE(f.utm_medium, 'direct') as utm_medium,
    COALESCE(f.utm_campaign, 'direct') as utm_campaign,
    COALESCE(f.utm_content, 'direct') as utm_content,
    COALESCE(f.utm_term, 'direct') as utm_term
FROM (SELECT DISTINCT anonymous_id FROM marketing.events_fdw) e
LEFT JOIN first_utm f ON e.anonymous_id = f.anonymous_id;

-- 1. mv_traffic_overview
-- Tracks weekly, daily, and monthly visitors alongside CTA clicks grouped by landings and campaigns
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_traffic_overview CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_traffic_overview AS
SELECT
    COALESCE(landing_host, 'unknown') as landing_host,
    COALESCE(utm_source, 'direct') as utm_source,
    COALESCE(utm_medium, 'direct') as utm_medium,
    COALESCE(utm_campaign, 'direct') as utm_campaign,
    COUNT(DISTINCT CASE WHEN created_at >= date_trunc('day', now()) THEN anonymous_id END) as uniques_today,
    COUNT(DISTINCT CASE WHEN created_at >= now() - INTERVAL '7 days' THEN anonymous_id END) as uniques_7d,
    COUNT(DISTINCT CASE WHEN created_at >= now() - INTERVAL '30 days' THEN anonymous_id END) as uniques_30d,
    COUNT(CASE WHEN event_type = 'page_view' AND created_at >= now() - INTERVAL '30 days' THEN 1 END) as page_views_30d,
    COUNT(CASE WHEN event_type = 'cta_click_start_free' AND created_at >= now() - INTERVAL '30 days' THEN 1 END) as cta_start_free_clicks_30d,
    COUNT(CASE WHEN event_type = 'cta_click_login' AND created_at >= now() - INTERVAL '30 days' THEN 1 END) as cta_login_clicks_30d
FROM marketing.events_fdw
GROUP BY
    COALESCE(landing_host, 'unknown'),
    COALESCE(utm_source, 'direct'),
    COALESCE(utm_medium, 'direct'),
    COALESCE(utm_campaign, 'direct');

-- Unique composite index for Concurrent Refresh compatibility (guaranteed non-null)
CREATE UNIQUE INDEX idx_mv_traffic_overview ON marketing.mv_traffic_overview (
    landing_host, 
    utm_source, 
    utm_medium, 
    utm_campaign
);


-- 2. mv_funnel_by_channel
-- Step-by-step conversion funnel: visit -> cta_click -> register -> free_start -> purchase by acquisition channel
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_funnel_by_channel CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_funnel_by_channel AS
WITH attribution AS (
    SELECT 
        e.anonymous_id,
        COALESCE(c.channel, a.utm_source, 'direct') as channel
    FROM marketing.v_first_touch_attribution a
    LEFT JOIN (SELECT DISTINCT anonymous_id FROM marketing.events_fdw) e ON e.anonymous_id = a.anonymous_id
    LEFT JOIN marketing.campaigns_fdw c ON c.utm_campaign = a.utm_campaign
),
user_events AS (
    SELECT 
        anonymous_id,
        bool_or(event_type LIKE 'cta_click%') as had_cta
    FROM marketing.events_fdw
    GROUP BY anonymous_id
),
user_db AS (
    SELECT 
        p.anonymous_id,
        bool_or(s.id IS NOT NULL) as had_free_start,
        bool_or(pay.status = 'paid') as had_purchase
    FROM public.profiles p
    LEFT JOIN public.subscriptions s ON s.user_id = p.id
    LEFT JOIN public.payments pay ON pay.user_id = p.id
    GROUP BY p.anonymous_id
),
combined AS (
    SELECT
        a.anonymous_id,
        a.channel,
        true as step1_visit,
        COALESCE(ue.had_cta, false) as step2_cta,
        (ud.anonymous_id IS NOT NULL) as step3_register,
        COALESCE(ud.had_free_start, false) as step4_free,
        COALESCE(ud.had_purchase, false) as step5_purchase
    FROM attribution a
    LEFT JOIN user_events ue ON ue.anonymous_id = a.anonymous_id
    LEFT JOIN user_db ud ON ud.anonymous_id = a.anonymous_id
),
unpivoted AS (
    SELECT channel, '1_visit'::text as stage, count(*) as count FROM combined WHERE step1_visit GROUP BY channel
    UNION ALL
    SELECT channel, '2_cta_click'::text as stage, count(*) as count FROM combined WHERE step2_cta GROUP BY channel
    UNION ALL
    SELECT channel, '3_register'::text as stage, count(*) as count FROM combined WHERE step3_register GROUP BY channel
    UNION ALL
    SELECT channel, '4_free_start'::text as stage, count(*) as count FROM combined WHERE step4_free GROUP BY channel
    UNION ALL
    SELECT channel, '5_purchase'::text as stage, count(*) as count FROM combined WHERE step5_purchase GROUP BY channel
)
SELECT 
    channel,
    stage,
    count,
    ROUND(count::numeric * 100.0 / NULLIF(FIRST_VALUE(count) OVER(PARTITION BY channel ORDER BY stage), 0), 2) as conversion_percentage
FROM unpivoted;

CREATE UNIQUE INDEX idx_mv_funnel_by_channel ON marketing.mv_funnel_by_channel (channel, stage);


-- 3. mv_purchase_timing
-- Tracks how long it takes for users to subscribe (At signup, trial period, after trial, or never) by channel
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_purchase_timing CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_purchase_timing AS
WITH attribution AS (
    SELECT 
        p.id as user_id,
        COALESCE(c.channel, a.utm_source, 'direct') as channel,
        p.created_at as registered_at
    FROM public.profiles p
    JOIN marketing.v_first_touch_attribution a ON a.anonymous_id = p.anonymous_id
    LEFT JOIN marketing.campaigns_fdw c ON c.utm_campaign = a.utm_campaign
),
first_paid_payment AS (
    SELECT 
        user_id,
        MIN(paid_at) as first_paid_at
    FROM public.payments
    WHERE status = 'paid'
    GROUP BY user_id
),
user_timing AS (
    SELECT
        a.user_id,
        a.channel,
        CASE
            WHEN f.first_paid_at IS NULL THEN 'never_purchased'
            WHEN f.first_paid_at <= a.registered_at + INTERVAL '10 minutes' THEN 'at_registration'
            WHEN f.first_paid_at <= a.registered_at + INTERVAL '3 days' THEN 'during_free_trial'
            ELSE 'after_trial'
        END as timing_category
    FROM attribution a
    LEFT JOIN first_paid_payment f ON f.user_id = a.user_id
)
SELECT 
    channel,
    timing_category,
    COUNT(*) as user_count
FROM user_timing
GROUP BY channel, timing_category;

CREATE UNIQUE INDEX idx_mv_purchase_timing ON marketing.mv_purchase_timing (channel, timing_category);


-- 4. mv_retention_by_channel
-- User cohort retention metrics specifically checking Month 1, Month 2, Month 3, and Month 6 activity
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_retention_by_channel CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_retention_by_channel AS
WITH user_cohorts AS (
    SELECT 
        p.id as user_id,
        COALESCE(c.channel, a.utm_source, 'direct') as channel,
        p.created_at as registered_at
    FROM public.profiles p
    JOIN marketing.v_first_touch_attribution a ON a.anonymous_id = p.anonymous_id
    LEFT JOIN marketing.campaigns_fdw c ON c.utm_campaign = a.utm_campaign
),
user_retention_flags AS (
    SELECT 
        uc.user_id,
        uc.channel,
        EXISTS (
            SELECT 1 FROM public.payments pay 
            WHERE pay.user_id = uc.user_id AND pay.status = 'paid' 
            AND pay.paid_at >= uc.registered_at + INTERVAL '30 days' 
            AND pay.paid_at < uc.registered_at + INTERVAL '60 days'
        ) OR EXISTS (
            SELECT 1 FROM public.subscriptions sub 
            WHERE sub.user_id = uc.user_id AND sub.plan_code != 'free' AND sub.status = 'active'
            AND sub.expires_at >= uc.registered_at + INTERVAL '30 days'
        ) as retained_month_1,
        EXISTS (
            SELECT 1 FROM public.payments pay 
            WHERE pay.user_id = uc.user_id AND pay.status = 'paid' 
            AND pay.paid_at >= uc.registered_at + INTERVAL '60 days' 
            AND pay.paid_at < uc.registered_at + INTERVAL '90 days'
        ) as retained_month_2,
        EXISTS (
            SELECT 1 FROM public.payments pay 
            WHERE pay.user_id = uc.user_id AND pay.status = 'paid' 
            AND pay.paid_at >= uc.registered_at + INTERVAL '90 days' 
            AND pay.paid_at < uc.registered_at + INTERVAL '120 days'
        ) as retained_month_3,
        EXISTS (
            SELECT 1 FROM public.payments pay 
            WHERE pay.user_id = uc.user_id AND pay.status = 'paid' 
            AND pay.paid_at >= uc.registered_at + INTERVAL '150 days' 
            AND pay.paid_at < uc.registered_at + INTERVAL '180 days'
        ) as retained_month_6
    FROM user_cohorts uc
)
SELECT
    channel,
    COUNT(*) as total_users,
    COUNT(CASE WHEN retained_month_1 THEN 1 END) as retained_m1,
    ROUND(COUNT(CASE WHEN retained_month_1 THEN 1 END)::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) as retention_rate_m1,
    COUNT(CASE WHEN retained_month_2 THEN 1 END) as retained_m2,
    ROUND(COUNT(CASE WHEN retained_month_2 THEN 1 END)::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) as retention_rate_m2,
    COUNT(CASE WHEN retained_month_3 THEN 1 END) as retained_m3,
    ROUND(COUNT(CASE WHEN retained_month_3 THEN 1 END)::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) as retention_rate_m3,
    COUNT(CASE WHEN retained_month_6 THEN 1 END) as retained_m6,
    ROUND(COUNT(CASE WHEN retained_month_6 THEN 1 END)::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) as retention_rate_m6
FROM user_retention_flags
GROUP BY channel;

CREATE UNIQUE INDEX idx_mv_retention_by_channel ON marketing.mv_retention_by_channel (channel);


-- 5. mv_channel_roi
-- Consolidated Financial analysis per Channel: traffic conversion, total spending, customer acquisition cost (CAC), total net income, and ROI %
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_channel_roi CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_channel_roi AS
WITH channel_campaign_costs AS (
    SELECT 
        channel,
        SUM(cost_irr) as total_cost
    FROM marketing.campaigns_fdw
    GROUP BY channel
),
attribution AS (
    SELECT 
        e.anonymous_id,
        COALESCE(c.channel, a.utm_source, 'direct') as channel
    FROM marketing.v_first_touch_attribution a
    LEFT JOIN (SELECT DISTINCT anonymous_id FROM marketing.events_fdw) e ON e.anonymous_id = a.anonymous_id
    LEFT JOIN marketing.campaigns_fdw c ON c.utm_campaign = a.utm_campaign
),
user_metrics AS (
    SELECT
        a.channel,
        COUNT(DISTINCT a.anonymous_id) as visitors,
        COUNT(DISTINCT p.id) as registrations,
        COUNT(DISTINCT CASE WHEN pay.status = 'paid' THEN p.id END) as buyers,
        SUM(CASE WHEN pay.status = 'paid' THEN COALESCE(pay.amount_irr, 0) END) as revenue
    FROM attribution a
    LEFT JOIN public.profiles p ON p.anonymous_id = a.anonymous_id
    LEFT JOIN public.payments pay ON pay.user_id = p.id
    GROUP BY a.channel
)
SELECT
    m.channel,
    m.visitors,
    m.registrations,
    m.buyers,
    ROUND(m.buyers::numeric * 100.0 / NULLIF(m.visitors, 0), 2) as conversion_rate,
    COALESCE(c.total_cost, 0) as total_cost,
    ROUND(COALESCE(c.total_cost, 0)::numeric / NULLIF(m.buyers, 0), 2) as cac,
    COALESCE(m.revenue, 0) as revenue,
    ROUND(((COALESCE(m.revenue, 0) - COALESCE(c.total_cost, 0))::numeric * 100.0 / NULLIF(COALESCE(c.total_cost, 0), 0)), 2) as roi
FROM user_metrics m
LEFT JOIN channel_campaign_costs c ON c.channel = m.channel;

CREATE UNIQUE INDEX idx_mv_channel_roi ON marketing.mv_channel_roi (channel);


-- 6. mv_campaign_detail
-- Granular campaign metrics: performance metrics broken down by utm_campaign
DROP MATERIALIZED VIEW IF EXISTS marketing.mv_campaign_detail CASCADE;
CREATE MATERIALIZED VIEW marketing.mv_campaign_detail AS
WITH campaign_costs AS (
    SELECT 
        utm_campaign,
        channel,
        SUM(cost_irr) as total_cost
    FROM marketing.campaigns_fdw
    GROUP BY utm_campaign, channel
),
attribution AS (
    SELECT 
        e.anonymous_id,
        a.utm_campaign,
        COALESCE(c.channel, a.utm_source, 'direct') as channel
    FROM marketing.v_first_touch_attribution a
    LEFT JOIN (SELECT DISTINCT anonymous_id FROM marketing.events_fdw) e ON e.anonymous_id = a.anonymous_id
    LEFT JOIN marketing.campaigns_fdw c ON c.utm_campaign = a.utm_campaign
),
campaign_metrics AS (
    SELECT
        a.utm_campaign,
        a.channel,
        COUNT(DISTINCT a.anonymous_id) as visitors,
        COUNT(DISTINCT p.id) as registrations,
        COUNT(DISTINCT CASE WHEN pay.status = 'paid' THEN p.id END) as buyers,
        SUM(CASE WHEN pay.status = 'paid' THEN COALESCE(pay.amount_irr, 0) END) as revenue
    FROM attribution a
    LEFT JOIN public.profiles p ON p.anonymous_id = a.anonymous_id
    LEFT JOIN public.payments pay ON pay.user_id = p.id
    GROUP BY a.utm_campaign, a.channel
)
SELECT
    m.utm_campaign,
    m.channel,
    m.visitors,
    m.registrations,
    m.buyers,
    ROUND(m.buyers::numeric * 100.0 / NULLIF(m.visitors, 0), 2) as conversion_rate,
    COALESCE(c.total_cost, 0) as total_cost,
    ROUND(COALESCE(c.total_cost, 0)::numeric / NULLIF(m.buyers, 0), 2) as cac,
    COALESCE(m.revenue, 0) as revenue,
    ROUND(((COALESCE(m.revenue, 0) - COALESCE(c.total_cost, 0))::numeric * 100.0 / NULLIF(COALESCE(c.total_cost, 0), 0)), 2) as roi
FROM campaign_metrics m
LEFT JOIN campaign_costs c ON c.utm_campaign = m.utm_campaign;

CREATE UNIQUE INDEX idx_mv_campaign_detail ON marketing.mv_campaign_detail (utm_campaign);
