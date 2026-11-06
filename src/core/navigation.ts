import type { Anchor, PaperPage } from "./model";
export function pageForAnchor(
  pages: PaperPage[],
  anchor: Anchor | undefined,
): number {
  if (!anchor) return 0;
  for (const page of pages)
    for (const f of page.fragments)
      if (
        f.blockId === anchor.blockId &&
        anchor.offset >= f.start &&
        anchor.offset < f.end
      )
        return page.index;
  const last = pages.findLast((p) =>
    p.fragments.some((f) => f.blockId === anchor.blockId),
  );
  return last?.index ?? 0;
}
export function spreadForPage(index: number, single: boolean): number {
  return single ? index : Math.floor(index / 2) * 2;
}
export function anchorForPage(
  pages: PaperPage[],
  index: number,
): Anchor | undefined {
  const f = pages[index]?.fragments[0];
  return f ? { blockId: f.blockId, offset: f.start } : undefined;
}
export function pageNumbers(
  total: number,
  active: number,
): (number | string)[] {
  const wanted = new Set([1, total, active - 1, active, active + 1]);
  const ordered = [...wanted]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const result: (number | string)[] = [];
  ordered.forEach((n, i) => {
    if (i && n - ordered[i - 1]! > 1) result.push(`gap-${n}`);
    result.push(n);
  });
  return result;
}
