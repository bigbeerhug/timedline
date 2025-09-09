// src/components/HistoryDrawer.jsx

export default function HistoryDrawer({
  open,                   // boolean
  onClose,                // () => void
  activity,               // array
  onExportHistory,        // () => void
  onClear,                // () => void
  historyPaused,          // boolean
  setHistoryPaused,       // (bool) => void
  historyFilter,          // string
  setHistoryFilter,       // (string) => void
}) {
  if (!open) return null;

  const filtered = activity.filter((a) =>
    historyFilter === "all" ? true : a.type === historyFilter
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)" }}>
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 380,
          background: "#fff",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Activity History</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onExportHistory}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer" }}
            >
              Export
            </button>
            <button
              onClick={onClear}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer" }}
            >
              Clear
            </button>
            <button
              onClick={onClose}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={historyPaused}
              onChange={(e) => setHistoryPaused(e.target.checked)}
            />
            Pause recording
          </label>
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
          >
            <option value="all">All</option>
            <option value="tab">Tabs</option>
            <option value="duration">Durations</option>
            <option value="save">Saves</option>
            <option value="search">Searches</option>
            <option value="open">Opens</option>
            <option value="export">Exports</option>
            <option value="session">Session</option>
          </select>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.length === 0 && <li style={{ color: "#777" }}>No activity yet.</li>}
            {filtered.map((a, i) => (
              <li key={i} style={{ padding: "10px 0", borderBottom: "1px dashed #e5e7eb" }}>
                <div style={{ fontSize: 13, color: "#111827" }}>{a.text}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {new Date(a.ts).toLocaleString()} • {a.type}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
