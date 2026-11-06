<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { acquirePdf, pdfjs } from "../core/pdf";
import { markAnnotations } from "../core/annotations";
import { highlightPage } from "../core/search";
import type { Fragment, SearchHit, Annotation } from "../core/model";
const props = defineProps<{
  fragment: Fragment;
  hits: SearchHit[];
  activeHit?: SearchHit;
  annotations?: Annotation[];
  expanded?: boolean;
  zoom?: number;
}>();
const host = ref<HTMLElement>(),
  canvas = ref<HTMLCanvasElement>(),
  layer = ref<HTMLElement>();
const error = ref(""),
  loading = ref(true),
  modal = ref(false),
  zoom = ref(1);
const dialog = ref<HTMLElement>(),
  enlarge = ref<HTMLButtonElement>();
const surface = ref({ width: "0px", height: "0px" });
let observer: ResizeObserver | undefined,
  request = 0,
  baseHtml = "",
  release: (() => void) | undefined;
let renderTask: ReturnType<pdfjs.PDFPageProxy["render"]> | undefined,
  textTask: InstanceType<typeof pdfjs.TextLayer> | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
function paint() {
  if (!layer.value || !baseHtml) return;
  const wrapper = document.createElement("div");
  const clone = layer.value.cloneNode(false) as HTMLElement;
  clone.innerHTML = baseHtml;
  wrapper.append(clone);
  const html = highlightPage(
    markAnnotations(wrapper.innerHTML, props.annotations || []),
    props.hits,
    props.activeHit,
  );
  const parsed = document.createElement("div");
  parsed.innerHTML = html;
  layer.value.innerHTML = parsed.firstElementChild!.innerHTML;
}
async function render() {
  const token = ++request;
  renderTask?.cancel();
  textTask?.cancel();
  release?.();
  release = undefined;
  if (!host.value || !canvas.value || !layer.value || !props.fragment.pdf)
    return;
  loading.value = true;
  error.value = "";
  baseHtml = "";
  layer.value.replaceChildren();
  try {
    const lease = await acquirePdf(props.fragment.pdf.assetId);
    if (token !== request) {
      lease.release();
      return;
    }
    release = lease.release;
    const page = await lease.document.getPage(props.fragment.pdf.page);
    if (token !== request) return;
    const original = page.getViewport({ scale: 1 });
    const width = host.value.clientWidth,
      height = host.value.clientHeight;
    const scale =
      (props.expanded
        ? width / original.width
        : Math.min(width / original.width, (height - 30) / original.height)) *
      (props.zoom || 1);
    const viewport = page.getViewport({ scale });
    surface.value = {
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
    };
    await nextTick();
    if (token !== request || !canvas.value || !layer.value) return;
    const ratio = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(8_000_000 / (viewport.width * viewport.height)),
    );
    const c = canvas.value;
    c.width = Math.max(1, Math.floor(viewport.width * ratio));
    c.height = Math.max(1, Math.floor(viewport.height * ratio));
    renderTask = page.render({
      canvas: c,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    const raster = renderTask.promise;
    void raster.catch(() => {});
    const content = await page.getTextContent();
    if (token !== request) return;
    layer.value.style.setProperty(
      "--total-scale-factor",
      String(viewport.scale * page.userUnit),
    );
    layer.value.style.setProperty("--scale-round-x", "1px");
    layer.value.style.setProperty("--scale-round-y", "1px");
    textTask = new pdfjs.TextLayer({
      textContentSource: content,
      container: layer.value,
      viewport,
    });
    await Promise.all([raster, textTask.render()]);
    if (token !== request) return;
    baseHtml = layer.value.innerHTML;
    paint();
    loading.value = false;
    page.cleanup();
  } catch (e) {
    if (token !== request) return;
    if (
      (e as Error).name === "RenderingCancelledException" ||
      (e as Error).name === "AbortException"
    )
      return;
    loading.value = false;
    error.value = "這一頁載入失敗，請重新匯入原始 PDF 或備份。";
  }
}
watch(
  () => [props.fragment.pdf?.assetId, props.fragment.pdf?.page, props.zoom],
  () => void render(),
);
watch(() => [props.hits, props.activeHit, props.annotations], paint);
watch(modal, async (open) => {
  await nextTick();
  if (open) dialog.value?.querySelector<HTMLButtonElement>("button")?.focus();
  else enlarge.value?.focus();
});
function dialogKeys(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    modal.value = false;
    return;
  }
  if (event.key !== "Tab" || !dialog.value) return;
  const controls = [
      ...dialog.value.querySelectorAll<HTMLElement>("button,select"),
    ],
    first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
onMounted(() => {
  observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => void render(), 100);
  });
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => {
  request++;
  observer?.disconnect();
  clearTimeout(resizeTimer);
  renderTask?.cancel();
  textTask?.cancel();
  release?.();
});
</script>
<template>
  <div ref="host" class="pdf-host" :class="{ 'pdf-expanded': expanded }">
    <div class="pdf-surface" :style="surface">
      <canvas
        ref="canvas"
        data-decoration="true"
        aria-label="PDF 原始頁面"
        role="img"
      ></canvas>
      <div
        ref="layer"
        class="textLayer fragment"
        :data-block="fragment.blockId"
        data-start="0"
        :data-end="fragment.end"
      ></div>
    </div>
    <span v-if="loading" class="pdf-status">正在讀取這一頁…</span
    ><span v-if="error" class="pdf-status" role="alert">{{ error }}</span>
    <button
      v-if="!expanded"
      ref="enlarge"
      class="pdf-enlarge"
      @click.stop="modal = true"
    >
      放大閱讀
    </button>
  </div>
  <Teleport to="body"
    ><div
      v-if="modal"
      class="pdf-modal modal-backdrop"
      @click.self="modal = false"
      @keydown.stop="dialogKeys"
    >
      <section
        ref="dialog"
        class="pdf-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="放大 PDF 閱讀"
        @touchstart.stop
        @touchend.stop
      >
        <div class="pdf-controls">
          <span>PDF 第 {{ fragment.pdf?.page }} 頁</span
          ><label
            >縮放<select v-model="zoom" aria-label="PDF 縮放">
              <option :value="1">適合寬度</option>
              <option :value="1.5">150%</option>
              <option :value="2">200%</option>
              <option :value="3">300%</option>
            </select></label
          ><button aria-label="關閉 PDF 放大" @click="modal = false">
            關閉
          </button>
        </div>
        <p class="pdf-zoom-hint">
          放大視窗可捲動、選字與複製；畫重點請回到紙頁選取。
        </p>
        <div class="pdf-scroll">
          <PdfPage
            :fragment="fragment"
            :hits="hits"
            :active-hit="activeHit"
            :annotations="annotations"
            expanded
            :zoom="zoom"
          />
        </div>
      </section></div
  ></Teleport>
