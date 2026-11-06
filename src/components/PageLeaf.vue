<script setup lang="ts">
import { computed } from "vue";
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
const html = computed(() =>
  highlightPage(
    props.page?.fragments.map((f) => f.html).join("") || "",
    props.hits,
    props.activeHit,
  ),
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
    <div class="page-content" v-html="html"></div>
    <footer class="paper-footer">
      <span>{{ page ? "紙 間" : "" }}</span
      ><span>{{ page ? String(page.index + 1).padStart(2, "0") : "" }}</span
      ><span>{{ page ? "閱讀筆記" : "" }}</span>
    </footer>
  </article>
</template>
