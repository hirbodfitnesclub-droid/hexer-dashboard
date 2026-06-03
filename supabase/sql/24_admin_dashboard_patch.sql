-- =====================================================================================
-- Migration: 24_admin_dashboard_patch.sql
-- Goal: Add is_active column to discount_codes table safely
-- =====================================================================================

ALTER TABLE public.discount_codes 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
