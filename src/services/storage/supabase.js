// src/services/storage/supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase is selected, but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing."
  );
}

const BUCKET = "vault";
const SIGNED_URL_TTL = 60 * 60;
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

async function getUser() {
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    return user || null;
  } catch {
    return null;
  }
}

async function createSignedUrl(path) {
  if (!path) return null;

  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) {
    console.warn("[supabase] createSignedUrl error:", error.message);
    return null;
  }

  return data?.signedUrl || null;
}

async function uploadFile(file) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const safeName = (file.name || "file").replace(/[^\w.-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw error;

  return {
    path,
    name: file.name,
    type: file.type || "application/octet-stream",
  };
}

async function deleteFile(path) {
  if (!path) return;

  const { error } = await supabaseClient.storage.from(BUCKET).remove([path]);

  if (error) {
    console.warn("[supabase] deleteFile error:", error.message);
  }
}

async function createEntry({ ts, date, content, file }) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    ts,
    date,
    content,
    file: file
      ? {
          path: file.path || null,
          name: file.name || null,
          type: file.type || null,
          url: file.url || null,
        }
      : null,
  };

  const { data, error } = await supabaseClient
    .from("entries")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  let resolvedFile = null;
  if (data?.file) {
    const stored = data.file;
    const signedUrl = stored.path ? await createSignedUrl(stored.path) : null;

    resolvedFile = {
      path: stored.path || null,
      name: stored.name || null,
      type: stored.type || null,
      url: signedUrl || stored.url || null,
    };
  }

  return {
    id: data.id,
    ts: data.ts,
    date: data.date,
    content: data.content,
    file: resolvedFile,
  };
}

async function mapRows(rows) {
  return await Promise.all(
    (rows || []).map(async (row) => {
      let file = null;

      if (row?.file) {
        const stored = row.file || {};
        const signedUrl = stored.path ? await createSignedUrl(stored.path) : null;

        file = {
          path: stored.path || null,
          name: stored.name || null,
          type: stored.type || null,
          url: signedUrl || stored.url || null,
        };
      }

      return {
        id: row.id,
        ts: row.ts,
        date: row.date,
        content: row.content,
        file,
      };
    })
  );
}

async function listEntries() {
  const user = await getUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });

  if (error) throw error;

  return await mapRows(data || []);
}

async function deleteEntry(id, filePath) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  if (filePath) {
    await deleteFile(filePath);
  }

  const { error } = await supabaseClient
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

async function logActivity(item) {
  const user = await getUser();
  if (!user) return;

  const payload = {
    user_id: user.id,
    ...item,
  };

  const { error } = await supabaseClient.from("activity").insert(payload);

  if (error) {
    console.error("[supabase] logActivity error:", error);
  }
}

async function listActivity() {
  const user = await getUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from("activity")
    .select("*")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });

  if (error) return [];

  return data || [];
}

export default function supabaseDriver() {
  return {
    getUser,
    uploadFile,
    deleteFile,
    createEntry,
    listEntries,
    deleteEntry,
    logActivity,
    listActivity,
  };
}
