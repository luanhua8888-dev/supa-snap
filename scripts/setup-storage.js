import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const FILE_SIZE_LIMIT = 104857600; // 100 MB

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env: set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setup() {
  console.log('Setting up Supabase storage bucket "photos"...');

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
    process.exit(1);
  }

  const photoBucket = buckets?.find((b) => b.name === 'photos');

  if (!photoBucket) {
    console.log('Creating "photos" bucket...');
    const { data, error } = await supabase.storage.createBucket('photos', {
      public: true,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      fileSizeLimit: FILE_SIZE_LIMIT,
    });
    if (error) {
      console.error('Error creating bucket:', error);
      process.exit(1);
    }
    console.log('Bucket created:', data);
    return;
  }

  console.log('Updating existing "photos" bucket (video MIME types)...');
  const { data, error } = await supabase.storage.updateBucket('photos', {
    public: true,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    fileSizeLimit: FILE_SIZE_LIMIT,
  });

  if (error) {
    console.error('Error updating bucket:', error);
    console.log('\nAlternatively run this SQL in Supabase SQL Editor:\n');
    console.log(`update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/gif','video/mp4','video/webm','video/quicktime'],
    file_size_limit = ${FILE_SIZE_LIMIT}
where id = 'photos';`);
    process.exit(1);
  }

  console.log('Bucket updated successfully!', data);
}

setup();
