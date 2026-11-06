import type { LibraryState, Notebook } from "./model";

// Fingerprint of the original bundled fixture, excluding generated IDs/position.
// Keep edited, renamed, annotated, or merely same-titled user documents intact.
const legacyDemoHash =
  "5dfd4ef92c1429ca9d4090e7fa9ea189fe1fb25e98dc5b23bdf25e92cc63b243";
export async function isUnmodifiedBundledDemo(doc: Notebook): Promise<boolean> {
  if (
    doc.title !== "企業網路資源規劃" ||
    doc.pdfAssetId ||
    doc.annotations?.length ||
    doc.warnings.length ||
    doc.blocks.length !== 128
  )
    return false;
  if (doc.blocks.some((b) => b.image || b.pdf)) return false;
  const data = JSON.stringify(
    doc.blocks.map((b) => [
      b.kind,
      b.html,
      b.text,
      b.level ?? null,
      b.headerOnly ?? false,
    ]),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return (
    [...new Uint8Array(digest)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("") === legacyDemoHash
  );
}
export async function withoutBundledDemo(
  state: LibraryState,
): Promise<{ state: LibraryState; removedIds: string[] }> {
  const removedIds: string[] = [];
  for (const book of state.books)
    if (await isUnmodifiedBundledDemo(book.document))
      removedIds.push(book.document.id);
  if (!removedIds.length) return { state, removedIds };
  const books = state.books.filter((b) => !removedIds.includes(b.document.id));
  const activeId = books.some(
    (b) => b.document.id === state.activeId && !b.deletedAt,
  )
    ? state.activeId
    : books.find((b) => !b.deletedAt)?.document.id;
  return { state: { ...state, books, activeId }, removedIds };
}
