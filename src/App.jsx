// src/App.jsx
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";

import Layout from "./components/Layout";
import HeaderBar from "./components/HeaderBar";
import TabsBar from "./components/TabsBar";
import Card from "./components/Card";
import IdeaStream from "./components/IdeaStream";
import NewEntryForm from "./components/NewEntryForm";
import SearchPanel from "./components/SearchPanel";
import ArchiveList from "./components/ArchiveList";
import ArchiveActions from "./components/ArchiveActions";
import Timeline from "./components/Timeline";
import EntryModal from "./components/EntryModal";
import HistoryDrawer from "./components/HistoryDrawer";
import TimelineControls from "./components/TimelineControls";

import { fmtDur } from "./lib/time";
import { LS_UI } from "./constants/storageKeys";
import localDriver from "./services/storage/local";
import useHistory from "./hooks/useHistory";
import useVault from "./hooks/useVault";

const LazyAuthGate = lazy(() => import("./components/AuthGate"));

export default function App() {
  const wantsSupabase =
    (import.meta.env.VITE_STORAGE_DRIVER || "local").toLowerCase() === "supabase";

  const [storage, setStorage] = useState(() =>
    wantsSupabase ? null : localDriver()
  );
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [authGateReady, setAuthGateReady] = useState(false);

  const [user, setUser] = useState(null);
  const [lastError, setLastError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!wantsSupabase) {
        return;
      }

      try {
        const mod = await import("./services/storage/supabase.js");
        if (cancelled) return;

        const drv = mod.default?.();
        if (drv) {
          setStorage(drv);
          setUsingSupabase(true);
          setAuthGateReady(true);
        } else {
          console.warn("[App] Supabase driver missing default export; using local");
          setUsingSupabase(false);
          setAuthGateReady(false);
        }
      } catch (e) {
        console.error("[App] Failed to load Supabase driver.", e);
        setUsingSupabase(false);
        setAuthGateReady(false);
        setLastError(e?.message || "Supabase configuration failed.");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [wantsSupabase]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeFn = null;

    async function syncUser() {
      if (!storage) return;

      try {
        const currentUser = await storage.getUser?.();
        if (!cancelled) {
          setUser(currentUser || null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }

      if (!usingSupabase) return;

      try {
        const mod = await import("./services/storage/supabase.js");
        const sb = mod.supabaseClient;

        if (!sb || cancelled) return;

        const { data } = sb.auth.onAuthStateChange(async (_event, session) => {
          const nextUser = session?.user || null;

          setUser(nextUser);
        });

        unsubscribeFn = data?.subscription?.unsubscribe?.bind(data.subscription);

        const {
          data: { user: authUser },
        } = await sb.auth.getUser();

        if (!cancelled) {
          const nextUser = authUser || null;

          setUser(nextUser);
        }
      } catch (e) {
        console.warn("[App] Could not attach auth listener:", e?.message || e);
      }
    }

    syncUser();

    return () => {
      cancelled = true;
      try {
        if (typeof unsubscribeFn === "function") {
          unsubscribeFn();
        }
      } catch {
        // The subscription may already be closed during teardown.
      }
    };
  }, [storage, usingSupabase]);

  const {
    activity,
    historyOpen,
    setHistoryOpen,
    historyPaused,
    setHistoryPaused,
    historyFilter,
    setHistoryFilter,
    logActivity,
  } = useHistory({ storage, usingSupabase });

  const {
    entries,
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
    reload,
    loading,
  } = useVault({
    storage,
    usingSupabase,
    logActivity,
    user,
  });

  const vaultStats = useMemo(
    () => ({
      records: entries.length,
      ideas: ideas.length,
      dates: groupedByDate.length,
      files: entries.reduce((count, entry) => count + (entry.file ? 1 : 0), 0),
    }),
    [entries, groupedByDate.length, ideas.length]
  );

  const timelineEntries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
        .slice(0, 500),
    [entries]
  );

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      return ui.viewModeVersion === 2 &&
        ["timeline", "log", "search", "archive"].includes(ui.activeTab)
        ? ui.activeTab
        : "timeline";
    } catch {
      return "timeline";
    }
  });

  const [now, setNow] = useState(new Date());
  const tabStartRef = useRef(Date.now());
  const [showTimelineControls, setShowTimelineControls] = useState(false);

  const [timelineMinGap, setTimelineMinGap] = useState(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      return ui.timeline?.minGap ?? 24;
    } catch {
      return 24;
    }
  });

  const [timelineTrackHeight, setTimelineTrackHeight] = useState(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      return ui.timeline?.trackHeight ?? 400;
    } catch {
      return 400;
    }
  });

  useEffect(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      localStorage.setItem(LS_UI, JSON.stringify({ ...ui, activeTab, viewModeVersion: 2 }));
    } catch {
      // UI preferences are optional when browser storage is unavailable.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      const next = {
        ...ui,
        timeline: {
          ...(ui.timeline || {}),
          minGap: timelineMinGap,
          trackHeight: timelineTrackHeight,
        },
      };
      localStorage.setItem(LS_UI, JSON.stringify(next));
    } catch {
      // UI preferences are optional when browser storage is unavailable.
    }
  }, [timelineMinGap, timelineTrackHeight]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const runSave = useCallback(async (saveAsNote = false) => {
    setLastError("");
    setSaveResult(null);

    if (wantsSupabase && !usingSupabase) {
      setLastError("Timedline cloud storage is unavailable. Nothing was saved.");
      return false;
    }

    if (usingSupabase && !user) {
      setLastError("Please sign in first.");
      return false;
    }

    setSaving(true);

    try {
      const res = await handleSave(saveAsNote);
      if (!res?.ok) {
        const error = res?.error || "Save failed.";
        setLastError(
          error.includes("'type' column")
            ? "This cloud vault is missing entry classification. Nothing was saved. The existing entry-type migration must be applied before cloud captures can be saved."
            : error
        );
        return false;
      }

      setSaveResult({
        ok: true,
        number: res.entry?.id ?? null,
        ts: res.entry?.ts ?? Date.now(),
        type: res.entry?.type ?? null,
      });
      return true;
    } finally {
      setSaving(false);
    }
  }, [handleSave, usingSupabase, user, wantsSupabase]);

  async function prepareChronicle(file) {
    setLastError("");
    const res = await handleChronicleImport(file);

    if (!res?.ok) {
      setLastError(res?.error || "Could not prepare that Chronicle.");
      return false;
    }

    return true;
  }

  useEffect(() => {
    const onKey = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        try {
          if (activeTab === "timeline" || activeTab === "log") {
            await runSave(activeTab === "timeline");
          }
        } catch (err) {
          console.error("[App] Save error:", err);
          setLastError(err?.message || String(err));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActiveTab("search");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runSave, activeTab]);

  const handleTab = (id) => {
    const nowTs = Date.now();
    const stayedMs = nowTs - tabStartRef.current;

    if (tabStartRef.current && activeTab) {
      logActivity(`Stayed on ${activeTab} for ${fmtDur(stayedMs)}`, "duration");
    }

    tabStartRef.current = nowTs;
    setActiveTab(id);
    logActivity(`Switched to ${id} tab`, "tab");
  };

  async function handleDelete(entry) {
    const label = entry.content || entry.file?.name || "this memory";
    if (!window.confirm(`Delete “${label.slice(0, 60)}” permanently?`)) return;
    try {
      await deleteEntry(entry);
    } catch (error) {
      setLastError(error?.message || "Could not delete that memory.");
    }
  }

  return (
    <Layout>
      {usingSupabase && authGateReady && (
        <Suspense fallback={null}>
          <LazyAuthGate />
        </Suspense>
      )}

      <main className="app-main">
        {lastError && (
          <div className="notice notice--error" role="alert">
            <span className="notice__mark">!</span>
            <span>{lastError}</span>
          </div>
        )}
        {loadError && (
          <div className="notice notice--error" role="alert">
            <span className="notice__mark">!</span>
            <span>We could not load the vault. {loadError}</span>
            <button className="secondary-button" onClick={reload}>Try again</button>
          </div>
        )}

        <HeaderBar
          now={now}
          onExportJSON={handleExportEntries}
          onExportCSV={handleExportCSV}
          onOpenHistory={() => setHistoryOpen(true)}
        />

        <TabsBar activeTab={activeTab} onTab={handleTab} counts={{ total: entries.length, entries: ideas.length, days: groupedByDate.length }} />

        <section className="stats-board" aria-label="Vault statistics">
          <div><span className="stats-board__label">RECORDS</span><strong>{vaultStats.records}</strong><small>all types</small></div>
          <div><span className="stats-board__label">IDEAS</span><strong>{vaultStats.ideas}</strong><small>durable capture</small></div>
          <div><span className="stats-board__label">DATES</span><strong>{vaultStats.dates}</strong><small>active dates</small></div>
          <div><span className="stats-board__label">FILES</span><strong>{vaultStats.files}</strong><small>attachments</small></div>
        </section>

        {loading && (
          <div className="loading-strip" role="status">
            <span className="loading-strip__pulse" /> INDEXING VAULT / loading records
          </div>
        )}

        {activeTab === "log" && (
          <IdeaStream
            newEntry={newEntry}
            setNewEntry={setNewEntry}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            disabled={wantsSupabase && (!usingSupabase || !user)}
            saving={saving}
            saveResult={saveResult?.type === "idea" || saveResult?.type === "chronicle" ? saveResult : null}
            handleSave={() => runSave(false)}
            handleImport={handleImport}
            handleChronicleImport={prepareChronicle}
            draftType={draftType}
            ideas={ideas}
            onOpen={(e) => {
              setSelectedEntry(e);
              logActivity(`Opened idea from ${e.date}`, "open");
            }}
            onDelete={handleDelete}
          />
        )}

        {activeTab === "search" && (
          <Card className="content-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Find what you meant to keep</p>
                <h2 className="section-title">Search the vault</h2>
              </div>
              <span className="panel-heading__meta">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
            </div>
            <SearchPanel
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filtered={filtered}
              onOpen={(e) => {
                setSelectedEntry(e);
                logActivity(`Opened entry from ${e.date}`, "open");
              }}
              onLogSearch={() => logActivity(`Searched: "${searchTerm}"`, "search")}
              onDelete={handleDelete}
            />
          </Card>
        )}

        {activeTab === "archive" && (
          <Card className="content-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">The long view</p>
                <h2 className="section-title">Archive</h2>
              </div>
              <span className="panel-heading__meta">{groupedByDate.length} day{groupedByDate.length === 1 ? "" : "s"} of memory</span>
            </div>
            <ArchiveList
              groupedByDate={groupedByDate}
              onOpen={(e) => {
                setSelectedEntry(e);
                logActivity(`Opened entry from ${e.date}`, "open");
              }}
              onDelete={handleDelete}
            />
            <ArchiveActions onExportJSON={handleExportEntries} onExportCSV={handleExportCSV} />
          </Card>
        )}

        {activeTab === "timeline" && <Card className="timeline-card">
          <div className="section-card__inner">
            <details className="timeline-capture">
              <summary>+ New regular entry</summary>
              <NewEntryForm
                newEntry={noteDraft}
                setNewEntry={setNoteDraft}
                selectedFile={noteFile}
                setSelectedFile={setNoteFile}
                draftType="note"
                disabled={wantsSupabase && (!usingSupabase || !user)}
                saving={saving}
                handleSave={() => runSave(true)}
                showImports={false}
                focusOnMount={false}
                placeholder="Record a memory, event, or file in your Timeline…"
              />
            </details>
            {saveResult?.ok && saveResult.type === "note" && (
              <div className="idea-save-result" role="status">
                Entry saved to the Timeline.
              </div>
            )}
            <div className="timeline-actions" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="utility-button" onClick={() => setShowTimelineControls((v) => !v)} aria-expanded={showTimelineControls}>
                {showTimelineControls ? "Hide display controls" : "Display controls"}
              </button>
            </div>

            {showTimelineControls && (
              <TimelineControls
                minGap={timelineMinGap}
                trackHeight={timelineTrackHeight}
                onChange={(patch) => {
                  if (patch.minGap !== undefined) setTimelineMinGap(patch.minGap);
                  if (patch.trackHeight !== undefined) setTimelineTrackHeight(patch.trackHeight);
                }}
              />
            )}

            <Timeline
              entries={timelineEntries}
              totalCount={entries.length}
              now={now}
              onOpen={(e) => {
                setSelectedEntry(e);
                logActivity(`Opened entry from ${e.date}`, "open");
              }}
              minGap={timelineMinGap}
              trackHeight={timelineTrackHeight}
            />
          </div>
        </Card>}
      </main>

      <EntryModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onCopyText={() => navigator.clipboard.writeText(selectedEntry?.content || "")}
      />

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        activity={activity}
        onExportHistory={() => {
          import("./lib/exports").then(({ exportJSON }) => {
            exportJSON(activity, "timedline-activity.json");
          });
          logActivity("Exported activity history as JSON", "export");
        }}
        onClear={() => {
          logActivity("History cleared", "session");
        }}
        historyPaused={historyPaused}
        setHistoryPaused={setHistoryPaused}
        historyFilter={historyFilter}
        setHistoryFilter={setHistoryFilter}
      />
    </Layout>
  );
}
