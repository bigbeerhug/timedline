// src/components/TabButton.jsx
export default function TabButton({ id, label, active, onClick, title }) {
  return (
    <button
      onClick={() => onClick(id)}
      title={title}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #ddd",
        background: active ? "#4f46e5" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
