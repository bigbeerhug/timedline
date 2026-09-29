// src/components/TimelineControls.jsx
export default function TimelineControls({ minGap, trackHeight, onChange }) {
    return (
      <div className="timeline-controls">
        <label className="timeline-control">
          <span>Card gap</span>
          <input
            type="range"
            min={12}
            max={120}
            step={4}
            value={minGap}
            onChange={(e) => onChange({ minGap: Number(e.target.value) })}
          />
          <span className="timeline-control__value">{minGap}px</span>
        </label>
  
        <label className="timeline-control">
          <span>Timeline height</span>
          <input
            type="range"
            min={280}
            max={900}
            step={20}
            value={trackHeight}
            onChange={(e) => onChange({ trackHeight: Number(e.target.value) })}
          />
          <span className="timeline-control__value">{trackHeight}</span>
        </label>
  
        {/* Reset button */}
        <button
          onClick={() => onChange({ minGap: 24, trackHeight: 400 })}
          className="secondary-button"
        >
          Reset
        </button>
      </div>
    );
  }
  