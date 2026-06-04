-- Run once in Supabase SQL editor (after migration_user_settings.sql)

alter table user_settings
  add column if not exists lesson_blocks jsonb not null default '[]',
  add column if not exists lessons jsonb not null default '[]';
