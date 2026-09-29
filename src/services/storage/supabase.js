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

async function createEntry({ ts, date, type, content, file, extractedText = "", fileMetadata = {} }) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    ts,
    date,
    type: type ?? null,
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

  if (file || extractedText || Object.keys(fileMetadata || {}).length > 0) {
    payload.extracted_text = extractedText || "";
    payload.file_metadata = fileMetadata || {};
  }

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
    type: data.type ?? null,
    content: data.content,
    extractedText: data.extracted_text || "",
    fileMetadata: data.file_metadata || {},
    file: resolvedFile,
  };
}

async function mapRows(rows, { signFiles = true } = {}) {
  return await Promise.all(
    (rows || []).map(async (row) => {
      let file = null;

      if (row?.file) {
        const stored = row.file || {};
        const signedUrl = signFiles && stored.path ? await createSignedUrl(stored.path) : null;

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
        type: row.type ?? null,
        content: row.content,
        extractedText: row.extracted_text || "",
        fileMetadata: row.file_metadata || {},
        file,
      };
    })
  );
}

async function listEntries() {
  const user = await getUser();
  if (!user) return [];

  let { data, error } = await supabaseClient
    .from("entries")
    .select("id,ts,date,type,content,file,file_metadata")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });

  // Keep older deployments readable until the document-search migration lands.
  if (error && /file_metadata|column .* does not exist/i.test(error.message || "")) {
    ({ data, error } = await supabaseClient
      .from("entries")
      .select("id,ts,date,type,content,file")
      .eq("user_id", user.id)
      .order("ts", { ascending: false }));
  }

  if (error) throw error;

  return await mapRows(data || []);
}

async function exportEntries() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabaseClient
    .from("entries")
    .select("id,ts,date,type,content,file,file_metadata,extracted_text")
    .eq("user_id", user.id)
    .order("ts", { ascending: false });

  if (error) throw error;
  return await mapRows(data || [], { signFiles: false });
}

async function searchEntries(query, { limit = 25, offset = 0 } = {}) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const { data: matches, error: searchError } = await supabaseClient.rpc("search_entries", {
    search_query: query,
    result_limit: limit,
    result_offset: offset,
  });
  if (searchError) throw searchError;
  if (!matches?.length) return { entries: [], totalCount: 0 };

  const ids = matches.map((match) => match.entry_id).filter(Boolean);
  const { data: rows, error } = await supabaseClient
    .from("entries")
    .select("id,ts,date,type,content,file,file_metadata")
    .eq("user_id", user.id)
    .in("id", ids);

  if (error) throw error;

  const mapped = await mapRows(rows || []);
  const byId = new Map(mapped.map((entry) => [String(entry.id), entry]));
  const rankedEntries = matches
    .map((match) => {
      const entry = byId.get(String(match.entry_id));
      return entry
        ? { ...entry, searchRank: Number(match.rank) || 0, searchExcerpt: match.excerpt || "" }
        : null;
    })
    .filter(Boolean);

  return {
    entries: rankedEntries,
    totalCount: Number(matches[0]?.total_count) || rankedEntries.length,
  };
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
    exportEntries,
    searchEntries,
    deleteEntry,
    logActivity,
    listActivity,
  };
}
