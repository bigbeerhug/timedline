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
    <div className="history-scrim" onClick={onClose}>
      <aside className="history-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Activity history">
        <div className="history-drawer__header">
          <div>
            <p className="eyebrow">A record of returning</p>
            <h2 className="section-title">Activity</h2>
          </div>
          <div className="history-drawer__actions">
            <button className="secondary-button" onClick={onExportHistory}>Export</button>
            <button className="secondary-button" onClick={onClear}>Clear</button>
            <button className="secondary-button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="history-drawer__controls">
          <label>
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

        <div className="history-list">
          <ul className="history-list">
            {filtered.length === 0 && <li className="empty-state"><strong>No activity yet.</strong><p>Actions will appear here as you move through your vault.</p></li>}
            {filtered.map((a, i) => (
              <li className="history-item" key={i}>
                <div className="history-item__text">{a.text}</div>
                <div className="history-item__meta">
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
