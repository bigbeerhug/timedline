import { useEffect, useState } from "react";
import NewEntryForm from "./NewEntryForm";

const PAGE_SIZE = 25;

function formatCapturedAt(ts) {
  const date = new Date(ts);

  if (Number.isNaN(date.getTime())) return "Unknown capture time";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function IdeaStream({
  newEntry,
  setNewEntry,
  selectedFile,
  setSelectedFile,
  disabled,
  saving,
  fileIndexing,
  fileIndexProgress,
  saveResult,
  handleSave,
  handleImport,
  handleChronicleImport,
  draftType,
  ideas,
  onOpen,
  onDelete,
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(ideas.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visibleIdeas = ideas.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [ideas.length]);

  return (
    <div className="idea-stream">
      <section className="idea-capture" aria-labelledby="idea-capture-title">
        <div className="idea-capture__heading">
          <div>
            <p className="idea-kicker">Capture first. Organize later.</p>
            <h2 id="idea-capture-title">What are you thinking?</h2>
          </div>
          <span className="idea-capture__storage">
            {disabled ? "Sign in to preserve" : "Vault ready"}
          </span>
        </div>

        <NewEntryForm
          newEntry={newEntry}
          setNewEntry={setNewEntry}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          disabled={disabled}
          saving={saving}
          indexing={fileIndexing}
          indexProgress={fileIndexProgress}
          handleSave={handleSave}
          handleImport={handleImport}
          handleChronicleImport={handleChronicleImport}
          draftType={draftType}
        />

        {saveResult?.ok && (
          <div className="idea-save-result" role="status">
            <strong>
              {saveResult.type === "chronicle"
                ? "Chronicle saved"
                : saveResult.number
                  ? `Saved as Idea #${saveResult.number}`
                  : "Idea saved"}
            </strong>
            <span>{formatCapturedAt(saveResult.ts)}</span>
          </div>
        )}
      </section>

      <section className="idea-stream__feed" aria-labelledby="idea-stream-title">
        <div className="idea-stream__toolbar">
          <div>
            <p className="idea-kicker">Captured ideas only</p>
            <h2 id="idea-stream-title">Idea Stream</h2>
          </div>
        </div>
        <p className="idea-stream__count">
          {ideas.length} idea{ideas.length === 1 ? "" : "s"}
        </p>

        {ideas.length > 0 && (
          <div className="result-window" aria-live="polite">
            <span>{start + 1}–{Math.min(start + PAGE_SIZE, ideas.length)} / {ideas.length}</span>
            <div className="result-window__actions">
              <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={safePage === 0}>Previous</button>
              <span>Page {safePage + 1} of {pageCount}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={safePage >= pageCount - 1}>Next</button>
            </div>
          </div>
        )}

        <div className="idea-list">
          {visibleIdeas.map((idea, index) => (
            <details className="idea-item" key={idea.id ?? `${idea.ts}-${index}`}>
              <summary>
                <span className="idea-item__identity">
                  <span className="idea-item__number">
                    {idea.id != null ? `Idea #${idea.id}` : "Idea"}
                  </span>
                  <span>{formatCapturedAt(idea.ts)}</span>
                </span>
                <span className="idea-item__excerpt">
                  {idea.content || idea.file?.name || "Untitled idea"}
                </span>
              </summary>
              <div className="idea-item__details">
                <div className="idea-item__content">
                  {idea.content || "No text was captured."}
                </div>
                {idea.file && (
                  <div className="idea-item__file">
                    Attachment: {idea.file.name || "File"}
                  </div>
                )}
                <button type="button" onClick={() => onOpen?.(idea)}>
                  Open idea
                </button>
                <button type="button" onClick={() => onDelete?.(idea)}>
                  Delete
                </button>
              </div>
            </details>
          ))}

          {ideas.length === 0 && (
            <div className="idea-empty">
              No captured ideas yet. Unclassified legacy entries remain in the
              Timeline and Archive until you choose how to classify them.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
