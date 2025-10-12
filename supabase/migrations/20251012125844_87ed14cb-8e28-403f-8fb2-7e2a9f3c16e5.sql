-- Crea enum per ruoli app
create type public.app_role as enum ('admin', 'moderator', 'user');

-- Tabella profili utente
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

-- Tabella posts
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  topic_tag text,
  shared_title text,
  shared_url text,
  preview_img text,
  full_article text,
  trust_level text check (trust_level in ('BASSO', 'MEDIO', 'ALTO')),
  stance text check (stance in ('Condiviso', 'Confutato')),
  sources text[],
  created_at timestamptz default now()
);

-- Tabella reactions
create table public.reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reaction_type text check (reaction_type in ('heart', 'bookmark')),
  created_at timestamptz default now(),
  unique(post_id, user_id, reaction_type)
);

-- Tabella questions
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  question_text text not null,
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 2),
  order_index int not null
);

-- Tabella user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- RLS Policies per profiles
alter table public.profiles enable row level security;

create policy "Profiles viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- RLS Policies per posts
alter table public.posts enable row level security;

create policy "Posts viewable by everyone"
  on public.posts for select
  using (true);

create policy "Users can insert own posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = author_id);

create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- RLS Policies per reactions
alter table public.reactions enable row level security;

create policy "Reactions viewable by everyone"
  on public.reactions for select
  using (true);

create policy "Users can manage own reactions"
  on public.reactions for all
  using (auth.uid() = user_id);

-- RLS Policies per questions
alter table public.questions enable row level security;

create policy "Questions viewable by everyone"
  on public.questions for select
  using (true);

create policy "Post authors can manage questions"
  on public.questions for all
  using (
    exists (
      select 1 from public.posts
      where posts.id = questions.post_id
      and posts.author_id = auth.uid()
    )
  );

-- RLS Policies per user_roles
alter table public.user_roles enable row level security;

create policy "User roles viewable by everyone"
  on public.user_roles for select
  using (true);

-- Funzione security definer per check ruoli
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Funzione per auto-creazione profilo
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces'
    )
  );
  
  -- Assegna ruolo user di default
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  
  return new;
end;
$$;

-- Trigger per auto-creazione profilo
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();