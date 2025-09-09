// src/hooks/useHistory.js
import { useEffect, useState } from "react";
import { LS_ACTIVITY } from "../constants/storageKeys";

export default function useHistory({ storage, usingSupabase }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPaused, setHistoryPaused] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [activity, setActivity] = useState(() => {
    try {
      const fromLS = JSON.parse(localStorage.getItem(LS_ACTIVITY) || "null");
      if (Array.isArray(fromLS)) return fromLS;
    } catch {}
    return [{ ts: Date.now(), type: "session", text: "Session started" }];
  });

  // persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(activity)); } catch {}
  }, [activity]);

  // load from Supabase when signed in
  useEffect(() => {
    (async () => {
      if (!usingSupabase) return;
      try {
        const user = await storage.getUser?.();
        if (!user || user.id === "local") return;
        const remote = await storage.listActivity?.();
        if (Array.isArray(remote)) setActivity(remote);
      } catch (e) {
        console.error("listActivity failed", e);
      }
    })();
  }, [storage, usingSupabase]);

  // logger (optimistic + optional cloud)
  const logActivity = async (text, type = "misc") => {
    if (historyPaused) return;
    const item = { ts: Date.now(), type, text };
    setActivity((prev) => [item, ...prev]);
    try {
      if (usingSupabase) await storage.logActivity?.(item);
    } catch (e) {
      console.error("logActivity failed", e);
    }
  };

  return {
    activity,
    historyOpen, setHistoryOpen,
    historyPaused, setHistoryPaused,
    historyFilter, setHistoryFilter,
    logActivity,
  };
}
