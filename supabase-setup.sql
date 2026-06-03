-- Run this in Supabase SQL Editor.
-- It safely updates your existing assessments table.

alter table assessments
add column if not exists candidate_email text,
add column if not exists evaluation jsonb;

alter table assessments enable row level security;
