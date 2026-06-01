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

-- Reload the schema cache for PostgREST/Supabase API to recognize new columns immediately
notify pgrst, 'reload schema';

