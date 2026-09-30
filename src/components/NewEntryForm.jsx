// src/components/NewEntryForm.jsx
import { useRef } from "react";

export default function NewEntryForm({
  newEntry, setNewEntry,
  selectedFile, setSelectedFile,
  handleSave,
  handleImport,
  handleChronicleImport,
  draftType = "idea",
  placeholder,
  showImports = true,
  focusOnMount = true,
  disabled = false,
  saving = false,
  indexing = false,
  indexProgress = null,
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
        placeholder={placeholder || "Capture an idea, observation, question, plan, or anything you do not want to lose…"}
        rows={6}
        autoFocus={focusOnMount}
      />

      <div className="idea-entry-form__actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving || (!newEntry.trim() && !selectedFile)}
          className="idea-entry-form__save"
        >
          {saving
            ? indexing
              ? "Reading file and saving…"
              : "Saving securely…"
            : draftType === "chronicle"
              ? "Save Chronicle"
              : draftType === "note"
                ? "Save entry"
                : "Capture Idea"}
        </button>

        <label className="idea-entry-form__attachment">
          <span>Attach a file</span>
          <input type="file" onChange={onFileChange} />
        </label>

        <span className="idea-entry-form__shortcut">Ctrl/Cmd + S</span>
      </div>

      {selectedFile && (
        <div className="idea-entry-form__selected">
          Selected: {selectedFile.name}
        </div>
      )}

      {indexing && (
        <div className="idea-entry-form__notice" role="status">
          {indexProgress?.kind === "archive"
            ? `Cataloging ZIP contents ${indexProgress.completed} of ${indexProgress.total}: ${indexProgress.label}`
            : indexProgress?.total
            ? `Reading PDF page ${indexProgress.completed} of ${indexProgress.total}…`
            : "Extracting searchable text on this device…"}
        </div>
      )}

      {selectedFile && !indexing && (
        <p className="idea-entry-form__hint">
          {selectedFile.name.toLowerCase().endsWith(".zip")
            ? "ZIP archives stay as one Timeline entry with a searchable file list. Text from supported documents is indexed on this device; media is searchable by filename and file details."
            : "PDF, Word, text, Markdown, and CSV text is indexed on this device. Other files remain searchable by filename and your description."}
        </p>
      )}

      {disabled && (
        <div className="idea-entry-form__notice">
          Sign in to save to your cloud vault.
        </div>
      )}

      {showImports && <details className="idea-entry-form__imports">
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
          Imports load into Timedline for review. Chronicles are saved only
          when you choose Save Chronicle.
        </p>
      </details>}
    </div>
  );
}
