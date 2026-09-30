// src/components/EntryModal.jsx
import { useMemo, useState } from "react";
import { extractArchiveMember } from "../lib/fileIndexing";

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function ArchiveContents({ entry, fileUrl, onCreateEntries }) {
  const archive = entry.fileMetadata.archive;
  const members = useMemo(() => Array.isArray(archive?.members) ? archive.members : [], [archive?.members]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const pageSize = 50;
  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? members.filter((member) => member.path.toLocaleLowerCase().includes(needle)) : members;
  }, [members, query]);
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const visibleMembers = filteredMembers.slice(page * pageSize, (page + 1) * pageSize);
  const selectedMembers = members.filter((member) => selected.has(member.id));
  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((member) => selected.has(member.id));
  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every((member) => selected.has(member.id));

  function getArchiveSource() {
    if (!fileUrl) throw new Error("The original ZIP file is not available to open right now.");
    return fileUrl;
  }

  function toggleMember(member) {
    if (member.unsafe || member.extractionStatus === "encrypted" || member.sizeBytes > 100 * 1024 * 1024) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(member.id)) next.delete(member.id);
      else next.add(member.id);
      return next;
    });
    setConfirmBulk(false);
    setMessage("");
  }

  function toggleVisible() {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleMembers.forEach((member) => next.delete(member.id));
      else visibleMembers.forEach((member) => {
        if (!member.unsafe && member.extractionStatus !== "encrypted" && member.sizeBytes <= 100 * 1024 * 1024) next.add(member.id);
      });
      return next;
    });
    setConfirmBulk(false);
  }

  function toggleFiltered() {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allFilteredSelected) filteredMembers.forEach((member) => next.delete(member.id));
      else filteredMembers.forEach((member) => {
        if (!member.unsafe && member.extractionStatus !== "encrypted" && member.sizeBytes <= 100 * 1024 * 1024) next.add(member.id);
      });
      return next;
    });
    setConfirmBulk(false);
  }

  async function downloadMember(member) {
    setDownloadingId(member.id);
    setMessage("");
    try {
      const blob = await extractArchiveMember(getArchiveSource(), member);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = member.name || "archive-file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setMessage(error?.message || `Could not extract ${member.name}.`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function createSelectedEntries() {
    if (!selectedMembers.length || !onCreateEntries) return;
    if (selectedMembers.length > 20 && !confirmBulk) {
      setConfirmBulk(true);
      return;
    }
    setCreating(true);
    setProgress({ completed: 0, total: selectedMembers.length, createdCount: 0, failedCount: 0 });
    setMessage("");
    try {
      const result = await onCreateEntries(entry, selectedMembers, getArchiveSource(), setProgress);
      if (result?.failedCount) {
        const failed = new Set(selectedMembers.filter((member) => result.errors?.some((error) => error.startsWith(`${member.path}:`))).map((member) => member.id));
        setSelected(failed);
        setMessage(`Created ${result.createdCount} entr${result.createdCount === 1 ? "y" : "ies"}; ${result.failedCount} could not be added. Failed files remain selected so you can retry.`);
      } else {
        setSelected(new Set());
        setMessage(`Created ${result?.createdCount || selectedMembers.length} Timeline entr${(result?.createdCount || selectedMembers.length) === 1 ? "y" : "ies"}.`);
      }
    } catch (error) {
      setMessage(error?.message || "Could not create Timeline entries from this archive.");
    } finally {
      setCreating(false);
      setConfirmBulk(false);
    }
  }

  return (
    <section className="zip-archive-panel" aria-label="ZIP archive contents">
      <div className="zip-archive-panel__summary">
        <div><strong>{archive.memberCount.toLocaleString()} files</strong><span>{formatBytes(archive.totalUncompressedBytes)} uncompressed</span></div>
        <div className="zip-archive-panel__types">
          {Object.entries(archive.categories || {}).map(([category, count]) => <span key={category}>{count} {category}{count === 1 ? "" : "s"}</span>)}
        </div>
        {archive.note && <p role="note">{archive.note}</p>}
        {!fileUrl && <p role="status">The ZIP inventory is searchable, but the original file link is unavailable for extraction.</p>}
      </div>

      <div className="zip-archive-panel__toolbar">
        <input aria-label="Filter archive filenames" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Filter filenames or folders…" />
        <button type="button" className="secondary-button" onClick={toggleVisible} disabled={!visibleMembers.length || creating}>
          {allVisibleSelected ? "Unselect this page" : `Select this page (${visibleMembers.length})`}
        </button>
        <button type="button" className="secondary-button" onClick={toggleFiltered} disabled={!filteredMembers.length || creating}>
          {allFilteredSelected ? "Unselect matches" : `Select all ${filteredMembers.length.toLocaleString()}`}
        </button>
      </div>

      <div className="zip-archive-panel__list">
        {visibleMembers.map((member) => {
          const disabled = member.unsafe || member.extractionStatus === "encrypted" || member.sizeBytes > 100 * 1024 * 1024;
          return (
            <div className="zip-archive-member" key={member.id}>
              <input type="checkbox" aria-label={`Select ${member.path}`} checked={selected.has(member.id)} disabled={disabled || creating} onChange={() => toggleMember(member)} />
              <div className="zip-archive-member__details">
                <strong title={member.path}>{member.path}</strong>
                <span>{member.category} · {formatBytes(member.sizeBytes)}{member.lastModified ? ` · ${new Date(member.lastModified).toLocaleDateString()}` : ""}</span>
              </div>
              <button type="button" className="secondary-button" disabled={!fileUrl || disabled || Boolean(downloadingId) || creating} onClick={() => downloadMember(member)}>
                {downloadingId === member.id ? "Extracting…" : "Extract / Download"}
              </button>
            </div>
          );
        })}
        {!visibleMembers.length && <p className="zip-archive-panel__empty">No files match that filter.</p>}
      </div>

      <div className="zip-archive-panel__footer">
        <span>{filteredMembers.length.toLocaleString()} shown · {selected.size.toLocaleString()} selected</span>
        <div>
          {pageCount > 1 && <>
            <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>Next</button>
          </>}
          <button type="button" className="secondary-button" disabled={!selectedMembers.length || creating || !onCreateEntries} onClick={createSelectedEntries}>
            {creating ? `Creating ${progress?.completed || 0} of ${progress?.total || selectedMembers.length}…` : `Create Timeline entries (${selectedMembers.length})`}
          </button>
        </div>
      </div>
      {confirmBulk && <div className="zip-archive-panel__confirm" role="alert">
        <p>This will create {selectedMembers.length.toLocaleString()} separate Timeline entries and upload a copy of each selected file. Continue?</p>
        <button type="button" className="secondary-button" onClick={() => setConfirmBulk(false)}>Cancel</button>
        <button type="button" className="utility-button" onClick={createSelectedEntries}>Confirm batch</button>
      </div>}
      {progress && creating && <p className="zip-archive-panel__progress" role="status">Processed {progress.completed} of {progress.total}; created {progress.createdCount}, failed {progress.failedCount}.</p>}
      {message && <p className="zip-archive-panel__message" role="status">{message}</p>}
      <p className="zip-archive-panel__hint">Files marked unsafe, encrypted, or larger than 100 MB can’t be extracted here. ZIP filenames and document text are indexed without AI; photo contents aren’t visually analyzed.</p>
    </section>
  );
}

