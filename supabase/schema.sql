-- Run this in your Supabase SQL editor once

create table boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled Board',
  strokes jsonb default '[]',
  stickies jsonb default '[]',
  text_boxes jsonb default '[]',
  images jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only the owning user can read/write their boards
alter table boards enable row level security;

create policy "Users can manage their own boards"
  on boards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on save
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger boards_updated_at
  before update on boards
  for each row execute function update_updated_at();
