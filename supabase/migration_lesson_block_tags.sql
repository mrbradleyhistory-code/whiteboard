-- Run once in Supabase SQL editor (after migration_lesson_launcher.sql)

alter table user_settings
  add column if not exists lesson_block_tags jsonb not null default '[]';
