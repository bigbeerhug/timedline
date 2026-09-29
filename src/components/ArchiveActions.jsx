// src/components/ArchiveActions.jsx

export default function ArchiveActions({
  onExportJSON, // () => void
  onExportCSV,  // () => void
}) {
  return (
    <div className="archive-actions">
      <button className="secondary-button" onClick={onExportJSON}>Export JSON</button>
      <button className="secondary-button" onClick={onExportCSV}>Export CSV</button>
    </div>
  );
}
