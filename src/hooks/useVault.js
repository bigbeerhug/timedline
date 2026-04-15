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
  const header = ["id", "ts", "date", "content", "file_name", "file_type", "file_url"];
  const rows = entries.map((e) => [
    e.id ?? "",
    e.ts,
    e.date,
    e.content ?? "",
    e.file?.name ?? "",
    e.file?.type ?? "",
    e.file?.url ?? "",
  ]);

  const csv = [header.map(csvEscape).join(",")]
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

export default function useVault({ storage, usingSupabase, logActivity, user }) {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const loadEntries = useCallback(async () => {
    try {
      const list = await storage.listEntries();
      console.log("[vault] loaded entries:", list);
      setEntries(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[vault] loadEntries failed:", e);
      setEntries([]);
    }
  }, [storage]);

  useEffect(() => {
    // In supabase mode, wait until the user is resolved before loading.
    if (usingSupabase && !user) {
      return;
    }

    loadEntries();
  }, [loadEntries, usingSupabase, user?.id, reloadTick]);

  const handleSave = useCallback(async () => {
    const text = (newEntry || "").trim();

    if (!text && !selectedFile) {
      return { ok: false, error: "Nothing to save — add text or attach a file." };
    }

    const d = new Date();
    const ts = d.getTime();
    const today = d.toISOString().split("T")[0];

    let uploadedFile = null;

    try {
      if (selectedFile) {
        uploadedFile = await storage.uploadFile(selectedFile);
      }

      const created = await storage.createEntry({
        ts,
        date: today,
        content: text || selectedFile?.name || "(file)",
        file: uploadedFile
          ? {
              path: uploadedFile.path || null,
              name: uploadedFile.name || selectedFile?.name || null,
              type:
                uploadedFile.type ||
                selectedFile?.type ||
                "application/octet-stream",
            }
          : null,
      });

      const normalizedEntry = created || {
        id: null,
        ts,
        date: today,
        content: text || selectedFile?.name || "(file)",
        file: uploadedFile
          ? {
              path: uploadedFile.path || null,
              name: uploadedFile.name || selectedFile?.name || null,
              type:
                uploadedFile.type ||
                selectedFile?.type ||
                "application/octet-stream",
              url: uploadedFile.url || null,
            }
          : null,
      };

      setEntries((prev) => [normalizedEntry, ...prev]);
      setNewEntry("");
      setSelectedFile(null);

      logActivity?.(
        `Logged new entry: "${(normalizedEntry.content || "").slice(0, 40)}${
          (normalizedEntry.content || "").length > 40 ? "…" : ""
        }"`,
        "save"
      );

      return { ok: true };
    } catch (e) {
      console.error("[vault] handleSave failed:", e);

      if (uploadedFile?.path && typeof storage.deleteFile === "function") {
        try {
          await storage.deleteFile(uploadedFile.path);
        } catch (cleanupError) {
          console.warn("[vault] cleanup deleteFile failed:", cleanupError);
        }
      }

      return { ok: false, error: e?.message || "Save failed." };
    }
  }, [newEntry, selectedFile, storage, logActivity]);

  const deleteEntry = useCallback(
    async (e) => {
      try {
        const entryId = e.id ?? e.ts;
        await storage.deleteEntry(entryId, e.file?.path || null);

        setEntries((prev) => {
          if (e.id != null) {
            return prev.filter((x) => x.id !== e.id);
          }
          return prev.filter((x) => x.ts !== e.ts);
        });

        if (selectedEntry?.id != null && e.id === selectedEntry.id) {
          setSelectedEntry(null);
        } else if (selectedEntry?.ts === e.ts) {
          setSelectedEntry(null);
        }

        logActivity?.(`Deleted entry from ${e.date}`, "save");
      } catch (err) {
        console.error("[vault] deleteEntry failed:", err);
        throw err;
      }
    },
    [storage, logActivity, selectedEntry]
  );

  const handleImport = useCallback(
    (file) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!Array.isArray(data)) return;

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
              file:
                x.file && typeof x.file === "object"
                  ? {
                      path: x.file.path || null,
                      name: x.file.name || null,
                      type: x.file.type || null,
                      url: x.file.url || null,
                    }
                  : null,
            }));

          if (!cleaned.length) return;

          await Promise.all(
            cleaned.map(async (row) => {
              try {
                await storage.createEntry({
                  ts: row.ts,
                  date: row.date,
                  content: row.content,
                  file: row.file,
                });
              } catch (e) {
                console.warn(
                  "[vault] import createEntry failed for ts=",
                  row.ts,
                  e?.message || e
                );
              }
            })
          );

          setReloadTick((n) => n + 1);
          logActivity?.(`Imported ${cleaned.length} entries`, "save");
        } catch (e) {
          console.error("[vault] handleImport parsing failed:", e);
        }
      };

      reader.readAsText(file);
    },
    [storage, logActivity]
  );

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

  const groupedByDate = useMemo(() => {
    const map = new Map();

    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }

    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

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