// src/components/EntryModal.jsx
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
}) {
  if (!entry) return null;

  const file = entry.file || null;
  const fileUrl = file?.url || null;
  const showImage = fileUrl && isImageFile(file);
  const showPdf = fileUrl && isPdfFile(file);
  const showDownload = fileUrl && !showImage && !showPdf;

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

        {entry.extractedText && (
          <details className="entry-modal__extracted-text">
            <summary>View extracted text</summary>
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
