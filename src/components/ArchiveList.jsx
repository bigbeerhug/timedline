// src/components/ArchiveList.jsx
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 50;

export default function ArchiveList({ groupedByDate, onOpen, onDelete }) {
  const [page, setPage] = useState(0);
  const entries = useMemo(
    () => groupedByDate.flatMap(([date, items]) => items.map((entry) => ({ date, entry }))),
    [groupedByDate]
  );
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const totalsByDate = useMemo(
    () => new Map(groupedByDate.map(([date, items]) => [date, items.length])),
    [groupedByDate]
  );
  const pageGroups = useMemo(() => {
    const groups = new Map();
    for (const { date, entry } of entries.slice(start, start + PAGE_SIZE)) {
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(entry);
    }
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
      total: totalsByDate.get(date) || items.length,
    }));
  }, [entries, start, totalsByDate]);

  useEffect(() => {
    setPage(0);
  }, [groupedByDate.length]);

  return (
    <div className="archive-list">
      {!groupedByDate.length && (
        <div className="empty-state">
          <strong>Your archive is still open.</strong>
          <p>Captured memories will settle here in date order.</p>
        </div>
      )}
      {entries.length > 0 && (
        <div className="result-window" aria-live="polite">
          <span>{start + 1}–{Math.min(start + PAGE_SIZE, entries.length)} / {entries.length}</span>
          <div className="result-window__actions">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={safePage === 0}>Previous</button>
            <span>Page {safePage + 1} of {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={safePage >= pageCount - 1}>Next</button>
          </div>
        </div>
      )}
      {pageGroups.map(({ date, items, total }) => (
        <div className="archive-day" key={date}>
          <div className="archive-day__heading">
            <span className="archive-day__date">{date}</span>
            <span className="archive-day__count">
              {total} {total === 1 ? "memory" : "memories"}
              {items.length < total ? ` · ${items.length} shown` : ""}
            </span>
          </div>
          <ul className="entry-list">
            {items.map((e, i) => (
              <li className="entry-row" key={e.id ?? `${e.ts}-${i}`}>
                <span className="entry-row__kind" aria-hidden="true">{e.file ? "file" : "note"}</span>
                <button className="entry-row__body" onClick={() => onOpen?.(e)} title="Open memory">
                  <span className="entry-row__date">{e.ts ? new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span>
                  <span className="entry-row__title">{e.content || e.file?.name || "Untitled memory"}</span>
                </button>
                <button className="entry-row__delete" onClick={(ev) => {
                    ev.stopPropagation();
                    onDelete?.(e);
                  }}
                  title="Delete entry"
                  aria-label={`Delete memory from ${date}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
