-- Run once in Supabase SQL editor (after migration_lesson_launcher.sql)

alter table user_settings
  add column if not exists lesson_target_templates jsonb not null default '[]';
