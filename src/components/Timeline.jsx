// src/components/Timeline.jsx
import { fmtTime12, fmtShort } from "../lib/time";
import { getIcon } from "../lib/icons";

export default function Timeline({ entries, now, onOpen }) {
  const times = entries.map((e) => e.ts);
  const minTime = times.length ? Math.min(...times) : Date.now();
  const maxTime = times.length ? Math.max(...times) : minTime + 1;
  const totalRange = Math.max(1, maxTime - minTime);

  return (
    <div>
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

      <div style={{ position: "relative", height: 480, marginTop: 8 }}>
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
        {entries.map((e, i) => {
          const relative = (e.ts - minTime) / totalRange;
          const top = 24 + relative * 400;
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
            transition: "all 0.3s ease",
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
                }}
              />
              {/* card */}
              <div
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
