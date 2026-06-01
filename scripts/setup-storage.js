import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymhxkonpjgrfllheitvz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaHhrb25wamdyZmxsaGVpdHZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMyMzEyMSwiZXhwIjoyMDk1ODk5MTIxfQ.TSVapm-qdQuLcTL8diOSeexXAfqSIH-1lPb8TYsHKhc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setup() {
  console.log('Setting up Supabase storage...');
  
  try {
    // List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const photoBucket = buckets?.find(b => b.name === 'photos');
    if (!photoBucket) {
      console.log('Creating "photos" bucket...');
      const { data, error } = await supabase.storage.createBucket('photos', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'],
        fileSizeLimit: 15728640 // 15MB
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
      } else {
        console.log('Bucket "photos" created successfully!', data);
      }
    } else {
      console.log('Bucket "photos" already exists.');
    }
  } catch (err) {
    console.error('Unexpected error in setup:', err);
  }
}

setup();
