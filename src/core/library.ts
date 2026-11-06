import type { Anchor, BookRecord, Notebook } from "./model";
export function createRecord(document: Notebook, anchor?: Anchor): BookRecord {
  const now = Date.now();
  return {
    document,
    anchor: anchor || { blockId: document.blocks[0]!.id, offset: 0 },
    createdAt: now,
    updatedAt: now,
    progress: 0,
  };
}
export function cloneRecord(book: BookRecord): BookRecord {
  const copy = structuredClone(book);
  const id = crypto.randomUUID();
  const mapping = new Map(
    copy.document.blocks.map((b, i) => [b.id, `${id}-${i}`]),
  );
  copy.document.id = id;
  copy.document.title = `${copy.document.title}（副本）`.slice(0, 120);
  for (const block of copy.document.blocks) {
    block.id = mapping.get(block.id)!;
    if (block.tableId) block.tableId = `${id}-${block.tableId}`;
  }
  copy.anchor.blockId =
    mapping.get(copy.anchor.blockId) || copy.document.blocks[0]!.id;
  copy.document.annotations = copy.document.annotations?.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    targets: a.targets.map((t) => ({
      ...t,
      blockId: mapping.get(t.blockId) || t.blockId,
    })),
  }));
  copy.createdAt = copy.updatedAt = Date.now();
  delete copy.deletedAt;
  return copy;
}
export function appendNotebook(
  original: Notebook,
  addition: Notebook,
): Notebook {
  return {
    ...original,
    blocks: [...original.blocks, ...addition.blocks],
    warnings: [...new Set([...original.warnings, ...addition.warnings])],
  };
}
export function progressForAnchor(doc: Notebook, anchor?: Anchor): number {
  let total = 0;
  let position = 0;
  let found = false;
  for (const block of doc.blocks) {
    if (block.id === anchor?.blockId) {
      position =
        total + Math.min(block.text.length, Math.max(0, anchor.offset));
      found = true;
    }
    total += block.text.length;
  }
  return found && total ? position / total : 0;
}
