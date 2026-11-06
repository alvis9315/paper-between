import type { Block, Fragment, Notebook, PageSize, PaperPage } from "./model";
import { sliceHtml } from "./normalize";

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export function fragmentHtml(
  block: Block,
  start: number,
  end: number,
  repeat: boolean,
): string {
  let html = sliceHtml(block.html, start, end);
  if (block.image) {
    const root = document.createElement("div");
    root.innerHTML = html;
    const figure = root.querySelector("figure")!;
    figure.className = `image-note layout-${block.image.layout}${start ? " figure-continuation" : ""}`;
    if (!start) {
      const frame = document.createElement("div");
      frame.className = "note-image-frame";
      frame.dataset.decoration = "true";
      frame.style.setProperty(
        "--image-ratio",
        `${block.image.width}/${block.image.height}`,
      );
      const img = document.createElement("img");
      img.dataset.mediaId = block.image.mediaId;
      img.alt = block.image.alt;
      img.width = block.image.width;
      img.height = block.image.height;
      img.loading = "lazy";
      img.decoding = "async";
      frame.append(img);
      figure.prepend(frame);
    }
    figure
      .querySelector<HTMLElement>("[data-figure-body]")
      ?.classList.add("figure-body");
    html = root.innerHTML;
  }
  if (repeat && block.header && !block.headerOnly)
    html = html.replace(
      "<tbody>",
      `<thead data-repeat="true">${block.header}</thead><tbody>`,
    );
  return `<div class="fragment${start ? " continuation" : ""}" data-block="${block.id}" data-start="${start}" data-end="${end}">${html}</div>`;
}

export async function paginate(
  doc: Notebook,
  size: PageSize,
  signal: AbortSignal,
  progress: (n: number) => void = () => {},
): Promise<PaperPage[]> {
  await document.fonts.ready;
  const abort = () => {
    if (signal.aborted) throw new DOMException("排版已取消", "AbortError");
  };
  abort();
  if (doc.pdfAssetId) {
    progress(100);
    return doc.blocks.map((b, index) => ({
      index,
      fragments: [
        {
          blockId: b.id,
          start: 0,
          end: b.text.length,
          html: "",
          repeatedHeader: false,
          pdf: b.pdf,
        },
      ],
    }));
  }
  const host = document.createElement("div");
  host.className = "measurement-host";
  host.setAttribute("aria-hidden", "true");
  host.style.setProperty("--page-width", `${size.width}px`);
  host.style.setProperty("--page-height", `${size.height}px`);
  if (size.mobile) host.classList.add("single");
  host.innerHTML = '<div class="paper"><div class="page-content"></div></div>';
  document.body.append(host);
  const measure = host.querySelector(".page-content") as HTMLElement;
  const capacity = measure.clientHeight;
  const pages: PaperPage[] = [];
  let current: Fragment[] = [];
  let previousTable: string | undefined;
  const oversizedHeaders = new Set<string>();
  for (const block of doc.blocks) {
    if (!block.headerOnly || !block.tableId) continue;
    measure.innerHTML = fragmentHtml(block, 0, block.text.length, false);
    if (
      measure.firstElementChild!.getBoundingClientRect().height >
      capacity * 0.35
    )
      oversizedHeaders.add(block.tableId);
  }
  measure.replaceChildren();
  const canRepeat = (block: Block) =>
    !!block.tableId &&
    !block.headerOnly &&
    !oversizedHeaders.has(block.tableId);
  const shouldRepeat = (block: Block) =>
    canRepeat(block) && previousTable !== block.tableId;
  function flush() {
    if (current.length) {
      pages.push({ index: pages.length, fragments: current });
      current = [];
      measure.replaceChildren();
      previousTable = undefined;
    }
  }
  function candidate(
    block: Block,
    start: number,
    end: number,
    repeat: boolean,
  ) {
    const html = fragmentHtml(block, start, end, repeat);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const el = wrapper.firstElementChild as HTMLElement;
    measure.append(el);
    const fit =
      el.getBoundingClientRect().bottom - measure.getBoundingClientRect().top <=
        capacity + 0.25 && el.scrollWidth <= measure.clientWidth + 1;
    el.remove();
    return { fit, html };
  }
  function commit(
    block: Block,
    start: number,
    end: number,
    html: string,
    repeatedHeader: boolean,
  ) {
    measure.insertAdjacentHTML("beforeend", html);
    current.push({ blockId: block.id, start, end, html, repeatedHeader });
    previousTable = block.tableId;
  }
  try {
    for (let i = 0; i < doc.blocks.length; i++) {
      abort();
      const block = doc.blocks[i]!;
      const repeat = shouldRepeat(block);
      const whole = candidate(block, 0, block.text.length, repeat);
      if (whole.fit) {
        if (
          (block.kind === "heading" || block.headerOnly) &&
          current.length &&
          doc.blocks[i + 1]
        ) {
          const next = doc.blocks[i + 1]!;
          measure.insertAdjacentHTML("beforeend", whole.html);
          const together = candidate(next, 0, next.text.length, false).fit;
          measure.lastElementChild?.remove();
          if (!together) flush();
        }
        const html = fragmentHtml(
          block,
          0,
          block.text.length,
          shouldRepeat(block),
        );
        commit(block, 0, block.text.length, html, repeat);
      } else {
        const previous = measure.innerHTML;
        measure.replaceChildren();
        const fitsEmpty = candidate(
          block,
          0,
          block.text.length,
          canRepeat(block),
        ).fit;
        measure.innerHTML = previous;
        const previousBlock = doc.blocks[i - 1];
        const followsHeading =
          previousBlock &&
          (previousBlock.kind === "heading" || previousBlock.headerOnly) &&
          current.at(-1)?.blockId === previousBlock.id;
        if (fitsEmpty && !followsHeading) {
          flush();
          const html = fragmentHtml(
            block,
            0,
            block.text.length,
            shouldRepeat(block),
          );
          commit(block, 0, block.text.length, html, shouldRepeat(block));
        } else {
          let start = 0;
          const offsets = [0];
          for (const segment of new Intl.Segmenter("zh-Hant", {
            granularity: "grapheme",
          }).segment(block.text))
            offsets.push(segment.index + segment.segment.length);
          let consumed = 0;
          while (start < block.text.length) {
            abort();
            const repeatHere = shouldRepeat(block);
            let low = consumed + 1;
            let high = offsets.length - 1;
            let best = consumed;
            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              if (candidate(block, start, offsets[mid]!, repeatHere).fit) {
                best = mid;
                low = mid + 1;
              } else high = mid - 1;
            }
            if (best === consumed) {
              if (current.length) {
                flush();
                continue;
              }
              throw new Error(
                "這份文件有無法容納的表格結構。請簡化合併儲存格或縮短表頭後重新匯入。",
              );
            }
            const end = offsets[best]!;
            commit(
              block,
              start,
              end,
              fragmentHtml(block, start, end, repeatHere),
              repeatHere,
            );
            start = end;
            consumed = best;
            if (start < block.text.length) {
              flush();
              await pause();
            }
          }
        }
      }
      progress(Math.round(((i + 1) / doc.blocks.length) * 100));
      if (i % 6 === 0) await pause();
    }
    flush();
    abort();
    return pages;
  } finally {
    host.remove();
  }
}
