// src/hooks/useVault.js
import { useCallback, useEffect, useMemo, useState } from "react";

function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCSV(entries, filename) {
  const header = ["ts", "date", "content", "file_name", "file_type", "file_url"];
  const rows = entries.map((e) => [
    e.ts,
    e.date,
    e.content ?? "",
    e.file?.name ?? "",
    e.file?.type ?? "",
    e.file?.url ?? "",
  ]);
  const csv =
    [header.map(csvEscape).join(",")]
      .concat(rows.map((r) => r.map(csvEscape).join(",")))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function useVault({ storage, usingSupabase, logActivity }) {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Load entries whenever storage driver changes (local ⇄ supabase)
  const loadEntries = useCallback(async () => {
    try {
      const list = await storage.listEntries();
      setEntries(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[vault] loadEntries failed:", e);
    }
  }, [storage]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, usingSupabase]);

  // Save handler (returns {ok, error})
  const handleSave = useCallback(async () => {
    const text = (newEntry || "").trim();
    if (!text && !selectedFile) {
      return { ok: false, error: "Nothing to save — add text or attach a file." };
    }

    const d = new Date();
    const ts = d.getTime();
    const today = d.toISOString().split("T")[0];

    let fileMeta = null;

    // If there is a file, try upload first
    if (selectedFile) {
      try {
        // local driver returns { name,type,url }, supabase returns { path,name,type }
        const uploaded = await storage.uploadFile(selectedFile);
        fileMeta = uploaded
          ? {
              path: uploaded.path || null,
              name: uploaded.name || selectedFile.name,
              type: uploaded.type || selectedFile.type || "application/octet-stream",
              url: uploaded.url || null,
            }
          : null;
      } catch (e) {
        console.error("[vault] uploadFile failed:", e);
        return { ok: false, error: e?.message || "Upload failed." };
      }
    }

    try {
      await storage.createEntry({
        ts,
        date: today,
        content: text || selectedFile?.name || "(file)",
        file: fileMeta,
      });

      // Refresh from source of truth (so Supabase signed URLs are resolved)
      const fresh = await storage.listEntries();
      if (Array.isArray(fresh) && fresh.length >= 0) {
        setEntries(fresh);
      } else {
        // Fallback optimistic update
        setEntries((prev) => [
          { ts, date: today, content: text || selectedFile?.name || "(file)", file: fileMeta },
          ...prev,
        ]);
      }

      setNewEntry("");
      setSelectedFile(null);
      logActivity?.(
        `Logged new entry: "${(text || selectedFile?.name || "").slice(0, 40)}${
          (text || selectedFile?.name || "").length > 40 ? "…" : ""
        }"`,
        "save"
      );

      return { ok: true };
    } catch (e) {
      console.error("[vault] createEntry failed:", e);
      return { ok: false, error: e?.message || "Create entry failed." };
    }
  }, [newEntry, selectedFile, storage, logActivity]);

  // Delete entry
  const deleteEntry = useCallback(
    async (e) => {
      try {
        await storage.deleteEntry(e.ts, e.file?.path || null);
        setEntries((prev) => prev.filter((x) => x.ts !== e.ts));
        logActivity?.(`Deleted entry from ${e.date}`, "save");
      } catch (err) {
        console.error("[vault] deleteEntry failed:", err);
        throw err;
      }
    },
    [storage, logActivity]
  );

  // Import (JSON array of entries)
  const handleImport = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!Array.isArray(data)) return;
          // Only import minimal safe fields
          const cleaned = data
            .filter(
              (x) =>
                typeof x.ts === "number" &&
                typeof x.date === "string" &&
                typeof x.content === "string"
            )
            .map((x) => ({
              ts: x.ts,
              date: x.date,
              content: x.content,
              file: x.file && typeof x.file === "object"
                ? {
                    path: x.file.path || null,
                    name: x.file.name || null,
                    type: x.file.type || null,
                    url: x.file.url || null,
                  }
                : null,
            }));

          if (!cleaned.length) return;

          // Persist to driver (Supabase: insert; Local: write to localStorage)
          for (const row of cleaned) {
            try {
              await storage.createEntry({
                ts: row.ts,
                date: row.date,
                content: row.content,
                file: row.file,
              });
            } catch (e) {
              console.warn("[vault] import createEntry failed for ts=", row.ts, e?.message || e);
            }
          }
          await loadEntries();
          logActivity?.(`Imported ${cleaned.length} entries`, "save");
        } catch (e) {
          console.error("[vault] handleImport parsing failed:", e);
        }
      };
      reader.readAsText(file);
    },
    [storage, loadEntries, logActivity]
  );

  // Filtered list for search tab
  const filtered = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.date.toLowerCase().includes(q) ||
        (e.content || "").toLowerCase().includes(q) ||
        (e.file?.name || "").toLowerCase().includes(q)
    );
  }, [entries, searchTerm]);

  // Grouped for archive
  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  // Exports
  const handleExportEntries = useCallback(() => {
    exportJSON(entries, "timedline-entries.json");
    logActivity?.("Exported vault as JSON", "export");
  }, [entries, logActivity]);

  const handleExportCSV = useCallback(() => {
    exportCSV(entries, "timedline-entries.csv");
    logActivity?.("Exported vault as CSV", "export");
  }, [entries, logActivity]);

  return {
    entries,
    newEntry,
    setNewEntry,
    selectedFile,
    setSelectedFile,
    searchTerm,
    setSearchTerm,
    selectedEntry,
    setSelectedEntry,
    filtered,
    groupedByDate,
    handleSave,
    deleteEntry,
    handleImport,
    handleExportEntries,
    handleExportCSV,
  };
}
