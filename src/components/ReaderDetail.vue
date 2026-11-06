<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import PageLeaf from "./PageLeaf.vue";
import PdfPage from "./PdfPage.vue";
import type { Annotation, PageSize, PaperPage, SearchHit } from "../core/model";
const props = defineProps<{
  pages: PaperPage[];
  pageIndex: number;
  title: string;
  hits: SearchHit[];
  activeHit?: SearchHit;
  annotations?: Annotation[];
  size: PageSize;
}>();
const emit = defineEmits<{ close: []; navigate: [page: number] }>();
const dialog = ref<HTMLDialogElement>();
const scroll = ref<HTMLElement>();
const zoom = ref(1);
const page = computed(() => props.pages[props.pageIndex]!);
const fragment = computed(() => page.value.fragments[0]);
const leafStyle = computed(() => ({
  "--page-width": `${props.size.width}px`,
  "--page-height": `${props.size.height}px`,
  transform: `scale(${zoom.value})`,
  transformOrigin: "top left",
}));
function move(direction: number) {
  const target = props.pageIndex + direction;
  if (target >= 0 && target < props.pages.length) emit("navigate", target);
}
function keys(event: KeyboardEvent) {
  if (
    (event.target as HTMLElement).closest("select,input") ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    window.getSelection()?.toString()
  )
    return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  }
}
watch(
  () => props.pageIndex,
  async () => {
    await nextTick();
    scroll.value?.scrollTo({ top: 0, left: 0 });
  },
);
onMounted(() => dialog.value?.showModal());
</script>
<template>
  <dialog
    ref="dialog"
    class="reader-detail"
    aria-label="放大閱讀"
    @cancel="emit('close')"
    @close="emit('close')"
    @keydown="keys"
    @click="$event.target === dialog && emit('close')"
  >
    <div class="detail-toolbar">
      <div class="detail-navigation">
        <button
          class="icon-button"
          aria-label="放大閱讀：上一頁"
          :disabled="pageIndex === 0"
          @click="move(-1)"
        >
          <AppIcon name="left" />
        </button>
        <span aria-live="polite">{{ pageIndex + 1 }} / {{ pages.length }}</span>
        <button
          class="icon-button"
          aria-label="放大閱讀：下一頁"
          :disabled="pageIndex === pages.length - 1"
          @click="move(1)"
        >
          <AppIcon name="right" />
        </button>
      </div>
      <label
        >縮放<select v-model="zoom" aria-label="閱讀縮放">
          <option :value="1">{{ fragment?.pdf ? "適合寬度" : "100%" }}</option>
          <option :value="1.5">150%</option>
          <option :value="2">200%</option>
          <option :value="3">300%</option>
        </select></label
      >
      <button
        class="icon-button"
        aria-label="關閉放大閱讀"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
    </div>
    <div ref="scroll" class="detail-scroll">
      <PdfPage
        v-if="fragment?.pdf"
        :key="pageIndex"
        :fragment="fragment"
        :hits="hits"
        :active-hit="activeHit"
        :annotations="annotations"
        expanded
        :zoom="zoom"
      />
      <div
        v-else
        class="detail-text-page"
        :style="{
          width: `${size.width * zoom}px`,
          height: `${size.height * zoom}px`,
        }"
      >
        <PageLeaf
          :page="page"
          :title="title"
          :hits="hits"
          :active-hit="activeHit"
          :annotations="annotations"
          :style="leafStyle"
          expanded
        />
      </div>
    </div>
  </dialog>
</template>
