// src/components/NewEntryForm.jsx
import { useRef } from "react";

export default function NewEntryForm({
  newEntry, setNewEntry,
  selectedFile, setSelectedFile,
  handleSave,
  handleImport,
  handleChronicleImport,
  disabled = false,
  saving = false,
}) {
  const importFileRef = useRef(null);
  const chronicleFileRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  return (
    <div className="idea-entry-form">
      <textarea
        value={newEntry}
        onChange={(e) => setNewEntry(e.target.value)}
        placeholder="Capture an idea, observation, question, plan, or anything you do not want to lose…"
        rows={6}
        autoFocus
      />

      <div className="idea-entry-form__actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving || (!newEntry.trim() && !selectedFile)}
          className="idea-entry-form__save"
        >
          {saving ? "Saving securely…" : "Capture Idea"}
        </button>

        <label className="idea-entry-form__attachment">
          <span>Attach a file</span>
          <input type="file" onChange={onFileChange} />
        </label>

        <span className="idea-entry-form__shortcut">⌘/Ctrl + S</span>
      </div>

      {selectedFile && (
        <div className="idea-entry-form__selected">
          Selected: {selectedFile.name}
        </div>
      )}

      {disabled && (
        <div className="idea-entry-form__notice">
          Sign in to save to your cloud vault.
        </div>
      )}

      <details className="idea-entry-form__imports">
        <summary>Import an existing archive</summary>
        <div className="idea-entry-form__import-actions">
          <button
            type="button"
            onClick={() => chronicleFileRef.current?.click()}
          >
            Import Chronicle
          </button>
          <input
            ref={chronicleFileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await handleChronicleImport(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
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
              e.target.value = "";
            }}
          />
        </div>
        <p>
          Imports load into Timedline for review. Nothing is saved until you
          choose Capture Idea.
        </p>
      </details>
    </div>
  );
}
