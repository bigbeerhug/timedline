// src/components/TimelineControls.jsx
export default function TimelineControls({ minGap, trackHeight, onChange }) {
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          margin: "8px 0 12px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#475569", width: 70 }}>Gap</span>
          <input
            type="range"
            min={12}
            max={120}
            step={4}
            value={minGap}
            onChange={(e) => onChange({ minGap: Number(e.target.value) })}
          />
          <span style={{ fontSize: 12, color: "#64748b", width: 36, textAlign: "right" }}>
            {minGap}px
          </span>
        </label>
  
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#475569", width: 70 }}>Zoom</span>
          <input
            type="range"
            min={280}
            max={900}
            step={20}
            value={trackHeight}
            onChange={(e) => onChange({ trackHeight: Number(e.target.value) })}
          />
          <span style={{ fontSize: 12, color: "#64748b", width: 44, textAlign: "right" }}>
            {trackHeight}
          </span>
        </label>
  
        {/* Reset button */}
        <button
          onClick={() => onChange({ minGap: 24, trackHeight: 400 })}
          style={{
            padding: "6px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#f9fafb",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Reset
        </button>
      </div>
    );
  }
  