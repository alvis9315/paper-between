<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { mediaUrl } from "../core/media";
import type { PaperPage, SearchHit } from "../core/model";
import { highlightPage } from "../core/search";
const props = defineProps<{
  page?: PaperPage;
  title: string;
  hits: SearchHit[];
  activeHit?: SearchHit;
  highlight?: boolean;
  side?: string;
}>();
const content = ref<HTMLElement>();
const html = computed(() =>
  highlightPage(
    props.page?.fragments.map((f) => f.html).join("") || "",
    props.hits,
    props.activeHit,
  ),
);
watch(
  html,
  async () => {
    await nextTick();
    const host = content.value;
    if (!host) return;
    for (const img of host.querySelectorAll<HTMLImageElement>(
      "img[data-media-id]",
    )) {
      try {
        const url = await mediaUrl(img.dataset.mediaId!);
        if (img.isConnected) img.src = url;
      } catch {
        if (img.isConnected) {
          img.alt = "圖片遺失，請重新匯入備份";
          img.parentElement?.classList.add("image-missing");
        }
      }
    }
  },
  { immediate: true },
);
</script>
<template>
  <article
    class="paper"
    :class="[{ 'blank-paper': !page, 'page-locator': highlight }, side]"
    :aria-label="page ? `第 ${page.index + 1} 頁` : '空白紙頁'"
    :data-page="page ? page.index + 1 : undefined"
  >
    <div class="page-running-title" aria-hidden="true">
      {{ page ? title : "" }}
    </div>
    <div ref="content" class="page-content" v-html="html"></div>
    <footer class="paper-footer">
      <span>{{ page ? "紙 間" : "" }}</span
      ><span>{{ page ? String(page.index + 1).padStart(2, "0") : "" }}</span
      ><span>{{ page ? "閱讀筆記" : "" }}</span>
    </footer>
  </article>
</template>
