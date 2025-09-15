// src/components/Timeline.jsx
import { useRef, useState } from "react";
import { fmtTime12, fmtShort } from "../lib/time";
import { getIcon } from "../lib/icons";

export default function Timeline({
  entries,
  now,
  onOpen,
  trackHeight = 400,
  minGap = 24,
  newestFirst = true,
}) {
  const containerRef = useRef(null);

  // ---------- Hover preview state ----------
  const [preview, setPreview] = useState({
    src: null,
    top: 0,
    leftCss: "50%",
    revoke: false,
  });

  const jumpToNewest = () => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------- Helpers for attachments ----------
  const isImageFile = (file) => {
    if (!file) return false;

    const isUrlStr =
      typeof file === "string" && /^https?:\/\//i.test(file);
    const urlStr = isUrlStr ? file : (file?.url || "");
    const nameStr = file?.name || "";

    const byMime = typeof file?.type === "string" && file.type.startsWith("image/");
    const byBlob = typeof window !== "undefined" && file instanceof Blob && file.type?.startsWith("image/");

    const ext = (urlStr || nameStr).toLowerCase().split(/[?#]/)[0].split(".").pop();
    const byExt = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext);

    return byMime || byBlob || byExt;
  };

  const getAttachmentUrl = async (file) => {
    if (!file) return null;

    // 1) Direct URL string
    if (typeof file === "string" && /^https?:\/\//i.test(file)) return file;

    // 2) Object with .url
    if (file?.url && /^https?:\/\//i.test(file.url)) return file.url;

    // 3) Supabase { bucket, path, public? }
    if (file?.bucket && file?.path) {
      try {
        const mod = await import("../services/storage/supabase.js");
        const sb = mod?.supabaseClient;
        if (sb) {
          if (file.public) {
            const { data } = sb.storage.from(file.bucket).getPublicUrl(file.path);
            return data?.publicUrl || null;
          } else {
            const { data, error } = await sb.storage
              .from(file.bucket)
              .createSignedUrl(file.path, 60);
            if (!error) return data?.signedUrl || null;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 4) Blob/File
    if (typeof window !== "undefined" && (file instanceof Blob || file?.arrayBuffer)) {
      try {
        const u = URL.createObjectURL(file);
        return u; // remember to revoke when done
      } catch {}
    }

    return null;
  };

  const handleOpenAttachment = async (file) => {
    if (!file) return;
    const url = await getAttachmentUrl(file);
    if (!url) return;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (url.startsWith("blob:")) {
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 10000);
    }
    return win;
  };

  const handlePreviewEnter = async (file, side, top) => {
    if (!isImageFile(file)) return;

    // revoke previous blob preview if any
    if (preview.src && preview.revoke && preview.src.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview.src); } catch {}
    }

    const url = await getAttachmentUrl(file);
    if (!url) return;

    // position preview near the card side
    const leftCss = side === "left" ? "calc(50% - 360px)" : "calc(50% + 40px)";
    setPreview({
      src: url,
      top: Math.max(8, top - 8),
      leftCss,
      revoke: url.startsWith("blob:"),
    });
  };

  const handlePreviewLeave = () => {
    if (preview.src && preview.revoke && preview.src.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview.src); } catch {}
    }
    setPreview({ src: null, top: 0, leftCss: "50%", revoke: false });
  };

  // ---------- Positioning + spacing ----------
  const times = entries.map((e) => e.ts);
  const minTime = times.length ? Math.min(...times) : Date.now();
  const maxTime = times.length ? Math.max(...times) : minTime + 1;
  const totalRange = Math.max(1, maxTime - minTime);

  // Height-aware spacing
  const PAD_TOP = 24;

  const estimateCardHeight = (e) => {
    const text = typeof e.content === "string" ? e.content : "";
    const charPerLine = 60;
    const lines = Math.max(1, Math.ceil(text.length / charPerLine));
    const lineHeight = 18;
    const header = 22;
    const padding = 24;
    const attach = e.file ? 28 : 0;
    const minH = 64;
    const maxH = 280;
    return Math.min(maxH, Math.max(minH, header + lines * lineHeight + padding + attach));
  };

  let lastLeft = { top: -Infinity, h: 0 };
  let lastRight = { top: -Infinity, h: 0 };
  let maxBottom = 0;

  const positioned = entries.map((e, i) => {
    const rel = (e.ts - minTime) / totalRange; // 0 old .. 1 new
    const y = newestFirst ? 1 - rel : rel;     // invert so NEW is at top when newestFirst
    let top = PAD_TOP + y * trackHeight;

    const side = i % 2 === 0 ? "left" : "right";
    const h = estimateCardHeight(e);

    if (side === "left") {
      const minTop = (isFinite(lastLeft.top) ? lastLeft.top + lastLeft.h + minGap : -Infinity);
      if (top < minTop) top = minTop;
      lastLeft = { top, h };
    } else {
      const minTop = (isFinite(lastRight.top) ? lastRight.top + lastRight.h + minGap : -Infinity);
      if (top < minTop) top = minTop;
      lastRight = { top, h };
    }

    const bottom = top + h;
    if (bottom > maxBottom) maxBottom = bottom;

    const filePresent =
      typeof e.file === "string" ||
      !!e.file?.url ||
      !!(e.file?.bucket && e.file?.path) ||
      (typeof window !== "undefined" && e.file instanceof Blob);

    return { e, i, top, side, filePresent };
  });

  const containerHeight = Math.max(trackHeight + PAD_TOP * 2, maxBottom + PAD_TOP);

  // ---------- Day separators (based on actual positioned order) ----------
  const sortedPos = [...positioned].sort((a, b) => a.top - b.top);
  const separators = [];
  let lastDate = null;
  for (const p of sortedPos) {
    if (p.e.date && p.e.date !== lastDate) {
      separators.push({ top: Math.max(8, p.top - 10), label: p.e.date });
      lastDate = p.e.date;
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Live Timedline</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              fontVariantNumeric: "tabular-nums",
              color: "#4f46e5",
              fontWeight: 700,
              minWidth: 86,
              textAlign: "right",
            }}
          >
            {fmtTime12(now)}
          </div>
          <button
            onClick={jumpToNewest}
            title="Scroll to newest"
            style={{
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: "#f9fafb",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Jump to newest
          </button>
        </div>
      </div>

      {/* Track */}
      <div
        ref={containerRef}
        style={{ position: "relative", minHeight: containerHeight, marginTop: 8 }}
      >
        {/* vertical center line */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-1px)",
            width: 2,
            height: "100%",
            background: "#e5e7eb",
            zIndex: 0,
          }}
        />

        {/* day separators */}
        {separators.map((s, idx) => (
          <div key={`sep-${idx}`}>
            <div
              style={{
                position: "absolute",
                top: s.top,
                left: 0,
                right: 0,
                borderTop: "1px dashed #f1f5f9",
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: s.top,
                left: "50%",
                transform: "translate(-50%, -50%)",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontSize: 12,
                zIndex: 1,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}

        {/* entries */}
        {positioned.map(({ e, i, top, side, filePresent }) => {
          const boxStyle = {
            position: "absolute",
            top,
            [side]: "52%",
            maxWidth: 320,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            cursor: "pointer",
            transition: "all 0.3s ease",
            zIndex: 2,
          };

          return (
            <div key={e.ts || i}>
              {/* dot */}
              <div
                style={{
                  position: "absolute",
                  top: top + 6,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "9999px",
                  background: "#4f46e5",
                  boxShadow: "0 0 8px rgba(79,70,229,0.4)",
                  zIndex: 1,
                }}
              />
              {/* card */}
              <div style={boxStyle} onClick={() => onOpen?.(e)}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                  {e.date} • {fmtShort(e.ts)}
                </div>
                <div style={{ fontWeight: 600, color: "#111827" }}>
                  {getIcon(e)} {e.content}
                </div>

                {/* Attachment chip */}
                {filePresent && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 12,
                      color: "#374151",
                    }}
                    onClick={(evt) => {
                      evt.stopPropagation();
                      handleOpenAttachment(e.file);
                    }}
                    onMouseEnter={() => handlePreviewEnter(e.file, side, top)}
                    onMouseLeave={handlePreviewLeave}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 999,
                        background: "#f9fafb",
                        cursor: "pointer",
                      }}
                      title="Open attachment"
                    >
                      📎 Open
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      {e.file?.name || "Attachment"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* hover image preview */}
        {preview.src && (
          <div
            style={{
              position: "absolute",
              top: preview.top,
              left: preview.leftCss,
              transform: "translateY(-8px)",
              padding: 6,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            <img
              src={preview.src}
              alt="preview"
              style={{ display: "block", width: 220, height: "auto", maxHeight: 220, objectFit: "cover", borderRadius: 6 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
