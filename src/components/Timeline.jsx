// src/components/Timeline.jsx
import { useRef, useState } from "react";
import { fmtTime12, fmtShort } from "../lib/time";

export default function Timeline({
  entries,
  now,
  onOpen,
  trackHeight = 400,
  minGap = 24,
  newestFirst = true,
  totalCount = entries.length,
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
      } catch {
        // Blob URLs are a best-effort fallback for local previews.
      }
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
        try { URL.revokeObjectURL(url); } catch {
          // The browser may have already released the temporary URL.
        }
      }, 10000);
    }
    return win;
  };

  const handlePreviewEnter = async (file, side, top) => {
    if (!isImageFile(file)) return;

    // revoke previous blob preview if any
    if (preview.src && preview.revoke && preview.src.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview.src); } catch {
        // The browser may have already released the temporary URL.
      }
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
      try { URL.revokeObjectURL(preview.src); } catch {
        // The browser may have already released the temporary URL.
      }
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
    <div className="timeline">
      {/* Header */}
      <div className="timeline-card__header">
        <div>
          <p className="eyebrow">One chronology</p>
          <h2 className="section-title">The Timedline</h2>
          <p className="timeline-subtitle">
            {entries.length < totalCount
              ? `Latest ${entries.length.toLocaleString()} of ${totalCount.toLocaleString()} records`
              : `${totalCount.toLocaleString()} chronological records`}
          </p>
        </div>
        <div className="timeline-actions">
          <span className="timeline-clock">{fmtTime12(now)}</span>
          <button className="secondary-button" onClick={jumpToNewest} title="Scroll to newest" disabled={!entries.length}>Newest</button>
        </div>
      </div>

      {/* Track */}
      {entries.length === 0 ? (
        <div className="timeline-empty" role="status">
          No entries yet. Use “New regular entry” to begin your Timeline, or capture an idea in Idea Stream.
        </div>
      ) : <div ref={containerRef} className="timeline-track" style={{ minHeight: containerHeight }}>
        {/* vertical center line */}
        {/* day separators */}
        {separators.map((s, idx) => (
          <div key={`sep-${idx}`}>
            <div className="timeline-separator-line" style={{ top: s.top }} />
            <div className="timeline-separator-label" style={{ top: s.top }}>
              {s.label}
            </div>
          </div>
        ))}

        {/* entries */}
        {positioned.map(({ e, i, top, side, filePresent }) => {
          const boxStyle = { top, [side]: "52%" };

          return (
            <div key={e.ts || i}>
              {/* dot */}
              <div className="timeline-point" style={{ top: top + 6 }} />
              {/* card */}
              <button className="timeline-entry" style={boxStyle} onClick={() => onOpen?.(e)}>
                <div className="timeline-entry__meta">
                  {e.date} • {fmtShort(e.ts)}
                </div>
                <div className="timeline-entry__text">{e.content || e.file?.name || "Untitled memory"}</div>

                {/* Attachment chip */}
                {filePresent && (
                  <div
                    className="timeline-entry__file"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      handleOpenAttachment(e.file);
                    }}
                    onMouseEnter={() => handlePreviewEnter(e.file, side, top)}
                    onMouseLeave={handlePreviewLeave}
                  >
                    <span title="Open attachment">Open file · {e.file?.name || "Attachment"}</span>
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* hover image preview */}
        {preview.src && (
          <div className="timeline-preview" style={{ position: "absolute", top: preview.top, left: preview.leftCss }}>
            <img
              src={preview.src}
              alt="preview"
              style={{ display: "block", width: 220, height: "auto", maxHeight: 220, objectFit: "cover", borderRadius: 6 }}
            />
          </div>
        )}
      </div>}
    </div>
  );
}
