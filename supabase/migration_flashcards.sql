-- Run once in Supabase SQL editor (after schema.sql)

create table if not exists flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  cards jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table flashcard_decks enable row level security;

drop policy if exists "Users manage own flashcard decks" on flashcard_decks;
create policy "Users manage own flashcard decks"
  on flashcard_decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists flashcard_decks_updated_at on flashcard_decks;
create trigger flashcard_decks_updated_at
  before update on flashcard_decks
  for each row execute function update_updated_at();
