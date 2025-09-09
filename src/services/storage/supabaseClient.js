// src/services/storage/supabaseClient.js
// Using CDN import so you don't need npm on StackBlitz
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Your real project values:
const url  = "https://ubverzjfgrcaxcgfmwwj.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmVyempmZ3JjYXhjZ2Ztd3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NTgwMjcsImV4cCI6MjA3MjQzNDAyN30.J2fpyNJ--FXRgYXlIc9JLtG5KjTRXiYNziolu8eLMEk";

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
