// src/services/storage/local.js
const LS_ENTRIES = "timedline.entries.v1";
const LS_ACTIVITY = "timedline.activity.v1";

function readJSON(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {
    // Local mode remains usable in-memory when storage is unavailable.
  }
}

export default function localDriver() {
  return {
    async getUser() { return { id: "local" }; },

    async uploadFile(file) {
      const url = URL.createObjectURL(file);
      return { path: null, name: file.name, type: file.type || "application/octet-stream", url };
    },

    async createEntry(entry) {
      const list = readJSON(LS_ENTRIES, []);
      const nextId = list.reduce((max, item) => {
        const id = Number(item?.id);
        return Number.isFinite(id) ? Math.max(max, id) : max;
      }, 0) + 1;
      const cleaned = {
        id: nextId,
        ts: entry.ts,
        date: entry.date,
        content: entry.content,
        file: entry.file ? { name: entry.file.name, type: entry.file.type, url: entry.file.url || null } : null,
      };
      writeJSON(LS_ENTRIES, [cleaned, ...list]);
      return cleaned;
    },

    async listEntries() {
      return readJSON(LS_ENTRIES, []);
    },

    async deleteEntry(id /*, filePath*/) {
      const list = readJSON(LS_ENTRIES, []);
      writeJSON(
        LS_ENTRIES,
        list.filter((item) =>
          item.id != null ? item.id !== id : item.ts !== id
        )
      );
    },

    async logActivity(item) {
      const list = readJSON(LS_ACTIVITY, []);
      writeJSON(LS_ACTIVITY, [item, ...list]);
    },

    async listActivity() {
      return readJSON(LS_ACTIVITY, []);
    },
  };
}
