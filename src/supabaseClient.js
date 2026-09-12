import { createClient } from '@supabase/supabase-js'

// The Supabase anon key is safe to expose client-side — it only allows what
// the database's row-level security policies permit (public read, admin-only
// write). Falls back to these values if env vars aren't set on the host.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://enzdsbzsgtwqoictiwam.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuemRzYnpzZ3R3cW9pY3Rpd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODk5NzIsImV4cCI6MjEwNDc2NTk3Mn0.hm02pgtRZ1GoDihbXXZAgZ2-9LDpwkrc2GZnQjEtgNw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
