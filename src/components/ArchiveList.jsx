// src/components/ArchiveList.jsx
export default function ArchiveList({ groupedByDate, onOpen, onDelete }) {
  return (
    <>
      {groupedByDate.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            {date}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((e, i) => (
              <li
                key={i}
                style={{
                  padding: "6px 0",
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  onClick={() => onOpen?.(e)}
                  style={{ flex: 1, display: "inline-flex", gap: 8, alignItems: "center" }}
                  title="Open"
                >
                  {e.file?.type?.startsWith("image/") ? "📷" :
                   (/\.(pdf|doc|docx|txt|ppt|pptx|xls|xlsx)$/i.test(e.file?.name || e.content || "")) ? "📄" : "📝"}
                  <span>{e.content}</span>
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
          </ul>
        </div>
      ))}
    </>
  );
}
