// src/components/Layout.jsx
export default function Layout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24 }}>
      {children}
    </div>
  );
}
