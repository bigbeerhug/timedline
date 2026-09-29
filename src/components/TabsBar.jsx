// src/components/TabsBar.jsx
import TabButton from "./TabButton";

export default function TabsBar({ activeTab, onTab, counts = {} }) {
  return (
    <nav className="tabs-bar" role="tablist" aria-label="Vault sections">
      <TabButton id="timeline" label="Timeline" count={counts.total} active={activeTab === "timeline"} onClick={onTab} title="All entries in the main chronology" />
      <TabButton id="log" label="Idea Stream" count={counts.entries} active={activeTab === "log"} onClick={onTab} title="Capture and browse ideas" />
      <TabButton id="search" label="Search" active={activeTab === "search"} onClick={onTab} title="Find by text, date, or file" />
      <TabButton id="archive" label="Archive" count={counts.days} active={activeTab === "archive"} onClick={onTab} title="Browse everything by date" />
    </nav>
  );
}
