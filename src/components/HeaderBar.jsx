// src/components/HeaderBar.jsx

export default function HeaderBar({
  onExportJSON,   // () => void
  onExportCSV,    // () => void
  onOpenHistory,  // () => void
  now = new Date(),
}) {
  const easternFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short", month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const zoneFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const offsetFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  });
  const eastern = easternFormat.format(now);
  const zone = zoneFormat.formatToParts(now).find((part) => part.type === "timeZoneName")?.value || "ET";
  const offset = offsetFormat.formatToParts(now).find((part) => part.type === "timeZoneName")?.value || "GMT";
  return (
    <header className="app-header">
      <div className="brand-mark">
        <span className="brand-symbol" aria-hidden="true">T/</span>
        <div>
          <p className="eyebrow">your forever vault</p>
          <h1 className="display-title">Timedline</h1>
          <p className="brand-subtitle">personal memory system</p>
        </div>
      </div>
      <div className="now-bar" aria-label="Current Eastern time">
        <span className="now-bar__label">NOW / EASTERN</span>
        <strong>{eastern}</strong>
        <span className="now-bar__zone">{zone} · {offset} · America/New_York</span>
      </div>
      <div className="header-actions" aria-label="Vault utilities">
        <button className="utility-button" onClick={onExportJSON} title="Export entries as JSON">Export JSON</button>
        <button className="utility-button" onClick={onExportCSV} title="Export entries as CSV">Export CSV</button>
        <button className="utility-button" onClick={onOpenHistory} title="Open activity history">Activity</button>
      </div>
    </header>
  );
}
