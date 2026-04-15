// src/services/storage/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url = "https://eshnqnkjnsmszjfuvlyv.supabase.co";
const anon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzaG5xbmtqbnNtc3pqZnV2bHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzUwNTksImV4cCI6MjA5MDU1MTA1OX0.8ISuGXznvOtwxFjLAeIOG2rsINZW6ql6kozjv6UW7wY";

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});