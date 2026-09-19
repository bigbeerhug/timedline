import { useMemo, useState } from "react";

import NewEntryForm from "./NewEntryForm";

function formatCapturedAt(ts) {
  const date = new Date(ts);

  if (Number.isNaN(date.getTime())) return "Unknown capture time";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function displayNumber(entry) {
  return entry?.id == null ? null : String(entry.id);
}

function excerpt(content, limit = 180) {
  const value = String(content || "").trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}…`;
}

export default function IdeaStream({
  entries,
  newEntry,
  setNewEntry,
  selectedFile,
  setSelectedFile,
  disabled,
  saving,
  saveResult,
  handleSave,
  handleImport,
  handleChronicleImport,
  onOpen,
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    if (!normalizedQuery) return entries;

    return entries.filter((entry) => {
      const number = displayNumber(entry) || "";
      return [entry.content, entry.date, entry.file?.name, number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [entries, normalizedQuery]);

  return (
    <div className="idea-stream">
      <section className="idea-capture" aria-labelledby="idea-capture-title">
        <div className="idea-capture__heading">
          <div>
            <p className="idea-kicker">Capture first. Organize later.</p>
            <h2 id="idea-capture-title">What are you thinking?</h2>
          </div>
          <span className="idea-capture__storage">Saved to your Timedline</span>
        </div>

        <NewEntryForm
          newEntry={newEntry}
          setNewEntry={setNewEntry}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          disabled={disabled}
          saving={saving}
          handleSave={handleSave}
          handleImport={handleImport}
          handleChronicleImport={handleChronicleImport}
        />

        {saveResult?.ok && (
          <div className="idea-save-result" role="status">
            <strong>
              {saveResult.number
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
            <p className="idea-kicker">Newest first</p>
            <h2 id="idea-stream-title">Idea Stream</h2>
          </div>
          <label className="idea-search">
            <span className="sr-only">Search the Idea Stream</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ideas, dates, files, or numbers"
            />
          </label>
        </div>

        <div className="idea-stream__count">
          {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}
          {normalizedQuery ? " found" : " preserved"}
        </div>

        <div className="idea-list">
          {visibleEntries.map((entry) => {
            const number = displayNumber(entry);

            return (
              <details className="idea-item" key={entry.id ?? entry.ts}>
                <summary>
                  <div className="idea-item__identity">
                    <span className="idea-item__number">
                      {number ? `#${number}` : "Saved entry"}
                    </span>
                    <time dateTime={new Date(entry.ts).toISOString()}>
                      {formatCapturedAt(entry.ts)}
                    </time>
                  </div>
                  <div className="idea-item__excerpt">
                    {excerpt(entry.content) || entry.file?.name || "File capture"}
                  </div>
                </summary>

                <div className="idea-item__details">
                  <div className="idea-item__content">{entry.content}</div>
                  {entry.file?.name && (
                    <div className="idea-item__file">Attachment: {entry.file.name}</div>
                  )}
                  <button type="button" onClick={() => onOpen?.(entry)}>
                    Open full entry
                  </button>
                </div>
              </details>
            );
          })}

          {visibleEntries.length === 0 && (
            <div className="idea-empty">
              {normalizedQuery
                ? "No preserved entries match that search."
                : "Your first captured idea will appear here."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
