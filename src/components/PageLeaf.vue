<script setup lang="ts">
import { computed, nextTick, ref, watch, defineAsyncComponent } from "vue";
const PdfPage = defineAsyncComponent(() => import("./PdfPage.vue"));
import AppIcon from "./AppIcon.vue";
import { mediaUrl } from "../core/media";
import type { PaperPage, SearchHit } from "../core/model";
import { highlightPage } from "../core/search";
import { markAnnotations } from "../core/annotations";
import type { Annotation } from "../core/model";
const props = defineProps<{
  expanded?: boolean;
  page?: PaperPage;
  title: string;
  hits: SearchHit[];
  activeHit?: SearchHit;
  highlight?: boolean;
  side?: string;
  annotations?: Annotation[];
}>();
const emit = defineEmits<{ jump: [page: number]; enlarge: [page: number] }>();
const content = ref<HTMLElement>();
const html = computed(() =>
  highlightPage(
    markAnnotations(
      props.page?.fragments.map((f) => f.html).join("") || "",
      props.annotations || [],
    ),
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
    :class="[
      {
        'blank-paper': !page,
        'page-locator': highlight,
        'pdf-paper': !!page?.fragments[0]?.pdf,
      },
      side,
    ]"
    :aria-label="page ? `第 ${page.index + 1} 頁` : '空白紙頁'"
    :data-page="page ? page.index + 1 : undefined"
  >
    <div class="page-running-title" aria-hidden="true">
      {{ page ? title : "" }}
    </div>
    <div v-if="page?.fragments[0]?.pdf" class="page-content pdf-page-content">
      <PdfPage
        :fragment="page.fragments[0]"
        :expanded="expanded"
        :hits="hits"
        :active-hit="activeHit"
        :annotations="annotations"
      />
    </div>
    <div v-else ref="content" class="page-content" v-html="html"></div>
    <footer v-if="!expanded" class="paper-footer">
      <button
        v-if="page"
        class="paper-page-number"
        title="跳至頁碼"
        :aria-label="`第 ${page.index + 1} 頁，跳至頁碼`"
        @click="emit('jump', page.index)"
      >
        {{ String(page.index + 1).padStart(2, "0") }}
      </button>
      <button
        v-if="page"
        class="page-enlarge"
        aria-label="放大閱讀"
        title="放大閱讀"
        @click="emit('enlarge', page.index)"
      >
        <AppIcon name="zoom" :size="17" />
      </button>
    </footer>
  </article>
</template>
