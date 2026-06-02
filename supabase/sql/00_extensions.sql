-- 00_extensions.sql
-- Enable necessary database extensions

-- Enable pgvector for semantic search (embedding storage)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;
