-- Color tags + library folders for lesson bank
alter table public.user_settings
  add column if not exists lesson_block_tag_colors jsonb not null default '{}',
  add column if not exists lesson_library_folders jsonb not null default '{"activities":[],"targets":[]}';