</template>
<style>
.pdf-host {
  height: 100%;
  width: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-width: 0;
}
.pdf-surface {
  position: relative;
  flex-shrink: 0;
  background: white;
  max-width: none;
}
.pdf-surface canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
}
.pdf-status {
  position: absolute;
  top: 45%;
  left: 5%;
  right: 5%;
  text-align: center;
  font-size: 13px;
  color: var(--text-primary, #8a725c);
}
.pdf-enlarge {
  position: absolute;
  bottom: 0;
  right: 0;
  background: var(--surface-panel, #f4ecdf);
  border: 1px solid var(--line, #d8c7b3);
  border-radius: 4px;
  padding: 4px 9px;
  font-size: 11px;
  color: var(--text-primary, #80634d);
}
.pdf-surface .textLayer {
  color-scheme: only light;
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: clip;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: #333;
  z-index: 1;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.pdf-surface .textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  user-select: text;
}
.pdf-surface .textLayer > :not(.markedContent),
.pdf-surface .textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x))
    scale(var(--min-font-size-inv));
}
.pdf-surface .textLayer .markedContent {
  display: contents;
}
.pdf-surface .textLayer mark {
  position: static !important;
  color: transparent !important;
  font: inherit !important;
  line-height: inherit !important;
  padding: 0 !important;
  border: 0 !important;
  white-space: pre !important;
  opacity: 0.55;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.pdf-surface .textLayer ::selection {
  background: #a9badc99;
  color: transparent;
}
.pdf-expanded {
  height: auto;
  min-height: 100%;
  justify-content: flex-start;
}
.pdf-dialog {
  width: min(1100px, 96vw);
  height: 94dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface-panel, #f6f0e6);
  border: 1px solid var(--line-strong, #c4b099);
  border-radius: 9px;
  box-shadow: 0 10px 80px var(--shadow-deep, #30271e55);
  overflow: hidden;
}
.pdf-controls {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  color: var(--text-primary, #71563e);
  font-size: 14px;
}
.pdf-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pdf-controls select,
.pdf-controls button {
  border: 1px solid var(--line, #cebca7);
  background: var(--surface-raised, #fffaf1);
  padding: 7px;
  border-radius: 5px;
  color: var(--text-primary, #71563e);
}
.pdf-zoom-hint {
  font-size: 12px;
  color: var(--text-secondary, #8a7560);
  padding: 0 18px 10px;
  margin: 0;
}
.pdf-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 12px;
  background: var(--surface-inset, #d8cfc2);
}
.pdf-modal {
  z-index: 150;
}
</style>
