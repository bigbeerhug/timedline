const MAX_EXTRACTED_CHARACTERS = 250_000;
const MAX_FILE_SIZE_FOR_EXTRACTION = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 150;
const MAX_KEYWORDS = 10;
const MAX_ARCHIVE_MEMBERS = 5_000;
const MAX_ARCHIVE_TEXT_MEMBER_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_TEXT_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_ARCHIVE_MEMBER_EXTRACT_BYTES = 100 * 1024 * 1024;

const STOP_WORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves according hereby hereinafter herein hereto thereof thereto therein thereunder whereas whereby wherein party parties agreement contract section subsection foregoing including include includes provided shall may must duly hereby thereof hereto pursuant`.split(/\s+/)
);

const PLAIN_TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "log",
  "html",
  "htm",
  "xml",
]);

function extensionOf(name = "") {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function isZipFile(file) {
  return extensionOf(file?.name) === "zip" || file?.type === "application/zip" || file?.type === "application/x-zip-compressed";
}

function categoryForFile(extension, mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (["csv", "xls", "xlsx", "ods"].includes(extension)) return "spreadsheet";
  if (["pdf", "doc", "docx", "odt", "rtf"].includes(extension)) return "document";
  if (PLAIN_TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) return "text";
  return "file";
}

function normalizedText(value) {
  return String(value || "")
    .replaceAll(String.fromCharCode(0), " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

function makeKeywords({ context = "", filename = "", text = "" }) {
  const counts = new Map();
  const addWords = (value, weight) => {
    const words = String(value || "").toLocaleLowerCase().match(/[\p{L}][\p{L}\p{N}'’-]{2,}/gu) || [];
    for (const raw of words) {
      const word = raw.replace(/[’']/g, "");
      if (STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
      counts.set(word, (counts.get(word) || 0) + weight);
    }
  };

  addWords(text, 1);
  addWords(context, 4);
  addWords(filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), 5);

  return [...counts.entries()]
    .sort(([leftWord, leftScore], [rightWord, rightScore]) => rightScore - leftScore || leftWord.localeCompare(rightWord))
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);
}

async function extractPdfText(file, onProgress) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;

  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages = [];
    let characterCount = 0;
    let reachedCharacterLimit = false;

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str || "").join(" ");
      pages.push(pageText);
      characterCount += pageText.length + 2;
      onProgress?.({ completed: pageNumber, total: pageLimit });
      if (characterCount >= MAX_EXTRACTED_CHARACTERS) {
        reachedCharacterLimit = true;
        break;
      }
    }

    return {
      text: normalizedText(pages.join("\n\n")),
      pageCount: pdf.numPages,
      partial: pdf.numPages > pageLimit || reachedCharacterLimit,
    };
  } finally {
    await loadingTask.destroy();
  }
}

async function extractDocxText(file) {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const rawText = String(result.value || "");
  return {
    text: normalizedText(rawText),
    partial: rawText.length > MAX_EXTRACTED_CHARACTERS,
  };
}

function normalizedArchivePath(value) {
  const path = String(value || "").replaceAll("\\", "/");
  const pieces = path.split("/");
  const unsafe = path.startsWith("/") || /^[a-z]:\//i.test(path) || pieces.some((piece) => piece === "..") || path.includes("\0");
  return { path: pieces.filter((piece) => piece && piece !== ".").join("/"), unsafe };
}

function archiveMimeType(extension) {
  const common = {
    avif: "image/avif", bmp: "image/bmp", csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    gif: "image/gif", heic: "image/heic", html: "text/html", jpeg: "image/jpeg", jpg: "image/jpeg", json: "application/json",
    log: "text/plain", md: "text/markdown", markdown: "text/markdown", mp3: "audio/mpeg", mp4: "video/mp4", pdf: "application/pdf",
    png: "image/png", svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff", txt: "text/plain", wav: "audio/wav",
    webm: "video/webm", webp: "image/webp", xml: "application/xml",
  };
  return common[extension] || "application/octet-stream";
}

function archiveCategory(extension, mimeType) {
  return extension === "zip" ? "archive" : categoryForFile(extension, mimeType);
}

class LimitedBlobWriter {
  constructor(limit, type = "application/octet-stream") {
    this.limit = limit;
    this.type = type;
    this.parts = [];
    this.size = 0;
    this.initialized = false;
    this.writable = new WritableStream({
      write: (chunk) => this.writeUint8Array(chunk),
    });
  }

  async init() {
    this.initialized = true;
  }

  async writeUint8Array(chunk) {
    if (this.size + chunk.byteLength > this.limit) {
      throw new Error("This archive member exceeds the safe extraction limit.");
    }
    this.parts.push(chunk.slice());
    this.size += chunk.byteLength;
  }

  async getData() {
    return new Blob(this.parts, { type: this.type });
  }
}

async function createZipReader(source) {
  const { BlobReader, HttpRangeReader, ZipReader } = await import("@zip.js/zip.js");
  const httpSource = (typeof source === "string" && /^https?:/i.test(source)) || (source instanceof URL && /^https?:$/i.test(source.protocol));
  let blobSource = source;
  if ((typeof source === "string" || source instanceof URL) && !httpSource) {
    const response = await fetch(String(source));
    if (!response.ok) throw new Error("Could not access the saved ZIP file.");
    blobSource = await response.blob();
  }
  const input = httpSource
    ? new HttpRangeReader(source, { forceRangeRequests: true, combineSizeEocd: true })
    : new BlobReader(blobSource);
  return new ZipReader(input, { checkSignature: true });
}

function isIndexableArchiveMember(extension) {
  return PLAIN_TEXT_EXTENSIONS.has(extension) || ["pdf", "docx"].includes(extension);
}

/** Read only archive metadata and bounded document text; media bytes remain in the original ZIP. */
async function inspectZipArchive(file, context = "", onProgress) {
  const reader = await createZipReader(file);

  try {
    const entries = await reader.getEntries();
    const allFiles = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !entry.directory);
    const truncated = allFiles.length > MAX_ARCHIVE_MEMBERS;
    const listedFiles = allFiles.slice(0, MAX_ARCHIVE_MEMBERS);
    const declaredTotalBytes = allFiles.reduce((sum, { entry }) => sum + (Number(entry.uncompressedSize) || 0), 0);
    const members = listedFiles.map(({ entry, index }) => {
      const normalized = normalizedArchivePath(entry.filename);
      const name = normalized.path.split("/").pop() || normalized.path || entry.filename;
      const extension = extensionOf(name);
      const mimeType = archiveMimeType(extension);
      let extractionStatus = "filename-only";
      if (normalized.unsafe || entry.symlink) extractionStatus = "unsafe";
      else if (entry.encrypted) extractionStatus = "encrypted";
      else if (Number(entry.uncompressedSize) > MAX_ARCHIVE_MEMBER_EXTRACT_BYTES) extractionStatus = "too-large";
      else if (isIndexableArchiveMember(extension) && Number(entry.uncompressedSize) > MAX_ARCHIVE_TEXT_MEMBER_BYTES) extractionStatus = "text-limit";

      return {
        id: `${index}:${normalized.path}`,
        index,
        path: normalized.path || entry.filename,
        name,
        extension: extension || null,
        mimeType,
        category: archiveCategory(extension, mimeType),
        sizeBytes: Number(entry.uncompressedSize) || 0,
        compressedSizeBytes: Number(entry.compressedSize) || 0,
        lastModified: entry.lastModDate instanceof Date && !Number.isNaN(entry.lastModDate.valueOf()) ? entry.lastModDate.toISOString() : null,
        extractionStatus,
        unsafe: normalized.unsafe || entry.symlink,
        directory: false,
      };
    });

    const textBudgetEntries = [];
    let textBudget = 0;
    for (const member of members) {
      if (member.extractionStatus !== "filename-only" || !isIndexableArchiveMember(member.extension)) continue;
      if (textBudget + member.sizeBytes > MAX_ARCHIVE_TEXT_TOTAL_BYTES) {
        member.extractionStatus = "archive-text-limit";
        continue;
      }
      textBudget += member.sizeBytes;
      textBudgetEntries.push(member);
    }

    const indexedText = [];
    let completed = 0;
    for (const member of textBudgetEntries) {
      const entry = entries[member.index];
      try {
        const blob = await entry.getData(new LimitedBlobWriter(MAX_ARCHIVE_TEXT_MEMBER_BYTES, member.mimeType), {
          checkSignature: true,
          checkLocalDirectory: true,
        });
        const memberFile = new File([blob], member.name, { type: member.mimeType, lastModified: Date.parse(member.lastModified) || Date.now() });
        const index = await extractFileIndex(memberFile, `${context} ${member.path}`);
        member.extractionStatus = index.fileMetadata.extractionStatus;
        if (index.extractedText) indexedText.push(`File: ${member.path}\n${index.extractedText}`);
      } catch (error) {
        member.extractionStatus = /password|encrypt/i.test(error?.message || "") ? "encrypted" : "extraction-error";
      }
      completed += 1;
      onProgress?.({ kind: "archive", completed, total: textBudgetEntries.length, label: member.name });
    }

    const inventoryText = members.map((member) => `File: ${member.path}`).join("\n");
    const extractedText = normalizedText([inventoryText, ...indexedText].filter(Boolean).join("\n\n"));
    const categories = members.reduce((counts, member) => {
      counts[member.category] = (counts[member.category] || 0) + 1;
      return counts;
    }, {});
    const archive = {
      version: 1,
      memberCount: allFiles.length,
      listedCount: members.length,
      directoryCount: entries.filter((entry) => entry.directory).length,
      totalUncompressedBytes: declaredTotalBytes,
      categories,
      members,
      truncated,
      note: truncated ? `Showing the first ${MAX_ARCHIVE_MEMBERS.toLocaleString()} files; the archive contains more.` : null,
    };
    const keywords = makeKeywords({ context, filename: file?.name, text: extractedText });
    const fileMetadata = {
      extension: "zip",
      mimeType: file?.type || "application/zip",
      category: "archive",
      sizeBytes: Number(file?.size) || 0,
      extractedAt: new Date().toISOString(),
      extractionStatus: members.length ? "indexed" : "empty",
      characterCount: extractedText.length,
      keywords,
      archive,
    };
    if (truncated) fileMetadata.note = archive.note;
    if (textBudgetEntries.length < members.filter((member) => isIndexableArchiveMember(member.extension)).length) {
      fileMetadata.note = [fileMetadata.note, "Some contained documents were not text-indexed because of safe extraction limits."].filter(Boolean).join(" ");
    }

    return { extractedText, fileMetadata };
  } finally {
    await reader.close();
  }
}

export async function extractArchiveMember(archiveBlob, member) {
  if (!member || member.unsafe) throw new Error("This archive member cannot be extracted safely.");
  if (member.sizeBytes > MAX_ARCHIVE_MEMBER_EXTRACT_BYTES) throw new Error("This file exceeds the 100 MB per-file extraction limit.");

  const reader = await createZipReader(archiveBlob);
  try {
    const entries = await reader.getEntries();
    const entry = entries[member.index];
    if (!entry || entry.directory || normalizedArchivePath(entry.filename).path !== member.path || entry.symlink || entry.encrypted) {
      throw new Error("This member is unavailable or unsafe to extract.");
    }
    return await entry.getData(new LimitedBlobWriter(MAX_ARCHIVE_MEMBER_EXTRACT_BYTES, member.mimeType), {
      checkSignature: true,
      checkLocalDirectory: true,
    });
  } finally {
    await reader.close();
  }
}

/** Extract searchable text locally in the browser; this never calls an AI or uploads the file. */
export async function extractFileIndex(file, context = "", onProgress) {
  const extension = extensionOf(file?.name);
  const mimeType = file?.type || "application/octet-stream";
  if (isZipFile(file)) {
    try {
      return await inspectZipArchive(file, context, onProgress);
    } catch (error) {
      const note = `ZIP archive could not be processed: ${error?.message || "unknown archive error"}. The original file is still saved.`;
      return {
        extractedText: "",
        fileMetadata: {
          extension: "zip",
          mimeType,
          category: "archive",
          sizeBytes: Number(file?.size) || 0,
          extractedAt: new Date().toISOString(),
          extractionStatus: "extraction-error",
          characterCount: 0,
          keywords: makeKeywords({ context, filename: file?.name }),
          archive: { version: 1, memberCount: 0, listedCount: 0, directoryCount: 0, totalUncompressedBytes: 0, categories: {}, members: [], note },
          note,
        },
      };
    }
  }
  let text = "";
  let status = "filename-only";
  let pageCount = null;
  let partial = false;

  try {
    if ((Number(file?.size) || 0) > MAX_FILE_SIZE_FOR_EXTRACTION) {
      status = "too-large";
    } else if (PLAIN_TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) {
      const rawText = await file.text();
      partial = rawText.length > MAX_EXTRACTED_CHARACTERS;
      text = normalizedText(rawText);
      status = text ? "indexed" : "empty";
    } else if (extension === "pdf" || mimeType === "application/pdf") {
      const result = await extractPdfText(file, onProgress);
      text = result.text;
      pageCount = result.pageCount;
      partial = result.partial;
      status = text ? (partial ? "partial" : "indexed") : "no-text-layer";
    } else if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await extractDocxText(file);
      text = result.text;
      partial = result.partial;
      status = text ? "indexed" : "empty";
    } else {
      status = "unsupported";
    }
  } catch (error) {
    console.warn("[file-index] text extraction failed:", error?.message || error);
    status = "extraction-error";
    text = "";
  }

  const extractedText = normalizedText(text);
  const keywords = makeKeywords({ context, filename: file?.name, text: extractedText });
  const metadata = {
    extension: extension || null,
    mimeType,
    category: categoryForFile(extension, mimeType),
    sizeBytes: Number(file?.size) || 0,
    extractedAt: new Date().toISOString(),
    extractionStatus: status,
    characterCount: extractedText.length,
    keywords,
  };

  if (pageCount != null) metadata.pageCount = pageCount;
  if (partial) {
    metadata.note = pageCount > MAX_PDF_PAGES
      ? `Indexed the first ${MAX_PDF_PAGES} pages.`
      : `Indexed text is limited to ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} characters.`;
  }
  if (status === "no-text-layer") metadata.note = "No selectable PDF text was found; filename and your description remain searchable.";
  if (status === "unsupported") metadata.note = "This file type is saved and searchable by filename and your description.";
  if (status === "too-large") metadata.note = "This file is over the 25 MB text-extraction limit; filename and your description remain searchable.";
  if (status === "extraction-error") metadata.note = "Text extraction failed; filename and your description remain searchable.";

  return { extractedText, fileMetadata: metadata };
}

export { makeKeywords, normalizedText };
