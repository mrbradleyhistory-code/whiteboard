-- Run once in Supabase SQL editor (after schema.sql)

alter table boards add column if not exists pages jsonb default null;

-- Existing rows keep working: the app migrates legacy strokes/stickies columns into pages on load.
