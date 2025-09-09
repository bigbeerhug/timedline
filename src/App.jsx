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

import { fmtDur } from "./lib/time";
import { LS_UI } from "./constants/storageKeys";
import localDriver from "./services/storage/local"; // safe fallback
import useHistory from "./hooks/useHistory";
import useVault from "./hooks/useVault";

// Only render AuthGate when Supabase is actually ready
const LazyAuthGate = lazy(() => import("./components/AuthGate"));

export default function App() {
  const wantsSupabase =
    (import.meta.env.VITE_STORAGE_DRIVER || "local").toLowerCase() === "supabase";

  // start in local mode so UI always renders
  const [storage, setStorage] = useState(() => localDriver());
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [authGateReady, setAuthGateReady] = useState(false);

  // auth + error surface
  const [user, setUser] = useState(null);
  const [lastError, setLastError] = useState("");

  // try to load Supabase driver dynamically; fallback to local on any error
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!wantsSupabase) return;
      try {
        const mod = await import("./services/storage/supabase.js");
        if (cancelled) return;
        const drv = mod.default?.();
        if (drv) {
          setStorage(drv);
          setUsingSupabase(true);
          setAuthGateReady(true);
        } else {
          console.warn("[storage] Supabase driver has no default export; using local.");
        }
      } catch (e) {
        console.error("[storage] Failed to load Supabase driver. Using local.", e);
        setUsingSupabase(false);
        setAuthGateReady(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [wantsSupabase]);

  // keep user state in sync when storage/ auth changes
  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    (async () => {
      try {
        // initial fetch
        const u = await storage.getUser?.();
        if (!cancelled) setUser(u || null);
      } catch {
        if (!cancelled) setUser(null);
      }

      // attach auth listener if using Supabase
      if (usingSupabase) {
        try {
          const mod = await import("./services/storage/supabase.js");
          const sb = mod.supabaseClient;
          if (sb && !cancelled) {
            const { data } = sb.auth.onAuthStateChange((_event, session) => {
              setUser(session?.user || null);
            });
            unsub =
              data?.subscription?.unsubscribe ||
              data?.subscription?.unsubscribe?.bind?.(data.subscription);
          }
        } catch (e) {
          console.warn("[auth] Could not attach auth listener:", e?.message || e);
        }
      }
    })();

    return () => {
      try {
        if (typeof unsub === "function") unsub();
      } catch {}
      cancelled = true;
    };
  }, [storage, usingSupabase]);

  // history (hook)
  const {
    activity,
    historyOpen, setHistoryOpen,
    historyPaused, setHistoryPaused,
    historyFilter, setHistoryFilter,
    logActivity,
  } = useHistory({ storage, usingSupabase });

  // vault (hook)
  const {
    entries,
    newEntry, setNewEntry,
    selectedFile, setSelectedFile,
    searchTerm, setSearchTerm,
    selectedEntry, setSelectedEntry,
    filtered,
    groupedByDate,
    handleSave,
    deleteEntry,
    handleImport,
    handleExportEntries,
    handleExportCSV,
  } = useVault({ storage, usingSupabase, logActivity });

  // ui state
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

  // persist active tab
  useEffect(() => {
    try { localStorage.setItem(LS_UI, JSON.stringify({ activeTab })); } catch {}
  }, [activeTab]);

  // clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // shortcuts: save + jump to search (now surfaces precise error)
  useEffect(() => {
    const onKey = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setLastError("");
        try {
          if (usingSupabase && !user) throw new Error("Please sign in first.");
          const res = await handleSave();
          if (!res?.ok) throw new Error(res?.error || "Save failed.");
          setActiveTab("archive");
        } catch (err) {
          console.error("[Save] error:", err);
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
  }, [newEntry, selectedFile, searchTerm, entries, handleSave, usingSupabase, user]);

  // tab change (with duration logging)
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

      {/* Inline error banner */}
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
            disabled={usingSupabase && !user} // disable when not signed in
            handleSave={async () => {
              try {
                setLastError("");
                if (usingSupabase && !user) throw new Error("Please sign in first.");
                const res = await handleSave();
                if (!res?.ok) throw new Error(res?.error || "Save failed.");
                setActiveTab("archive");
                return true;
              } catch (e) {
                console.error("[Save] error:", e);
                setLastError(e?.message || String(e));
                return false;
              }
            }}
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
        <Timeline
          entries={entries}
          now={now}
          onOpen={(e) => {
            setSelectedEntry(e);
            logActivity(`Opened entry from ${e.date}`, "open");
          }}
        />
      </Card>

      <EntryModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onCopyText={() =>
          navigator.clipboard.writeText(selectedEntry?.content || "")
        }
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
