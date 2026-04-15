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
  const [debugInfo, setDebugInfo] = useState({
    driver: import.meta.env.VITE_STORAGE_DRIVER || "local",
    usingSupabase: false,
    userEmail: null,
    userId: null,
  });

  const [dbDebug, setDbDebug] = useState({
    totalCount: null,
    sampleCount: null,
    sampleFirst: null,
    countError: null,
    sampleError: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!wantsSupabase) {
        setDebugInfo((prev) => ({
          ...prev,
          driver: "local",
          usingSupabase: false,
        }));
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
          setDebugInfo((prev) => ({
            ...prev,
            driver: "supabase",
            usingSupabase: true,
          }));
        } else {
          console.warn("[App] Supabase driver missing default export; using local");
          setUsingSupabase(false);
          setAuthGateReady(false);
        }
      } catch (e) {
        console.error("[App] Failed to load Supabase driver. Using local.", e);
        setUsingSupabase(false);
        setAuthGateReady(false);
        setDebugInfo((prev) => ({
          ...prev,
          driver: "local-fallback",
          usingSupabase: false,
        }));
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
          setDebugInfo((prev) => ({
            ...prev,
            usingSupabase,
            userEmail: currentUser?.email || null,
            userId: currentUser?.id || null,
          }));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setDebugInfo((prev) => ({
            ...prev,
            usingSupabase,
            userEmail: null,
            userId: null,
          }));
        }
      }

      if (!usingSupabase) return;

      try {
        const mod = await import("./services/storage/supabase.js");
        const sb = mod.supabaseClient;
        const getDevUser = mod.getDevUser;

        if (!sb || cancelled) return;

        const { data } = sb.auth.onAuthStateChange(async (_event, session) => {
          const devUser = typeof getDevUser === "function" ? getDevUser() : null;
          const nextUser = session?.user || devUser || null;

          setUser(nextUser);
          setDebugInfo((prev) => ({
            ...prev,
            usingSupabase: true,
            userEmail: nextUser?.email || null,
            userId: nextUser?.id || null,
          }));
        });

        unsubscribeFn = data?.subscription?.unsubscribe?.bind(data.subscription);

        const {
          data: { user: authUser },
        } = await sb.auth.getUser();

        if (!cancelled) {
          const devUser = typeof getDevUser === "function" ? getDevUser() : null;
          const nextUser = authUser || devUser || null;

          setUser(nextUser);
          setDebugInfo((prev) => ({
            ...prev,
            usingSupabase: true,
            userEmail: nextUser?.email || null,
            userId: nextUser?.id || null,
          }));
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

  // Direct DB debug from frontend
  useEffect(() => {
    let cancelled = false;

    async function runDbDebug() {
      if (!usingSupabase) return;

      try {
        const mod = await import("./services/storage/supabase.js");
        const sb = mod.supabaseClient;
        if (!sb || cancelled) return;

        const countRes = await sb
          .from("entries")
          .select("*", { count: "exact", head: true });

        const sampleRes = await sb
          .from("entries")
          .select("id, user_id, ts, date, content")
          .order("ts", { ascending: false })
          .limit(3);

        if (cancelled) return;

        setDbDebug({
          totalCount: countRes.count ?? null,
          sampleCount: Array.isArray(sampleRes.data) ? sampleRes.data.length : 0,
          sampleFirst:
            Array.isArray(sampleRes.data) && sampleRes.data.length > 0
              ? JSON.stringify(sampleRes.data[0], null, 2)
              : null,
          countError: countRes.error ? countRes.error.message : null,
          sampleError: sampleRes.error ? sampleRes.error.message : null,
        });

        console.log("[DB DEBUG] countRes:", countRes);
        console.log("[DB DEBUG] sampleRes:", sampleRes);
      } catch (e) {
        if (!cancelled) {
          setDbDebug({
            totalCount: null,
            sampleCount: null,
            sampleFirst: null,
            countError: String(e?.message || e),
            sampleError: String(e?.message || e),
          });
        }
      }
    }

    runDbDebug();

    return () => {
      cancelled = true;
    };
  }, [usingSupabase, user?.id]);

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

      <div
        style={{
          margin: "8px 0",
          padding: "8px 10px",
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          color: "#111827",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        <div><strong>Driver:</strong> {debugInfo.driver}</div>
        <div><strong>Using Supabase:</strong> {String(debugInfo.usingSupabase)}</div>
        <div><strong>User Email:</strong> {debugInfo.userEmail || "none"}</div>
        <div><strong>User ID:</strong> {debugInfo.userId || "none"}</div>
        <div><strong>Entries Loaded:</strong> {entries.length}</div>
        <div style={{ marginTop: 8 }}><strong>DB Count Query:</strong> {String(dbDebug.totalCount)}</div>
        <div><strong>DB Sample Count:</strong> {String(dbDebug.sampleCount)}</div>
        <div><strong>DB Count Error:</strong> {dbDebug.countError || "none"}</div>
        <div><strong>DB Sample Error:</strong> {dbDebug.sampleError || "none"}</div>
        <div style={{ marginTop: 8 }}>
          <strong>DB First Sample Row:</strong>
          <div>{dbDebug.sampleFirst || "none"}</div>
        </div>
      </div>

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
            disabled={usingSupabase && !user}
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