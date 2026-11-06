import type { Annotation, AnnotationTarget, Notebook } from './model';

export const categories = {
  important: '重點', definition: '定義', question: '疑問', todo: '待辦',
} as const;

/** Text offsets use UTF-16, consistently with DOM Range, search and pagination. */
export function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('[data-repeat],[data-decoration]')) nodes.push(node);
  }
  return nodes;
}

export function selectionTargets(host: HTMLElement, doc: Notebook): AnnotationTarget[] {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return [];
  const range = selection.getRangeAt(0);
  if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return [];
  const targets: AnnotationTarget[] = [];
  for (const fragment of host.querySelectorAll<HTMLElement>('.book-pages > .paper .fragment')) {
    const block = doc.blocks.find(b => b.id === fragment.dataset.block);
    if (!block || !range.intersectsNode(fragment)) continue;
    let offset = Number(fragment.dataset.start) || 0;
    let start = Infinity, end = -1;
    for (const node of textNodes(fragment)) {
      const length = node.length;
      if (range.intersectsNode(node)) {
        const a = node === range.startContainer ? range.startOffset : 0;
        const b = node === range.endContainer ? range.endOffset : length;
        if (b > a) { start = Math.min(start, offset + a); end = Math.max(end, offset + b); }
      }
      offset += length;
    }
    if (end > start && start >= 0 && end <= block.text.length) {
      const previous = targets.at(-1);
      if (previous?.blockId === block.id && previous.end === start) {
        previous.end = end; previous.exact = block.text.slice(previous.start, end);
        previous.suffix = block.text.slice(end, end + 32);
      } else targets.push({ blockId: block.id, start, end,
        exact: block.text.slice(start, end), prefix: block.text.slice(Math.max(0, start - 32), start),
        suffix: block.text.slice(end, end + 32) });
    }
  }
  return targets.filter(t => t.exact.trim());
}

/** Re-link quotes after edits; ambiguous/missing text stays visible as an unlinked card. */
export function reanchorAnnotations(annotations: Annotation[], doc: Notebook): Annotation[] {
  return annotations.map(annotation => {
    let linked = true;
    const targets = annotation.targets.map(target => {
      const original = doc.blocks.find(b => b.id === target.blockId);
      if (original?.text.slice(target.start, target.end) === target.exact) return target;
      const matches: AnnotationTarget[] = [];
      for (const block of original ? [original] : doc.blocks) {
        let at = block.text.indexOf(target.exact);
        while (at >= 0) {
          matches.push({ ...target, blockId: block.id, start: at, end: at + target.exact.length });
          at = block.text.indexOf(target.exact, at + Math.max(1, target.exact.length));
        }
      }
      const context = matches.filter(t => {
        const text = doc.blocks.find(b => b.id === t.blockId)!.text;
        return (!target.prefix || text.slice(Math.max(0, t.start-target.prefix.length), t.start) === target.prefix)
          && (!target.suffix || text.slice(t.end, t.end+target.suffix.length) === target.suffix);
      });
      const match = context.length === 1 ? context[0] : matches.length === 1 ? matches[0] : undefined;
      if (!match) { linked = false; return target; }
      return match;
    });
    return { ...annotation, targets, status: linked ? 'linked' : 'unlinked' };
  });
}

export function validateAnnotations(value: unknown, doc: Notebook): Annotation[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 10000) throw new Error('單本重點超過 10,000 筆，請拆成多本筆記。');
  const result: Annotation[] = [];
  for (const raw of value) {
    if (!raw || !Object.hasOwn(categories, raw.category) || !Array.isArray(raw.targets) || raw.targets.length > 200) continue;
    const targets = raw.targets.filter((t: any) => typeof t.blockId === 'string' && Number.isInteger(t.start)
      && Number.isInteger(t.end) && t.start >= 0 && t.end > t.start && typeof t.exact === 'string'
      && t.exact.length <= 100000).map((t: any) => ({ blockId:t.blockId, start:t.start, end:t.end, exact:t.exact,
        prefix: typeof t.prefix === 'string' ? t.prefix.slice(-32) : '', suffix: typeof t.suffix === 'string' ? t.suffix.slice(0,32) : '' }));
    if (!targets.length) continue;
    result.push({ id:crypto.randomUUID(), targets, category:raw.category,
      tags:Array.isArray(raw.tags) ? raw.tags.filter((t:any)=>typeof t==='string').slice(0,12).map((t:string)=>t.slice(0,40)) : [],
      comment: typeof raw.comment==='string' ? raw.comment.slice(0,4000) : '',
      createdAt:Number(raw.createdAt)||Date.now(), updatedAt:Number(raw.updatedAt)||Date.now(), status:'linked' });
  }
  return reanchorAnnotations(result, doc);
}

export function markAnnotations(html: string, annotations: Annotation[]): string {
  if (!annotations.length) return html;
  const root = document.createElement('div'); root.innerHTML = html;
  decorateAnnotations(root, annotations);
  return root.innerHTML;
}

/** Also decorates live PDF text layers without altering dimensions. */
export function decorateAnnotations(root: HTMLElement, annotations: Annotation[]) {
  for (const fragment of root.querySelectorAll<HTMLElement>('.fragment')) {
    const ranges = annotations.filter(a=>a.status==='linked').flatMap(a=>a.targets.filter(t=>t.blockId===fragment.dataset.block)
      .map(t=>({ ...t, annotation:a })));
    if (!ranges.length) continue;
    let cursor = Number(fragment.dataset.start)||0;
    for (const node of textNodes(fragment)) {
      const base=cursor, value=node.data; cursor+=value.length;
      const overlap=ranges.filter(t=>t.start<cursor&&t.end>base);
      if (!overlap.length) continue;
      const cuts=[...new Set([0,value.length,...overlap.flatMap(t=>[Math.max(0,t.start-base),Math.min(value.length,t.end-base)])])].sort((a,b)=>a-b);
      const replacement=document.createDocumentFragment();
      for(let i=0;i<cuts.length-1;i++) {
        const a=cuts[i]!,b=cuts[i+1]!, matching=overlap.filter(t=>t.start<base+b&&t.end>base+a);
        const text=value.slice(a,b);
        if(!matching.length) replacement.append(text);
        else { const mark=document.createElement('mark'); mark.className=`annotation-mark annotation-${matching[0]!.annotation.category}`;
          mark.dataset.annotationId=matching[0]!.annotation.id; mark.title=categories[matching[0]!.annotation.category];
          mark.textContent=text; replacement.append(mark); }
      }
      node.replaceWith(replacement);
    }
  }
}