function isImageFile(file) {
  if (!file) return false;

  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const url = (file.url || "").toLowerCase();

  if (type.startsWith("image/")) return true;

  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp") ||
    name.endsWith(".svg") ||
    url.includes(".jpg") ||
    url.includes(".jpeg") ||
    url.includes(".png") ||
    url.includes(".gif") ||
    url.includes(".webp") ||
    url.includes(".bmp") ||
    url.includes(".svg")
  );
}

function isPdfFile(file) {
  if (!file) return false;

  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const url = (file.url || "").toLowerCase();

  if (type === "application/pdf") return true;

  return name.endsWith(".pdf") || url.includes(".pdf");
}

export default function EntryModal({
  entry,
  onClose,
  onCopyText,
  onCreateArchiveEntries,
}) {
  if (!entry) return null;

  const file = entry.file || null;
  const fileUrl = file?.url || null;
  const showImage = fileUrl && isImageFile(file);
  const showPdf = fileUrl && isPdfFile(file);
  const showDownload = fileUrl && !showImage && !showPdf;
  const hasArchive = Boolean(entry.fileMetadata?.archive?.members);

  return (
    <div
      onClick={onClose}
      className="modal-scrim"
      role="presentation"
    >
      <article
        onClick={(e) => e.stopPropagation()}
        className="entry-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Preserved memory"
      >
        <div className="entry-modal__header">
          <div>
            <p className="eyebrow">Preserved memory</p>
            <h2 className="entry-modal__date">{entry.date}</h2>
          </div>
          <button className="entry-modal__close" onClick={onClose} aria-label="Close memory">×</button>
        </div>

        <p className="entry-modal__content">{entry.content || entry.file?.name || "Untitled memory"}</p>

        {file && (
          <div className="entry-modal__file">
            <div><strong>Attachment</strong> · {file.name || "Unnamed file"}</div>
            <div>{entry.fileMetadata?.category ? `${entry.fileMetadata.category} · ` : ""}{file.type || "Unknown file type"}</div>
            {entry.fileMetadata?.extractionStatus && (
              <div>
                Search indexing: {entry.fileMetadata.extractionStatus}
                {entry.fileMetadata.characterCount > 0 ? ` · ${entry.fileMetadata.characterCount.toLocaleString()} characters` : ""}
                {entry.fileMetadata.pageCount ? ` · ${entry.fileMetadata.pageCount} pages` : ""}
              </div>
            )}
            {entry.fileMetadata?.keywords?.length > 0 && (
              <div>Suggested keywords: {entry.fileMetadata.keywords.join(" · ")}</div>
            )}
            {entry.fileMetadata?.note && <div>{entry.fileMetadata.note}</div>}
          </div>
        )}

        {hasArchive && <ArchiveContents entry={entry} fileUrl={fileUrl} onCreateEntries={onCreateArchiveEntries} />}

        {entry.extractedText && (
          <details className="entry-modal__extracted-text">
            <summary>{hasArchive ? "View indexed archive filenames and document text" : "View extracted text"}</summary>
            <p>{entry.extractedText.slice(0, 6000)}{entry.extractedText.length > 6000 ? "…" : ""}</p>
          </details>
        )}

        {showImage && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={fileUrl}
              alt={file?.name || "entry image"}
              className="entry-modal__preview"
              onError={(e) => {
                console.error("[EntryModal] image failed to load:", fileUrl);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        {showPdf && (
          <embed
            src={fileUrl}
            type="application/pdf"
            className="entry-modal__pdf"
          />
        )}

        {showDownload && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="secondary-button"
          >
            Open / Download {file?.name || "file"}
          </a>
        )}

        {!fileUrl && file && (
          <div className="notice notice--info">
            This file record exists, but no file URL is available yet.
          </div>
        )}

        <div className="entry-modal__actions">
          <button className="secondary-button" onClick={onCopyText}>Copy text</button>
          <button className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </article>
    </div>
  );
}
