// src/components/TabButton.jsx
export default function TabButton({ id, label, count, active, onClick, title }) {
  return (
    <button
      onClick={() => onClick(id)}
      title={title}
      className="tab-button"
      aria-selected={active}
      role="tab"
    >
      {label}
      {count != null && <span className="tab-button__count">{count}</span>}
    </button>
  );
}
