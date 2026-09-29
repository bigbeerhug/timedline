import assert from "node:assert/strict";
import test from "node:test";
import { extractFileIndex } from "./fileIndexing.js";
import { searchEntriesLocally } from "./search.js";

test("plain text file extraction saves searchable text and deterministic keywords", async () => {
  const file = {
    name: "Hemp-Everlasting-Rescission.md",
    type: "text/markdown",
    size: 58,
    text: async () => "Hemp Everlasting rescission draft prepared by counsel.",
  };

  const result = await extractFileIndex(file, "Lawyer draft agreement");

  assert.equal(result.extractedText, "Hemp Everlasting rescission draft prepared by counsel.");
  assert.equal(result.fileMetadata.extractionStatus, "indexed");
  assert.ok(result.fileMetadata.keywords.includes("rescission"));
  assert.ok(result.fileMetadata.keywords.includes("hemp"));
});

test("unsupported attachments stay savable and receive searchable filename metadata", async () => {
  const result = await extractFileIndex({
    name: "lease-photo.png",
    type: "image/png",
    size: 250,
  }, "Signed apartment lease");

  assert.equal(result.extractedText, "");
  assert.equal(result.fileMetadata.extractionStatus, "unsupported");
  assert.equal(result.fileMetadata.category, "image");
  assert.ok(result.fileMetadata.keywords.includes("lease"));
});

test("local search finds extracted body text and ranks context above body-only matches", () => {
  const entries = [
    { id: 1, ts: 1, date: "2026-09-29", content: "", extractedText: "The rescission agreement was signed." },
    { id: 2, ts: 2, date: "2026-09-29", content: "Hemp Everlasting rescission draft", extractedText: "" },
  ];

  const matches = searchEntriesLocally(entries, "Hemp Everlasting rescission");
  assert.deepEqual(matches.map((entry) => entry.id), [2]);
  assert.deepEqual(searchEntriesLocally(entries, "agreement" ).map((entry) => entry.id), [1]);
});
