-- Run once in Supabase SQL editor (after schema.sql)

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timer_presets jsonb not null default '[]',
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users manage own settings" on user_settings;
create policy "Users manage own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_settings_updated_at on user_settings;
create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();
