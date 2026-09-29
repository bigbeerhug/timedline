// src/components/SearchPanel.jsx
import { useEffect, useState } from "react";

const PAGE_SIZE = 25;

export default function SearchPanel({
  searchTerm,
  setSearchTerm,
  filtered,
  onOpen,
  onLogSearch,
  onDelete,
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, filtered.length]);

  return (
    <div className="search-panel">
      <form className="search-panel__form" onSubmit={(event) => { event.preventDefault(); onLogSearch?.(); }}>
        <input
          className="search-panel__input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search words, dates, filenames…"
          aria-label="Search your preserved memories"
        />
        <button className="search-panel__submit" type="submit">
          Find
        </button>
      </form>
      {filtered.length > 0 && (
        <div className="result-window" aria-live="polite">
          <span>{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div className="result-window__actions">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={safePage === 0}>Previous</button>
            <span>Page {safePage + 1} of {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={safePage >= pageCount - 1}>Next</button>
          </div>
        </div>
      )}
      <ul className="entry-list">
        {visible.map((e, i) => (
          <li className="entry-row" key={e.id ?? `${e.ts}-${i}`}>
            <span className="entry-row__kind" aria-hidden="true">{e.file ? "file" : "note"}</span>
            <button className="entry-row__body" onClick={() => onOpen?.(e)} title="Open memory">
              <span className="entry-row__date">{e.date}</span>
              <span className="entry-row__title">{e.content || e.file?.name || "Untitled memory"}</span>
            </button>
            <button className="entry-row__delete" onClick={(ev) => {
                ev.stopPropagation();
                onDelete?.(e);
              }}
              title="Delete entry"
              aria-label={`Delete memory from ${e.date}`}
            >
              ×
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="empty-state">
            <strong>{searchTerm ? "Nothing found yet." : "Search the whole vault."}</strong>
            <p>{searchTerm ? "Try a broader word, date, or filename." : "Every preserved entry is searchable by its words and capture date."}</p>
          </li>
        )}
      </ul>
    </div>
  );
}
