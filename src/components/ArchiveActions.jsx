// src/components/ArchiveActions.jsx

export default function ArchiveActions({
  onExportJSON, // () => void
  onExportCSV,  // () => void
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <button
        onClick={onExportJSON}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        ⬇️ Export JSON
      </button>
      <button
        onClick={onExportCSV}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        🧾 Export CSV
      </button>
    </div>
  );
}
