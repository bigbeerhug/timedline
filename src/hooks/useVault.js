// src/hooks/useVault.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractFileIndex } from "../lib/fileIndexing";
import { makeSearchExcerpt, searchEntriesLocally } from "../lib/search";

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
  const header = ["id", "ts", "date", "type", "content", "file_name", "file_type", "file_path", "file_url", "extracted_text", "file_keywords"];
  const rows = entries.map((e) => [
    e.id ?? "",
    e.ts,
    e.date,
    e.type ?? "",
    e.content ?? "",
    e.file?.name ?? "",
    e.file?.type ?? "",
    e.file?.path ?? "",
    e.file?.url ?? "",
    e.extractedText ?? "",
    e.fileMetadata?.keywords?.join(" | ") ?? "",
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
  const [draftType, setDraftType] = useState("idea");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteFile, setNoteFile] = useState(null);
  const [searchTerm, setSearchTermState] = useState("");
  const [searchPage, setSearchPage] = useState(0);
  const [remoteSearch, setRemoteSearch] = useState({ query: "", page: 0, entries: [], totalCount: 0, loading: false, error: "" });
  const [fileIndexing, setFileIndexing] = useState(false);
  const [fileIndexProgress, setFileIndexProgress] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const setSearchTerm = useCallback((value) => {
    setSearchTermState(value);
    setSearchPage(0);
  }, []);

  const loadEntries = useCallback(async () => {
    if (!storage) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const list = await storage.listEntries();
      setEntries(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[vault] loadEntries failed:", e);
      setEntries([]);
      setLoadError(e?.message || "Could not load your vault.");
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    // In supabase mode, wait until the user is resolved before loading.
    if (usingSupabase && !user) {
      return;
    }

    loadEntries();
  }, [loadEntries, usingSupabase, user, reloadTick]);

  const handleSave = useCallback(async (saveAsNote = false) => {
    const content = saveAsNote ? noteDraft : newEntry;
    const file = saveAsNote ? noteFile : selectedFile;
    const entryType = saveAsNote ? "note" : draftType;
    const text = (content || "").trim();

    if (!text && !file) {
      return { ok: false, error: "Nothing to save — add text or attach a file." };
    }

    const d = new Date();
    const ts = d.getTime();
    const today = d.toISOString().split("T")[0];

    let uploadedFile = null;
    let fileIndex = { extractedText: "", fileMetadata: {} };

    try {
      if (file) {
        setFileIndexing(true);
        setFileIndexProgress(null);
        fileIndex = await extractFileIndex(file, text, setFileIndexProgress);
        uploadedFile = await storage.uploadFile(file);
      }

      const created = await storage.createEntry({
        ts,
        date: today,
        type: entryType,
        content: text || file?.name || "(file)",
        file: uploadedFile
          ? {
              path: uploadedFile.path || null,
              name: uploadedFile.name || file?.name || null,
              type:
                uploadedFile.type ||
                file?.type ||
                "application/octet-stream",
            }
          : null,
        extractedText: fileIndex.extractedText,
        fileMetadata: fileIndex.fileMetadata,
      });

      const normalizedEntry = created || {
        id: null,
        ts,
        date: today,
        type: entryType,
        content: text || file?.name || "(file)",
        file: uploadedFile
          ? {
              path: uploadedFile.path || null,
              name: uploadedFile.name || file?.name || null,
              type:
                uploadedFile.type ||
                file?.type ||
                "application/octet-stream",
              url: uploadedFile.url || null,
            }
          : null,
        extractedText: fileIndex.extractedText,
        fileMetadata: fileIndex.fileMetadata,
      };

      setEntries((prev) => [normalizedEntry, ...prev]);
      if (saveAsNote) {
        setNoteDraft("");
        setNoteFile(null);
      } else {
        setNewEntry("");
        setSelectedFile(null);
        setDraftType("idea");
      }

      logActivity?.(
        `Logged new entry: "${(normalizedEntry.content || "").slice(0, 40)}${
          (normalizedEntry.content || "").length > 40 ? "…" : ""
        }"`,
        "save"
      );

      return { ok: true, entry: normalizedEntry };
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
    } finally {
      setFileIndexing(false);
      setFileIndexProgress(null);
    }
  }, [newEntry, selectedFile, noteDraft, noteFile, draftType, storage, logActivity]);

  useEffect(() => {
    const query = (searchTerm || "").trim();
    if (!query || !usingSupabase || typeof storage?.searchEntries !== "function") {
      setRemoteSearch({ query, page: searchPage, entries: [], totalCount: 0, loading: false, error: "" });
      return undefined;
    }

    let active = true;
    setRemoteSearch((current) => ({ ...current, query, page: searchPage, loading: true, error: "" }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await storage.searchEntries(query, { limit: 25, offset: searchPage * 25 });
        if (active) {
          setRemoteSearch({
            query,
            page: searchPage,
            entries: result.entries || [],
            totalCount: result.totalCount || 0,
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        console.error("[vault] searchEntries failed:", error);
        if (active) {
          const message = /search_entries|schema cache|function .*does not exist/i.test(error?.message || "")
            ? "The document-search migration is not active yet. Search is limited to loaded entry text and filenames."
            : error?.message || "Search failed.";
          setRemoteSearch({ query, page: searchPage, entries: [], totalCount: 0, loading: false, error: message });
        }
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchPage, searchTerm, storage, usingSupabase]);

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
              type: ["idea", "note", "chronicle"].includes(x.type) ? x.type : null,
              content: x.content,
              extractedText: typeof x.extractedText === "string" ? x.extractedText : "",
              fileMetadata: x.fileMetadata && typeof x.fileMetadata === "object" ? x.fileMetadata : {},
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
                  type: row.type,
                  content: row.content,
                  file: row.file,
                  extractedText: row.extractedText,
                  fileMetadata: row.fileMetadata,
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

  const handleChronicleImport = useCallback(
    async (file) => {
      if (!file) {
        return { ok: false, error: "Choose a Markdown or text Chronicle file." };
      }

      const isTextFile =
        file.type === "text/markdown" ||
        file.type === "text/plain" ||
        /\.(md|markdown|txt)$/i.test(file.name || "");

      if (!isTextFile) {
        return {
          ok: false,
          error: "Chronicles must be Markdown (.md) or plain-text (.txt) files.",
        };
      }

      try {
        const text = await file.text();
        if (!text.trim()) {
          return { ok: false, error: "That Chronicle file is empty." };
        }

        setNewEntry(text);
        setSelectedFile(file);
        setDraftType("chronicle");
        logActivity?.(`Prepared Chronicle for review: ${file.name}`, "open");

        return { ok: true };
      } catch (e) {
        console.error("[vault] handleChronicleImport failed:", e);
        return {
          ok: false,
          error: e?.message || "Could not read that Chronicle file.",
        };
      }
    },
    [logActivity]
  );

  const filtered = useMemo(() => {
    const q = (searchTerm || "").trim();
    if (!q) return entries;

    if (usingSupabase && storage?.searchEntries) {
      if (remoteSearch.query !== q || remoteSearch.page !== searchPage) return [];
      if (!remoteSearch.error) return remoteSearch.entries;
    }

    return searchEntriesLocally(entries, q).map((entry) => ({
      ...entry,
      searchExcerpt: entry.searchExcerpt || makeSearchExcerpt(entry, q),
    }));
  }, [entries, remoteSearch, searchPage, searchTerm, storage, usingSupabase]);

  const searchLoading = remoteSearch.loading && remoteSearch.query === (searchTerm || "").trim() && remoteSearch.page === searchPage;
  const searchError = remoteSearch.error && remoteSearch.query === (searchTerm || "").trim() && remoteSearch.page === searchPage
    ? remoteSearch.error
    : "";
  const searchTotalCount = remoteSearch.query === (searchTerm || "").trim() && remoteSearch.page === searchPage
    ? remoteSearch.totalCount
    : 0;

  const ideas = useMemo(
    () => entries.filter((entry) => entry.type === "idea"),
    [entries]
  );

  const groupedByDate = useMemo(() => {
    const map = new Map();

    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }

    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const handleExportEntries = useCallback(async () => {
    const exportEntries = await storage?.exportEntries?.() || entries;
    exportJSON(exportEntries, "timedline-entries.json");
    logActivity?.("Exported vault as JSON", "export");
  }, [entries, logActivity, storage]);

  const handleExportCSV = useCallback(async () => {
    const exportEntries = await storage?.exportEntries?.() || entries;
    exportCSV(exportEntries, "timedline-entries.csv");
    logActivity?.("Exported vault as CSV", "export");
  }, [entries, logActivity, storage]);

  return {
    entries,
    loading,
    loadError,
    newEntry,
    setNewEntry,
    selectedFile,
    setSelectedFile,
    draftType,
    noteDraft,
    setNoteDraft,
    noteFile,
    setNoteFile,
    searchTerm,
    setSearchTerm,
    searchPage,
    setSearchPage,
    searchLoading,
    searchError,
    searchTotalCount,
    fileIndexing,
    fileIndexProgress,
    selectedEntry,
    setSelectedEntry,
    filtered,
    ideas,
    groupedByDate,
    handleSave,
    deleteEntry,
    handleImport,
    handleChronicleImport,
    handleExportEntries,
    handleExportCSV,
    reload: loadEntries,
  };
}
