// src/components/Timeline.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmtTime12, fmtShort } from "../lib/time";
import { getIcon } from "../lib/icons";

/**
 * Timeline (newest-first) with adaptive spacing.
 * Props:
 *  - minGap (number): minimum px between stacked cards on the SAME side (default 24)
 *  - trackHeight (number): base vertical spread for time mapping (default 400)
 */
export default function Timeline({
  entries,
  now,
  onOpen,
  minGap = 24,
  trackHeight = 400,
}) {
  // 1) Newest first
  const items = useMemo(
    () => [...(entries || [])].sort((a, b) => (b?.ts ?? 0) - (a?.ts ?? 0)),
    [entries]
  );

  // 2) Time math (same as your original)
  const times = (entries || []).map((e) => e.ts);
  const minTime = times.length ? Math.min(...times) : Date.now();
  const maxTime = times.length ? Math.max(...times) : minTime + 1;
  const totalRange = Math.max(1, maxTime - minTime);

  // Geometry constants (visuals unchanged)
  const TOP_START = 24;   // top padding before first card
  const DOT_OFFSET = 6;   // dot alignment against card

  // Newest higher on the track
  const desiredTopFor = (ts) =>
    TOP_START + (1 - (ts - minTime) / totalRange) * trackHeight;

  // 3) Measure actual card heights
  const cardRefs = useRef(new Map());        // index -> DOM node
  const [heights, setHeights] = useState({}); // index -> measured height

  useLayoutEffect(() => {
    // initial measure
    const h = {};
    cardRefs.current.forEach((node, idx) => {
      if (node) h[idx] = node.getBoundingClientRect().height || 0;
    });
    setHeights(h);

    // observe changes
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      const next = {};
      for (const en of entries) {
        const idxAttr = en.target.getAttribute("data-idx");
        if (idxAttr == null) continue;
        const idx = Number(idxAttr);
        const newH = en.contentRect.height || 0;
        if (heights[idx] !== newH) {
          next[idx] = newH;
          changed = true;
        }
      }
      if (changed) setHeights((prev) => ({ ...prev, ...next }));
    });

    cardRefs.current.forEach((node) => node && ro.observe(node));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // re-measure on resize (text reflow)
  useEffect(() => {
    const onResize = () => {
      const h = {};
      cardRefs.current.forEach((node, idx) => {
        if (node) h[idx] = node.getBoundingClientRect().height || 0;
      });
      setHeights(h);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 4) Collision-avoidance with measured heights
  const placed = useMemo(() => {
    let lastTopLeft = TOP_START - minGap;
    let lastHLeft = 0;
    let lastTopRight = TOP_START - minGap;
    let lastHRight = 0;

    return items.map((e, i) => {
      const desiredTop = desiredTopFor(e.ts);
      const side = i % 2 === 0 ? "left" : "right";
      const h = heights[i] ?? 0;

      const prevTop = side === "left" ? lastTopLeft : lastTopRight;
      const prevH = side === "left" ? lastHLeft : lastHRight;

      // stack below previous card on same side with breathing room
      const minTop = prevTop + prevH + minGap;
      const top = Math.max(desiredTop, minTop);

      if (side === "left") {
        lastTopLeft = top;
        lastHLeft = h;
      } else {
        lastTopRight = top;
        lastHRight = h;
      }

      return { e, i, side, top, height: h };
    });
  }, [items, heights, minGap, trackHeight, totalRange]);

  // 5) Container height (>= original 480)
  const containerHeight = useMemo(() => {
    let maxBottom = 0;
    for (const { top, height } of placed) {
      const bottom = top + (height || 0);
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return Math.max(480, Math.ceil(maxBottom + 100));
  }, [placed]);

  return (
    <div>
      {/* Header (unchanged) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Live Timedline</h2>
        <div
          style={{
            fontVariantNumeric: "tabular-nums",
            color: "#4f46e5",
            fontWeight: 700,
          }}
        >
          {fmtTime12(now)}
        </div>
      </div>

      {/* Rail + items */}
      <div style={{ position: "relative", height: containerHeight, marginTop: 8 }}>
        {/* vertical line */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-1px)",
            width: 2,
            height: "100%",
            background: "#e5e7eb",
          }}
        />

        {items.map((e, i) => {
          // first paint uses desiredTop so we can measure; subsequent paints use placed[i].top
          const desiredTop = desiredTopFor(e.ts);
          const info = placed[i];
          const top = info?.top ?? desiredTop;
          const side = i % 2 === 0 ? "left" : "right";

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
            transition: "all 0.2s ease",
          };

          return (
            <div key={e.ts || i}>
              {/* dot */}
              <div
                style={{
                  position: "absolute",
                  top: top + DOT_OFFSET,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "9999px",
                  background: "#4f46e5",
                  boxShadow: "0 0 8px rgba(79,70,229,0.4)",
                }}
              />
              {/* card */}
              <div
                ref={(node) => {
                  if (node) cardRefs.current.set(i, node);
                  else cardRefs.current.delete(i);
                }}
                data-idx={i}
                style={boxStyle}
                onClick={() => onOpen?.(e)}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                  {e.date} • {fmtShort(e.ts)}
                </div>
                <div style={{ fontWeight: 600, color: "#111827" }}>
                  {getIcon(e)} {e.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
