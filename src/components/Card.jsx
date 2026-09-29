// src/components/Card.jsx
export default function Card({ children, className = "", ...props }) {
  return <section className={`section-card ${className}`.trim()} {...props}>{children}</section>;
}
