// src/lib/icons.js
export const getIcon = (entry) => {
  const name = (entry?.file?.name || entry?.content || "").toLowerCase();
  const type = (entry?.file?.type || "").toLowerCase();
  if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/.test(name) || /photo|image/.test(name)) return "📷";
  if (/\.(pdf|doc|docx|txt|ppt|pptx|xls|xlsx)$/.test(name) || /contract|agreement|document/.test(name)) return "📄";
  return "📝";
};
