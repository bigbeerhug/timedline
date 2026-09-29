function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase();
}

function searchableText(entry) {
  return [
    entry?.date,
    entry?.type,
    entry?.content,
    entry?.file?.name,
    entry?.file?.type,
    entry?.fileMetadata?.category,
    entry?.extractedText,
    ...(Array.isArray(entry?.fileMetadata?.keywords) ? entry.fileMetadata.keywords : []),
  ].map(normalized).join(" ");
}

export function scoreEntry(entry, query) {
  const normalizedQuery = normalized(query).trim();
  if (!normalizedQuery) return 1;

  const terms = normalizedQuery.match(/[\p{L}\p{N}]+/gu) || [];
  if (!terms.length) return 0;

  const fields = [
    [entry?.date, 12],
    [entry?.content, 10],
    [entry?.file?.name, 12],
    [entry?.fileMetadata?.category, 8],
    [entry?.fileMetadata?.keywords?.join(" "), 9],
    [entry?.type, 3],
    [entry?.extractedText, 1],
  ].map(([value, weight]) => [normalized(value), weight]);

  const foundAllTerms = terms.every((term) => fields.some(([value]) => value.includes(term)));
  if (!foundAllTerms) return 0;

  let score = normalizedQuery.length > 2 && searchableText(entry).includes(normalizedQuery) ? 20 : 0;
  for (const term of terms) {
    for (const [value, weight] of fields) {
      if (value.includes(term)) score += weight;
    }
  }
  return score;
}

export function searchEntriesLocally(entries, query) {
  const normalizedQuery = normalized(query).trim();
  if (!normalizedQuery) return entries;

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || (Number(right.entry.ts) || 0) - (Number(left.entry.ts) || 0))
    .map(({ entry }) => entry);
}

export function makeSearchExcerpt(entry, query, maxLength = 220) {
  const body = String(entry?.extractedText || "").replace(/\s+/g, " ").trim();
  if (!body) return "";

  const terms = normalized(query).match(/[\p{L}\p{N}]+/gu) || [];
  const lowerBody = normalized(body);
  const firstMatch = terms.map((term) => lowerBody.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const start = Math.max(0, (firstMatch ?? 0) - Math.floor(maxLength / 3));
  const excerpt = body.slice(start, start + maxLength).trim();
  return `${start > 0 ? "…" : ""}${excerpt}${start + maxLength < body.length ? "…" : ""}`;
}

export { searchableText };
