// src/components/NewEntryForm.jsx
import { useRef } from "react";

export default function NewEntryForm({
  newEntry, setNewEntry,
  selectedFile, setSelectedFile,
  handleSave,
  handleImport,
  disabled = false,
}) {
  const importFileRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  return (
    <div
      style={{
        border: "1px dashed #c7d2fe",
        background: "#eef2ff",
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <textarea
        value={newEntry}
        onChange={(e) => setNewEntry(e.target.value)}
        placeholder="Write a diary, memo, rant, or note... (⌘/Ctrl+S to save)"
        rows={4}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ddd",
          padding: 10,
          marginBottom: 12,
          fontFamily: "inherit",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input type="file" onChange={onFileChange} />
        {selectedFile && (
          <span style={{ fontSize: 12, color: "#374151" }}>
            Selected: {selectedFile.name}
          </span>
        )}
        <button
          onClick={() => importFileRef.current?.click()}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Import JSON
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
          }}
        />
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" disabled /> Lock in Vault Cell (Immutable) — (visual only in MVP)
      </label>
      <div style={{ marginTop: 12 }}>
        <button
          onClick={handleSave}
          disabled={disabled}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "none",
            background: disabled ? "#9ca3af" : "#4f46e5",
            color: "#fff",
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
        >
          Save Entry
        </button>
      </div>
      {disabled && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Sign in to save to your cloud vault.
        </div>
      )}
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
        Tip: drag & drop a file anywhere inside this blue box.
      </div>
    </div>
  );
}
