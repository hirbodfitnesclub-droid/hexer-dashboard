-- 36_marketing_fdw.sql
-- Create Foreign Data Wrapper (FDW) bridge to link main production db to the remote analytical db securely

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

CREATE SCHEMA IF NOT EXISTS marketing;

-- Clean up existing definitions to support idempotent runs
DROP FOREIGN TABLE IF EXISTS marketing.events_fdw;
DROP FOREIGN TABLE IF EXISTS marketing.campaigns_fdw;
DROP USER MAPPING IF EXISTS FOR current_user SERVER analytics_srv;
DROP USER MAPPING IF EXISTS FOR authenticated SERVER analytics_srv;
DROP USER MAPPING IF EXISTS FOR service_role SERVER analytics_srv;
DROP USER MAPPING IF EXISTS FOR postgres SERVER analytics_srv;
DROP SERVER IF EXISTS analytics_srv;

-- Dynamic PL/pgSQL block to fetch credentials from Vault and setup FDW Server securely
DO $$
DECLARE
    v_host text;
    v_port text;
    v_dbname text;
    v_user text;
    v_password text;
BEGIN
    -- Query secrets from Supabase Vault schema if available
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
    ) THEN
        SELECT decrypted_secret INTO v_host FROM vault.decrypted_secrets WHERE name = 'analytics_db_host';
        SELECT decrypted_secret INTO v_port FROM vault.decrypted_secrets WHERE name = 'analytics_db_port';
        SELECT decrypted_secret INTO v_dbname FROM vault.decrypted_secrets WHERE name = 'analytics_db_name';
        SELECT decrypted_secret INTO v_user FROM vault.decrypted_secrets WHERE name = 'analytics_db_user';
        SELECT decrypted_secret INTO v_password FROM vault.decrypted_secrets WHERE name = 'analytics_db_password';
    END IF;

    -- Standard sensible fallbacks to allow schema creation during deployment before secrets are initialized
    v_host := COALESCE(v_host, 'db.hayhspgmmipcwvxaspze.supabase.co');
    v_port := COALESCE(v_port, '5432');
    v_dbname := COALESCE(v_dbname, 'postgres');
    v_user := COALESCE(v_user, 'mkt_bridge_user');
    v_password := COALESCE(v_password, 'SecureBridgePassword123!');

    RAISE NOTICE 'Defining analytical foreign server link to host: %:% (db: %)', v_host, v_port, v_dbname;

    -- Create foreign server
    EXECUTE format(
        'CREATE SERVER analytics_srv 
         FOREIGN DATA WRAPPER postgres_fdw 
         OPTIONS (host %L, port %L, dbname %L)',
        v_host, v_port, v_dbname
    );

    -- Create User Mapping for service_role (which is used by our Admin API edge function)
    EXECUTE format(
        'CREATE USER MAPPING FOR service_role 
         SERVER analytics_srv 
         OPTIONS (user %L, password %L)',
         v_user, v_password
    );

    -- Create User Mapping for postgres (as safety backup/troubleshooting)
    EXECUTE format(
        'CREATE USER MAPPING FOR postgres 
         SERVER analytics_srv 
         OPTIONS (user %L, password %L)',
         v_user, v_password
    );

    -- Create User Mapping for current_user if it is different from postgres and service_role
    IF CURRENT_USER NOT IN ('postgres', 'service_role') THEN
        EXECUTE format(
            'CREATE USER MAPPING FOR current_user 
             SERVER analytics_srv 
             OPTIONS (user %L, password %L)',
             v_user, v_password
        );
    END IF;
END $$;

-- 4. Define Foreign Tables targeting the remote analytics schema
CREATE FOREIGN TABLE marketing.events_fdw (
    id BIGINT,
    anonymous_id UUID,
    event_type TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    landing_host TEXT,
    page_path TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ
)
SERVER analytics_srv
OPTIONS (schema_name 'public', table_name 'events');

CREATE FOREIGN TABLE marketing.campaigns_fdw (
    utm_campaign TEXT,
    channel TEXT,
    source_name TEXT,
    start_date DATE,
    end_date DATE,
    cost_irr BIGINT,
    currency TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
SERVER analytics_srv
OPTIONS (schema_name 'public', table_name 'campaigns');

-- 5. Strict Permission Revocation and Explicit Server Privileges (Least Privilege model)
REVOKE ALL ON SCHEMA marketing FROM public, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA marketing FROM public, anon, authenticated;

GRANT USAGE ON SCHEMA marketing TO service_role;
GRANT USAGE ON SCHEMA marketing TO postgres;

-- Select only permissions on traffic events
GRANT SELECT ON marketing.events_fdw TO service_role;
GRANT SELECT ON marketing.events_fdw TO postgres;

-- Complete mutation permissions on campaigns catalog (enabling direct admin dashboard editing)
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.campaigns_fdw TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.campaigns_fdw TO postgres;
