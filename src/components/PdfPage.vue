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
  loading = ref(true);
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
let renderQueue = Promise.resolve();
const textWarning = ref("");
const originalUrl = ref("");
function render() {
  const token = ++request;
  renderTask?.cancel();
  textTask?.cancel();
  // A canvas can only be used by one PDF.js task, including during cancellation.
  renderQueue = renderQueue.catch(() => {}).then(() => draw(token));
}
async function openOriginal() {
  try {
    const { mediaUrl } = await import("../core/media");
    originalUrl.value = await mediaUrl(props.fragment.pdf!.assetId);
  } catch {
    error.value = "找不到原始 PDF，請從完整 ZIP 備份還原。";
  }
}
async function draw(token: number) {
  if (
    token !== request ||
    !host.value ||
    !canvas.value ||
    !layer.value ||
    !props.fragment.pdf
  )
    return;
  release?.();
  release = undefined;
  loading.value = true;
  error.value = "";
  textWarning.value = "";
  originalUrl.value = "";
  baseHtml = "";
  layer.value.replaceChildren();
  let phase = "讀取原檔";
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
    if (width < 1 || height < 1) {
      loading.value = false;
      return;
    }
    const scale =
      (props.expanded
        ? width / original.width
        : Math.min(width / original.width, height / original.height)) *
      (props.zoom || 1);
    const viewport = page.getViewport({ scale });
    surface.value = {
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
    };
    await nextTick();
    if (token !== request || !canvas.value || !layer.value) return;
    const mobile =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      matchMedia("(pointer: coarse)").matches;
    const ratio = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(
        (mobile ? 3_000_000 : 8_000_000) / (viewport.width * viewport.height),
      ),
      4096 / Math.max(viewport.width, viewport.height),
    );
    const c = canvas.value;
    c.width = Math.max(1, Math.floor(viewport.width * ratio));
    c.height = Math.max(1, Math.floor(viewport.height * ratio));
    phase = "繪製頁面";
    renderTask = page.render({
      canvas: c,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    await renderTask.promise;
    if (token !== request) return;
    loading.value = false;
    // An optional selection-layer failure must never turn a rendered PDF into a white error page.
    try {
      const content = await page.getTextContent();
      if (token !== request || !layer.value) return;
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
      await textTask.render();
      if (token !== request) return;
      baseHtml = layer.value.innerHTML;
      paint();
    } catch (e) {
      if (token !== request) return;
      layer.value?.replaceChildren();
      textWarning.value = "頁面已顯示，這一頁暫時無法選取文字。";
      console.warn("PDF selection layer failed", (e as Error).name);
    }
  } catch (e) {
    if (token !== request) return;
    loading.value = false;
    const message = e instanceof Error ? e.message : String(e);
    console.warn("PDF render failed", phase, message);
    error.value = `${phase}失敗：${message.slice(0, 180)}`;
  }
}
watch(
  () => [
    props.fragment.pdf?.assetId,
    props.fragment.pdf?.page,
    props.zoom,
    props.expanded,
  ],
  () => void render(),
);
watch(() => [props.hits, props.activeHit, props.annotations], paint);
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
  void renderQueue.finally(() => release?.());
  if (canvas.value) {
    canvas.value.width = 0;
    canvas.value.height = 0;
  }
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
    <span v-if="loading" class="pdf-status">正在讀取這一頁…</span>
    <div v-if="error" class="pdf-status pdf-error" role="alert">
      <strong>這一頁暫時無法顯示</strong>
      <p>{{ error }}</p>
      <button class="toolbar-button" @click="render">重試此頁</button>
      <button class="toolbar-button" @click="openOriginal">原檔預覽</button>
      <a v-if="originalUrl" :href="originalUrl" target="_blank" rel="noopener"
        >開啟原始 PDF</a
      >
      <span>筆記未刪除；原檔遺失時可從 ZIP 備份還原。</span>
    </div>
    <span v-else-if="textWarning" class="pdf-text-warning" role="status">{{
      textWarning
    }}</span>
  </div>
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
.pdf-error {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field);
  overflow-wrap: anywhere;
  top: 20%;
}
.pdf-error p {
  margin: 8px 0;
}
.pdf-error > span,
.pdf-error a {
  display: block;
  margin-top: 8px;
}
.pdf-text-warning {
  position: absolute;
  bottom: 0;
  padding: 4px 8px;
  background: var(--field);
  font-size: 12px;
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
</style>
