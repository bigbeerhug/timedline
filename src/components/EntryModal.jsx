// src/components/EntryModal.jsx
import { getIcon } from "../lib/icons";

export default function EntryModal({
  entry,      // object | null
  onClose,    // () => void
  onCopyText, // () => void
}) {
  if (!entry) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 720,
          width: "90%",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{entry.date}</h3>
        <p style={{ marginTop: 4, marginBottom: 12 }}>
          {getIcon(entry)} {entry.content}
        </p>

        {/* Inline preview for common types */}
        {entry.file?.url && entry.file?.type?.startsWith("image/") && (
          <img
            src={entry.file.url}
            alt={entry.file.name}
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }}
          />
        )}

        {entry.file?.url && entry.file?.type === "application/pdf" && (
          <embed
            src={entry.file.url}
            type="application/pdf"
            style={{
              width: "100%",
              height: 420,
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          />
        )}

        {/* Fallback download link */}
        {entry.file?.url &&
          !entry.file?.type?.startsWith("image/") &&
          entry.file?.type !== "application/pdf" && (
            <a
              href={entry.file.url}
              download={entry.file.name}
              style={{ display: "inline-block", marginTop: 8 }}
            >
              ⬇️ Download {entry.file.name}
            </a>
          )}

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f3f4f6",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            onClick={onCopyText}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Copy Text
          </button>
        </div>
      </div>
    </div>
  );
}
