// src/components/HeaderBar.jsx

export default function HeaderBar({
  onExportJSON,   // () => void
  onExportCSV,    // () => void
  onOpenHistory,  // () => void
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}
    >
      <div style={{ textAlign: "left" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>🕒 Timedline</h1>
        <p style={{ color: "#555", marginTop: 6 }}>Your Forever Vault</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onExportJSON}
          title="Export entries as JSON"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ⬇️ Export
        </button>
        <button
          onClick={onExportCSV}
          title="Export entries as CSV"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          🧾 CSV
        </button>
        <button
          onClick={onOpenHistory}
          title="Open Activity History"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          🧭 History
        </button>
      </div>
    </header>
  );
}
