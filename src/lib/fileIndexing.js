const MAX_EXTRACTED_CHARACTERS = 250_000;
const MAX_FILE_SIZE_FOR_EXTRACTION = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 150;
const MAX_KEYWORDS = 10;

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

/** Extract searchable text locally in the browser; this never calls an AI or uploads the file. */
export async function extractFileIndex(file, context = "", onProgress) {
  const extension = extensionOf(file?.name);
  const mimeType = file?.type || "application/octet-stream";
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
