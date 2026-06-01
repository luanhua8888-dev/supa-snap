-- Create the photos table
create table if not exists public.photos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  image_url text not null,
  caption text,
  username text not null default 'anonymous',
  reactions jsonb default '[]'::jsonb not null
);

-- Add user_id column if it doesn't exist (in case the table was created previously)
alter table public.photos add column if not exists user_id uuid references auth.users(id);

-- Add music columns if they don't exist
alter table public.photos add column if not exists song_title text;
alter table public.photos add column if not exists song_artist text;
alter table public.photos add column if not exists song_album_art text;
alter table public.photos add column if not exists song_preview_url text;
alter table public.photos add column if not exists caption_text_color text;
alter table public.photos add column if not exists caption_bg_style text;
alter table public.photos add column if not exists caption_text_effect text;
alter table public.photos add column if not exists media_type text default 'image';
alter table public.photos add column if not exists caption_bg_color text;

-- User profiles (username login + admin flag)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null,
  is_admin boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Allow public read profiles" on public.profiles;
create policy "Allow public read profiles"
  on public.profiles for select
  using (true);

drop policy if exists "Allow insert own profile" on public.profiles;
create policy "Allow insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Allow update own profile" on public.profiles;
create policy "Allow update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, is_admin)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    new.email,
    false
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "Allow public delete photos" on public.photos;
create policy "Allow public delete photos"
  on public.photos for delete
  using (true);

-- Enable Row Level Security (RLS)
alter table public.photos enable row level security;

-- Create policies to allow anyone to read photos
drop policy if exists "Allow public read access" on public.photos;
create policy "Allow public read access"
  on public.photos for select
  using (true);

-- Create policies to allow anyone to insert photos
drop policy if exists "Allow public insert access" on public.photos;
create policy "Allow public insert access"
  on public.photos for insert
  with check (true);

-- Create policies to allow anyone to update photos (needed for updating reactions)
drop policy if exists "Allow public update access" on public.photos;
create policy "Allow public update access"
  on public.photos for update
  using (true);

-- Enable Realtime for the photos table safely
do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
exception
  when others then
    raise notice 'Could not alter publication: %', sqlerrm;
end;
$$;

-- Create policies to allow public upload and view access to the 'photos' storage bucket
drop policy if exists "Allow public select from photos storage" on storage.objects;
create policy "Allow public select from photos storage"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "Allow public insert to photos storage" on storage.objects;
create policy "Allow public insert to photos storage"
  on storage.objects for insert
  with check (bucket_id = 'photos');

drop policy if exists "Allow public delete from photos storage" on storage.objects;
create policy "Allow public delete from photos storage"
  on storage.objects for delete
  using (bucket_id = 'photos');

-- Comments on snaps
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid references auth.users(id),
  username text not null,
  body text not null check (char_length(body) > 0 and char_length(body) <= 300),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reactions jsonb default '[]'::jsonb not null
);

alter table public.comments add column if not exists reactions jsonb default '[]'::jsonb not null;

create index if not exists comments_photo_id_idx on public.comments (photo_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "Allow public read comments" on public.comments;
create policy "Allow public read comments"
  on public.comments for select
  using (true);

drop policy if exists "Allow public insert comments" on public.comments;
create policy "Allow public insert comments"
  on public.comments for insert
  with check (true);

drop policy if exists "Allow public update comments" on public.comments;
create policy "Allow public update comments"
  on public.comments for update
  using (true);

drop policy if exists "Allow public delete own comments" on public.comments;
create policy "Allow public delete own comments"
  on public.comments for delete
  using (true);

-- Realtime for comments
do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
exception
  when others then
    raise notice 'Could not add comments to realtime: %', sqlerrm;
end;
$$;

-- Allow video uploads in the `photos` storage bucket (fixes "mime type video/webm is not supported")
update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ],
  file_size_limit = 104857600
where id = 'photos';

-- Reload the schema cache for PostgREST/Supabase API to recognize new columns immediately
notify pgrst, 'reload schema';

