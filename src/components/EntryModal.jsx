// src/components/EntryModal.jsx
import { createPortal } from "react-dom";

export default function EntryModal({ entry, onClose, onCopyText }) {
  if (!entry) return null;

  const openAttachment = async (mode = "open") => {
    const file = entry?.file;
    if (!file) return;

    const openUrl = (url, downloadName) => {
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url;
        if (downloadName) a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (url.startsWith("blob:")) {
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
        }
      } else {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (url.startsWith("blob:")) {
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
        }
        return win;
      }
    };

    // Direct URL string
    if (typeof file === "string" && /^https?:\/\//i.test(file)) {
      openUrl(file); return;
    }
    // Object with .url
    if (file?.url && /^https?:\/\//i.test(file.url)) {
      openUrl(file.url); return;
    }
    // Supabase { bucket, path, public? }
    if (file?.bucket && file?.path) {
      try {
        const mod = await import("../services/storage/supabase.js");
        const sb = mod?.supabaseClient;
        if (sb) {
          if (file.public) {
            const { data } = sb.storage.from(file.bucket).getPublicUrl(file.path);
            if (data?.publicUrl) openUrl(data.publicUrl);
          } else {
            const { data, error } = await sb.storage.from(file.bucket).createSignedUrl(file.path, 60);
            if (!error && data?.signedUrl) openUrl(data.signedUrl);
          }
          return;
        }
      } catch {}
    }
    // Blob/File
    if (typeof window !== "undefined" && (file instanceof Blob || file?.arrayBuffer)) {
      try {
        const u = URL.createObjectURL(file);
        openUrl(u, file?.name || "attachment");
        return;
      } catch {}
    }
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        // BIG z-index so it clears any stacking contexts
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(720px, 92vw)",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          border: "1px solid #e5e7eb",
          zIndex: 10001, // ensure the card is above the overlay itself
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, color: "#111827" }}>
            {entry.date} {entry.ts ? "• " + new Date(entry.ts).toLocaleTimeString() : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onCopyText?.()}
              style={{
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
            <button
              onClick={() => onClose?.()}
              style={{
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 16, color: "#111827", lineHeight: 1.55 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{entry.content}</div>

          {entry?.file ? (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <span>📎 {entry.file?.name || "Attachment"}</span>
              <button
                onClick={() => openAttachment("open")}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                Open attachment
              </button>
              <button
                onClick={() => openAttachment("download")}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Download
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Portal to body to avoid parent stacking contexts
  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}
