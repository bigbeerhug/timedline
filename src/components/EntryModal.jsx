// src/components/EntryModal.jsx
import { getIcon } from "../lib/icons";

function isImageFile(file) {
  if (!file) return false;

  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const url = (file.url || "").toLowerCase();

  if (type.startsWith("image/")) return true;

  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp") ||
    name.endsWith(".svg") ||
    url.includes(".jpg") ||
    url.includes(".jpeg") ||
    url.includes(".png") ||
    url.includes(".gif") ||
    url.includes(".webp") ||
    url.includes(".bmp") ||
    url.includes(".svg")
  );
}

function isPdfFile(file) {
  if (!file) return false;

  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const url = (file.url || "").toLowerCase();

  if (type === "application/pdf") return true;

  return name.endsWith(".pdf") || url.includes(".pdf");
}

export default function EntryModal({
  entry,
  onClose,
  onCopyText,
}) {
  if (!entry) return null;

  const file = entry.file || null;
  const fileUrl = file?.url || null;
  const showImage = fileUrl && isImageFile(file);
  const showPdf = fileUrl && isPdfFile(file);
  const showDownload = fileUrl && !showImage && !showPdf;

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
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 820,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>{entry.date}</h3>

        <p style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
          {getIcon(entry)} {entry.content}
        </p>

        {file && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 12,
              wordBreak: "break-word",
            }}
          >
            <div><strong>File:</strong> {file.name || "Unnamed file"}</div>
            <div><strong>Type:</strong> {file.type || "Unknown"}</div>
          </div>
        )}

        {showImage && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={fileUrl}
              alt={file?.name || "entry image"}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                display: "block",
                borderRadius: 8,
                border: "1px solid #eee",
                objectFit: "contain",
                margin: "0 auto",
              }}
              onError={(e) => {
                console.error("[EntryModal] image failed to load:", fileUrl);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        {showPdf && (
          <embed
            src={fileUrl}
            type="application/pdf"
            style={{
              width: "100%",
              height: 500,
              border: "1px solid #eee",
              borderRadius: 8,
              marginBottom: 12,
            }}
          />
        )}

        {showDownload && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 8, marginBottom: 12 }}
          >
            Open / Download {file?.name || "file"}
          </a>
        )}

        {!fileUrl && file && (
          <div
            style={{
              marginTop: 8,
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              background: "#fef3c7",
              color: "#92400e",
              fontSize: 13,
            }}
          >
            This file record exists, but no file URL is available yet.
          </div>
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