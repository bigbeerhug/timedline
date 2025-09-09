// src/components/TabsBar.jsx
import TabButton from "./TabButton";

export default function TabsBar({ activeTab, onTab }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <TabButton
        id="log"
        label="✍️ Life Log"
        active={activeTab === "log"}
        onClick={onTab}
        title="Write or drop a file"
      />
      <TabButton
        id="search"
        label="🔍 Search"
        active={activeTab === "search"}
        onClick={onTab}
        title="Find by text/date/filename"
      />
      <TabButton
        id="archive"
        label="📂 Archive"
        active={activeTab === "archive"}
        onClick={onTab}
        title="Browse everything"
      />
    </div>
  );
}
