import test from "node:test";
import assert from "node:assert/strict";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { extractArchiveMember, extractFileIndex } from "./fileIndexing.js";

async function makeArchive(files) {
  const output = new BlobWriter("application/zip");
  const writer = new ZipWriter(output);
  for (const [path, content] of files) {
    await writer.add(path, new TextReader(content));
  }
  await writer.close();
  return output.getData();
}

test("ZIP indexing lists all file paths and extracts supported text for search", async () => {
  const archive = await makeArchive([
    ["photos/session-01.jpg", "not really a photo"],
    ["legal/Hemp_Everlasting_rescission.txt", "Rescission agreement signed by Paul."],
  ]);
  const file = new File([archive], "session.zip", { type: "application/zip" });
  const result = await extractFileIndex(file, "photo session");

  assert.equal(result.fileMetadata.category, "archive");
  assert.equal(result.fileMetadata.archive.memberCount, 2);
  assert.equal(result.fileMetadata.archive.categories.image, 1);
  assert.ok(result.extractedText.includes("photos/session-01.jpg"));
  assert.ok(result.extractedText.includes("legal/Hemp_Everlasting_rescission.txt"));
  assert.ok(result.extractedText.includes("Rescission agreement signed by Paul."));
});

test("a selected ZIP member can be extracted without extracting the full archive", async () => {
  const archive = await makeArchive([
    ["photos/puppy.jpg", "Puppy image bytes for the test."],
    ["notes/capture.txt", "Searchable note."],
  ]);
  const file = new File([archive], "photos.zip", { type: "application/zip" });
  const index = await extractFileIndex(file);
  const member = index.fileMetadata.archive.members.find((item) => item.path === "photos/puppy.jpg");
  const extracted = await extractArchiveMember(archive, member);

  assert.equal(await extracted.text(), "Puppy image bytes for the test.");
  assert.equal(extracted.type, "image/jpeg");
});

test("malformed ZIP files preserve a searchable error instead of throwing", async () => {
  const file = new File([new Uint8Array([1, 2, 3, 4])], "broken.zip", { type: "application/zip" });
  const result = await extractFileIndex(file);

  assert.equal(result.fileMetadata.category, "archive");
  assert.equal(result.fileMetadata.extractionStatus, "extraction-error");
  assert.match(result.fileMetadata.note, /zip|archive/i);
});

test("archives containing unsafe paths are rejected for indexing while preserving the original", async () => {
  const archive = await makeArchive([["../outside.txt", "keep this out of the archive root"]]);
  const file = new File([archive], "unsafe.zip", { type: "application/zip" });
  const result = await extractFileIndex(file);

  assert.equal(result.fileMetadata.extractionStatus, "extraction-error");
  assert.match(result.fileMetadata.note, /unsafe/i);
  assert.equal(file.size, archive.size);
});
