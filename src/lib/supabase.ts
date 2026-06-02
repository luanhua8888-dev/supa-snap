import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables! Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,          // Lưu session vào localStorage (giữ đăng nhập)
    storageKey: 'supasnap-auth',   // Key riêng tránh xung đột
    autoRefreshToken: true,        // Tự động refresh token khi hết hạn
    detectSessionInUrl: true,      // Detect session từ URL (email confirm redirect)
    storage: localStorage,         // Dùng localStorage (persist qua reload/restart)
  },
});
