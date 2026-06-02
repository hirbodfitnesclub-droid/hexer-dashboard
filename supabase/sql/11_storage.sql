-- /supabase/sql/11_storage.sql
-- Storage Private Buckets Setup & Security Policies

-- 1. Create Private Buckets idempotently
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security (RLS) on storage.objects
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Safety first: Drop existing folder policies to avoid duplicate name conflicts
DROP POLICY IF EXISTS "Allow authenticated selects" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- 4. Create RLS policies restricting access to a user-owned directory
-- Inside the bucket, objects must look like: folder_name/file_name.ext where the first folder is user's UID

-- Select Policy
CREATE POLICY "Allow authenticated selects"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Insert Policy
CREATE POLICY "Allow authenticated inserts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Update Policy
CREATE POLICY "Allow authenticated updates"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Delete Policy
CREATE POLICY "Allow authenticated deletes"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        (storage.foldername(name))[1] = auth.uid()::text
    );
