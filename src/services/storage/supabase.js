// src/services/storage/supabase.js
// Use the ESM CDN build so it works smoothly in StackBlitz
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = "vault";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // supports magic link PKCE
        },
      })
    : null;

async function getUser() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

async function createSignedUrl(path) {
  if (!supabaseClient || !path) return null;
  const { data, error } = await supabaseClient
    .storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) {
    console.warn("[supabase] createSignedUrl failed:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

async function uploadFile(file) {
  const user = await getUser();
  if (!supabaseClient || !user) throw new Error("Not signed in");

  const safeName = (file.name || "file").replace(/[^\w.\-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error } = await supabaseClient
    .storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (error) throw error;

  return { path, name: file.name, type: file.type || "application/octet-stream" };
}

async function createEntry({ ts, date, content, file }) {
  const user = await getUser();
  if (!supabaseClient || !user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    ts,
    date,
    content,
    ...(file ? { file: { path: file.path, name: file.name, type: file.type } } : {}),
  };

  const { error } = await supabaseClient.from("entries").insert(payload);
  if (error) throw error;
}

async function listEntries() {
  const user = await getUser();
  if (!supabaseClient || !user) return [];

  const { data, error } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });

  if (error) throw error;

  const mapped = [];
  for (const row of data || []) {
    let file = null;
    if (row?.file) {
      const { path, name, type } = row.file || {};
      const url = path ? await createSignedUrl(path) : null;
      file = { path, name, type, url };
    }
    mapped.push({ ts: row.ts, date: row.date, content: row.content, file });
  }
  return mapped;
}

async function deleteEntry(ts, filePath) {
  const user = await getUser();
  if (!supabaseClient || !user) throw new Error("Not signed in");

  if (filePath) {
    try {
      const { error: rmErr } = await supabaseClient.storage.from(BUCKET).remove([filePath]);
      if (rmErr) console.warn("[supabase] storage remove failed:", rmErr.message);
    } catch (e) {
      console.warn("[supabase] storage remove threw:", e?.message || e);
    }
  }

  const { error } = await supabaseClient
    .from("entries")
    .delete()
    .eq("user_id", user.id)
    .eq("ts", ts);

  if (error) throw error;
}

async function logActivity(item) {
  const user = await getUser();
  if (!supabaseClient || !user) throw new Error("Not signed in");
  const payload = { user_id: user.id, ...item };
  const { error } = await supabaseClient.from("activity").insert(payload);
  if (error) throw error;
}

async function listActivity() {
  const user = await getUser();
  if (!supabaseClient || !user) return [];
  const { data, error } = await supabaseClient
    .from("activity")
    .select("*")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function supabaseDriver() {
  return {
    getUser,
    uploadFile,
    createEntry,
    listEntries,
    deleteEntry,
    logActivity,
    listActivity,
  };
}
