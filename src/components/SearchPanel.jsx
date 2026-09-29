// src/components/SearchPanel.jsx
import { useEffect, useState } from "react";

const PAGE_SIZE = 25;

export default function SearchPanel({
  searchTerm,
  setSearchTerm,
  filtered,
  searchLoading = false,
  searchError = "",
  searchTotalCount = 0,
  searchPage = 0,
  onPageChange,
  onOpen,
  onLogSearch,
  onDelete,
}) {
  const [page, setPage] = useState(0);
  const remotePaging = typeof onPageChange === "function";
  const currentPage = remotePaging ? searchPage : page;
  const totalResults = remotePaging ? searchTotalCount : filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = remotePaging ? filtered : filtered.slice(start, start + PAGE_SIZE);
  const changePage = (nextPage) => {
    if (remotePaging) onPageChange(nextPage);
    else setPage(nextPage);
  };

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
      {searchLoading && <p className="search-panel__status" role="status">Searching document text and metadata…</p>}
      {searchError && (
        <div className="notice notice--info" role="status">
          Search index is unavailable. Showing matches from loaded entry text and filenames. {searchError}
        </div>
      )}
      {remotePaging && searchTotalCount > 0 && (
        <p className="search-panel__status">Results are ranked across {searchTotalCount} matching entries.</p>
      )}
      {filtered.length > 0 && (
        <div className="result-window" aria-live="polite">
          <span>{start + 1}–{Math.min(start + PAGE_SIZE, totalResults)} / {totalResults}</span>
          <div className="result-window__actions">
            <button type="button" onClick={() => changePage(Math.max(0, safePage - 1))} disabled={safePage === 0}>Previous</button>
            <span>Page {safePage + 1} of {pageCount}</span>
            <button type="button" onClick={() => changePage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1}>Next</button>
          </div>
        </div>
      )}
      <ul className="entry-list">
        {visible.map((e, i) => (
          <li className="entry-row" key={e.id ?? `${e.ts}-${i}`}>
            <span className="entry-row__kind" aria-hidden="true">{e.file ? (e.fileMetadata?.category || "file") : "note"}</span>
            <button className="entry-row__body" onClick={() => onOpen?.(e)} title="Open memory">
              <span className="entry-row__date">{e.date}</span>
              <span className="entry-row__title">{e.content || e.file?.name || "Untitled memory"}</span>
              {e.searchExcerpt && <span className="entry-row__excerpt">{e.searchExcerpt.replace(/<\/?b>/gi, "")}</span>}
              {e.fileMetadata?.keywords?.length > 0 && (
                <span className="entry-row__keywords">{e.fileMetadata.keywords.slice(0, 5).join(" · ")}</span>
              )}
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
        {filtered.length === 0 && !searchLoading && (
          <li className="empty-state">
            <strong>{searchTerm ? "Nothing found yet." : "Search the whole vault."}</strong>
            <p>{searchTerm ? "Try a broader word, date, or filename." : "Every preserved entry is searchable by its words and capture date."}</p>
          </li>
        )}
      </ul>
    </div>
  );
}
