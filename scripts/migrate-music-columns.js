// Migration script: Add song_* columns to photos table via Supabase REST API
// Run with: node scripts/migrate-music-columns.js

const SUPABASE_URL = 'https://ymhxkonpjgrfllheitvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaHhrb25wamdyZmxsaGVpdHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjMxMjEsImV4cCI6MjA5NTg5OTEyMX0.b2m1---lSAQXCncqOA1rdrkp74LU5vzm2eTzTfj6Ixk';

const SQL = `
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS song_title text;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS song_artist text;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS song_album_art text;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS song_preview_url text;
NOTIFY pgrst, 'reload schema';
`;

async function runMigration() {
  console.log('🚀 Running music columns migration...');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ exec_sql failed (expected if no service role):', err);
    console.log('\n📋 MANUAL STEPS REQUIRED:');
    console.log('1. Open: https://supabase.com/dashboard/project/ymhxkonpjgrfllheitvz/sql/new');
    console.log('2. Paste and run this SQL:');
    console.log('─'.repeat(60));
    console.log(SQL);
    console.log('─'.repeat(60));
  } else {
    const data = await response.json();
    console.log('✅ Migration successful:', data);
  }
}

runMigration();
