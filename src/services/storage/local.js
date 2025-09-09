// src/services/storage/local.js
const LS_ENTRIES = "timedline.entries.v1";
const LS_ACTIVITY = "timedline.activity.v1";

function readJSON(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
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
      const cleaned = {
        ts: entry.ts,
        date: entry.date,
        content: entry.content,
        file: entry.file ? { name: entry.file.name, type: entry.file.type, url: entry.file.url || null } : null,
      };
      writeJSON(LS_ENTRIES, [cleaned, ...list]);
    },

    async listEntries() {
      return readJSON(LS_ENTRIES, []);
    },

    async deleteEntry(ts /*, filePath*/) {
      const list = readJSON(LS_ENTRIES, []);
      writeJSON(LS_ENTRIES, list.filter(x => x.ts !== ts));
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
