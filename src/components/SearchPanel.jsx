// src/components/SearchPanel.jsx
export default function SearchPanel({
  searchTerm,
  setSearchTerm,
  filtered,
  onOpen,
  onLogSearch,
  onDelete,
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onLogSearch?.();
          }}
          placeholder="Type to filter (e.g., car, 2025-08-29, photo.jpg)..."
          style={{
            flex: 1,
            borderRadius: 12,
            border: "1px solid #ddd",
            padding: 10,
            marginBottom: 12,
          }}
        />
        <button
          onClick={onLogSearch}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Go
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((e, i) => (
          <li
            key={i}
            style={{
              padding: "6px 0",
              color: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              onClick={() => onOpen?.(e)}
              style={{ flex: 1, cursor: "pointer" }}
              title="Open"
            >
              {e.date} —{" "}
              {e.file?.type?.startsWith("image/") ? "📷" :
               (/\.(pdf|doc|docx|txt|ppt|pptx|xls|xlsx)$/i.test(e.file?.name || e.content || "")) ? "📄" : "📝"}{" "}
              {e.content}
            </div>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete?.(e);
              }}
              title="Delete entry"
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid #fda4af",
                background: "#fff1f2",
                color: "#991b1b",
                cursor: "pointer",
              }}
            >
              🗑
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li style={{ color: "#777" }}>No matches.</li>}
      </ul>
    </>
  );
}
