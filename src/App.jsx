// src/App.jsx
import { useEffect, useRef, useState, lazy, Suspense } from "react";

import Layout from "./components/Layout";
import HeaderBar from "./components/HeaderBar";
import TabsBar from "./components/TabsBar";
import Card from "./components/Card";
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

  const [storage, setStorage] = useState(() => localDriver());
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [authGateReady, setAuthGateReady] = useState(false);

  const [user, setUser] = useState(null);
  const [lastError, setLastError] = useState("");

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
      } catch {}
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
  } = useVault({
    storage,
    usingSupabase,
    logActivity,
    user,
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      return ui.activeTab || "log";
    } catch {
      return "log";
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
      localStorage.setItem(LS_UI, JSON.stringify({ ...ui, activeTab }));
    } catch {}
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
    } catch {}
  }, [timelineMinGap, timelineTrackHeight]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function runSave() {
    setLastError("");

    if (wantsSupabase && !usingSupabase) {
      setLastError("Timedline cloud storage is unavailable. Nothing was saved.");
      return false;
    }

    if (usingSupabase && !user) {
      setLastError("Please sign in first.");
      return false;
    }

    const res = await handleSave();
    if (!res?.ok) {
      setLastError(res?.error || "Save failed.");
      return false;
    }

    setActiveTab("archive");
    return true;
  }

  useEffect(() => {
    const onKey = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        try {
          await runSave();
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
  }, [handleSave, usingSupabase, user]);

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

  return (
    <Layout>
      {usingSupabase && authGateReady && (
        <Suspense fallback={null}>
          <LazyAuthGate />
        </Suspense>
      )}

      {lastError && (
        <div
          style={{
            margin: "8px 0 0",
            padding: "8px 10px",
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#7f1d1d",
            borderRadius: 8,
          }}
        >
          {lastError}
        </div>
      )}

      <HeaderBar
        onExportJSON={handleExportEntries}
        onExportCSV={handleExportCSV}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <TabsBar activeTab={activeTab} onTab={handleTab} />

      {activeTab === "log" && (
        <Card>
          <h2 style={{ marginTop: 0 }}>New Entry</h2>
          <NewEntryForm
            newEntry={newEntry}
            setNewEntry={setNewEntry}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            disabled={wantsSupabase && (!usingSupabase || !user)}
            handleSave={runSave}
            handleImport={handleImport}
          />
        </Card>
      )}

      {activeTab === "search" && (
        <Card>
          <h2 style={{ marginTop: 0 }}>Search</h2>
          <SearchPanel
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filtered={filtered}
            onOpen={(e) => {
              setSelectedEntry(e);
              logActivity(`Opened entry from ${e.date}`, "open");
            }}
            onLogSearch={() => logActivity(`Searched: "${searchTerm}"`, "search")}
            onDelete={(e) => deleteEntry(e)}
          />
        </Card>
      )}

      {activeTab === "archive" && (
        <Card>
          <h2 style={{ marginTop: 0 }}>Archive Timeline</h2>
          <ArchiveList
            groupedByDate={groupedByDate}
            onOpen={(e) => {
              setSelectedEntry(e);
              logActivity(`Opened entry from ${e.date}`, "open");
            }}
            onDelete={(e) => deleteEntry(e)}
          />
          <ArchiveActions
            onExportJSON={handleExportEntries}
            onExportCSV={handleExportCSV}
          />
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowTimelineControls((v) => !v)}
            style={{
              marginBottom: 8,
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: showTimelineControls ? "#eef2ff" : "#f9fafb",
              cursor: "pointer",
            }}
          >
            {showTimelineControls ? "Hide Timeline Controls" : "Show Timeline Controls"}
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
          entries={entries}
          now={now}
          onOpen={(e) => {
            setSelectedEntry(e);
            logActivity(`Opened entry from ${e.date}`, "open");
          }}
          minGap={timelineMinGap}
          trackHeight={timelineTrackHeight}
        />
      </Card>

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
