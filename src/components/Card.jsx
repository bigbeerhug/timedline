// src/components/Card.jsx
export default function Card({ children }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        marginBottom: 16,
      }}
    >
      {children}
    </section>
  );
}
