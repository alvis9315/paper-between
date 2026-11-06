<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  ChevronLeft,
  ChevronRight,
  List,
  SquarePen,
  Trash2,
  Plus,
  Layers,
  BookOpen,
} from "@lucide/vue";
import IconAction from "./IconAction.vue";
import ChoiceSelect from "./ChoiceSelect.vue";
import ModalShell from "./ModalShell.vue";
import AppIcon from "./AppIcon.vue";
import { cardsFromBook, MAX_REVIEW_CARDS } from "../core/reviewCards";
import { mediaUrl } from "../core/media";
import type { BookRecord, ReviewCard } from "../core/model";
const props = defineProps<{
  cards: ReviewCard[];
  books: BookRecord[];
  busy: boolean;
}>();
const emit = defineEmits<{
  add: [cards: ReviewCard[]];
  save: [card: ReviewCard];
  remove: [id: string];
  source: [id: string];
  import: [kind: "pdf" | "word"];
}>();
const query = ref(""),
  topic = ref(""),
  index = ref(0),
  showResults = ref(false),
  showGenerate = ref(false),
  showEdit = ref(false),
  deleteOpen = ref(false);
const resultLimit = ref(60);
const editing = shallowRef<ReviewCard>();
const title = ref(""),
  body = ref(""),
  tags = ref(""),
  error = ref("");
const topics = computed(() =>
  [...new Set(props.cards.flatMap((c) => c.tags))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  ),
);
const filtered = computed(() => {
  const words = query.value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^#/, ""))
    .filter(Boolean);
  return props.cards.filter(
    (c) =>
      (!topic.value || c.tags.includes(topic.value)) &&
      words.every((w) =>
        [c.title, c.body, c.sourceTitle, ...c.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(w),
      ),
  );
});
const current = computed(() => filtered.value[index.value]);
const imageUrl = ref("");
const searchInput = ref<HTMLInputElement>();
watch(
  () => current.value?.image?.mediaId,
  async (id) => {
    imageUrl.value = "";
    if (id) {
      try {
        const url = await mediaUrl(id);
        if (current.value?.image?.mediaId === id) imageUrl.value = url;
      } catch {
        error.value = "小卡圖片遺失，請從 ZIP 備份還原。";
      }
    }
  },
  { immediate: true },
);
watch([query, topic], () => {
  index.value = 0;
  resultLimit.value = 60;
});
watch(
  () => filtered.value.length,
  (count) => (index.value = Math.min(index.value, Math.max(0, count - 1))),
);
watch(topics, (list) => {
  if (topic.value && !list.includes(topic.value)) topic.value = "";
});
function move(delta: number) {
  index.value = Math.max(
    0,
    Math.min(filtered.value.length - 1, index.value + delta),
  );
}
function keys(e: KeyboardEvent) {
  if (
    !(e.target as HTMLElement).closest("dialog") &&
    (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
      (e.key === "/" && !(e.target as HTMLElement).closest("input,textarea")))
  ) {
    e.preventDefault();
    searchInput.value?.focus();
    return;
  }

  if (
    (e.target as HTMLElement).closest(
      'input,textarea,dialog,[role="combobox"]',
    ) ||
    e.metaKey ||
    e.ctrlKey ||
    window.getSelection()?.toString()
  )
    return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    move(e.key === "ArrowRight" ? 1 : -1);
  }
}
let touch: { x: number; y: number; time: number } | undefined;
function touchStart(e: TouchEvent) {
  if (e.touches.length === 1 && !window.getSelection()?.toString())
    touch = {
      x: e.touches[0]!.clientX,
      y: e.touches[0]!.clientY,
      time: Date.now(),
    };
}
function touchEnd(e: TouchEvent) {
  if (!touch) return;
  const point = e.changedTouches[0]!,
    dx = point.clientX - touch.x,
    dy = point.clientY - touch.y;
  if (
    Math.abs(dx) > 60 &&
    Math.abs(dx) > Math.abs(dy) * 1.6 &&
    Date.now() - touch.time < 700 &&
    !window.getSelection()?.toString()
  )
    move(dx < 0 ? 1 : -1);
  touch = undefined;
}
function edit(card?: ReviewCard) {
  editing.value = card;
  title.value = card?.title || "";
  body.value = card?.body || "";
  tags.value = card?.tags.join("，") || "";
  error.value = "";
  showEdit.value = true;
}
function save() {
  const parsedTags = [
    ...new Set(
      tags.value
        .split(/[,，#\n]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  if (!title.value.trim() || !body.value.trim()) {
    error.value = "請填寫小卡標題與內容。";
    return;
  }
  if (parsedTags.length > 8 || parsedTags.some((t) => t.length > 60)) {
    error.value = "每張最多 8 個標籤，每個最多 60 字。";
    return;
  }
  if (!editing.value && props.cards.length >= MAX_REVIEW_CARDS) {
    error.value = "最多保存 2000 張小卡，請先整理或備份。";
    return;
  }
  emit("save", {
    ...editing.value,
    id: editing.value?.id || crypto.randomUUID(),
    title: title.value.trim(),
    body: body.value.trim(),
    tags: parsedTags,
    sourceTitle: editing.value?.sourceTitle || "自建小卡",
    createdAt: editing.value?.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
  showEdit.value = false;
}
const sources = computed(() => props.books.filter((b) => !b.deletedAt));
const sourceId = ref(""),
  mode = ref<"content" | "highlights">("content");
watch(
  sources,
  (value) => {
    if (!value.some((b) => b.document.id === sourceId.value))
      sourceId.value = value[0]?.document.id || "";
  },
  { immediate: true },
);
const source = computed(() =>
  sources.value.find((b) => b.document.id === sourceId.value),
);
const generated = computed(() =>
  source.value
    ? cardsFromBook(source.value, mode.value).filter(
        (c) =>
          !props.cards.some((existing) => existing.sourceKey === c.sourceKey),
      )
    : [],
);
function generate() {
  if (props.cards.length + generated.value.length > MAX_REVIEW_CARDS) {
    error.value = "超過 2000 張小卡，請改用重點摘錄或先整理。";
    return;
  }
  emit("add", generated.value);
  query.value = "";
  topic.value = "";
  index.value = props.cards.length;
  showGenerate.value = false;
}
onMounted(() => window.addEventListener("keydown", keys));
onBeforeUnmount(() => window.removeEventListener("keydown", keys));
</script>
<template>
  <main class="study-page">
    <div class="study-heading">
      <div>
        <h1>考前小卡</h1>
        <p>搜尋重點，一次專心看一張。</p>
      </div>
      <div class="study-actions">
        <button
          aria-label="新增小卡"
          class="toolbar-button"
          :disabled="busy"
          @click="edit()"
        >
          <Plus :size="17" /><span class="study-action-label"
            >新增小卡</span
          ></button
        ><button
          aria-label="從筆記建立"
          class="toolbar-button"
          :disabled="busy"
          @click="
            error = '';
            showGenerate = true;
          "
        >
          <Layers :size="17" /><span class="study-action-label"
            >從筆記建立</span
          >
        </button>
      </div>
    </div>
    <div class="study-controls">
      <label class="study-search"
        ><AppIcon name="search" /><input
          ref="searchInput"
          v-model="query"
          aria-label="搜尋小卡"
          placeholder="搜尋標題、內容或主題…" /><button
          v-if="query"
          class="icon-button"
          aria-label="清除小卡搜尋"
          @click="query = ''"
        >
          <AppIcon name="close" /></button
      ></label>
      <button
        :aria-label="`${query || topic ? '相關' : '全部'}小卡 ${filtered.length}`"
        class="toolbar-button"
        :disabled="!filtered.length"
        @click="showResults = true"
      >
        <List :size="17" /><span class="study-result-label"
          >{{ query || topic ? "相關" : "全部" }}小卡 </span
        ><span>{{ filtered.length }}</span>
      </button>
    </div>
    <div class="study-topics" role="group" aria-label="小卡主題標籤">
      <button :aria-pressed="!topic" @click="topic = ''">
        全部 {{ cards.length }}</button
      ><button
        v-for="tag in topics"
        :key="tag"
        :aria-pressed="topic === tag"
        @click="topic = topic === tag ? '' : tag"
      >
        # {{ tag }}
      </button>
    </div>
    <p v-if="query || topic" class="study-filter-status" role="status">
      {{ filtered.length }} 張相關小卡；左右切換會留在這組結果。<button
        @click="
          query = '';
          topic = '';
        "
      >
        清除篩選
      </button>
    </p>
    <template v-if="current">
      <article
        class="review-card"
        :data-card-id="current.id"
        aria-label="目前小卡"
        @touchstart.passive="touchStart"
        @touchend.passive="touchEnd"
        @touchcancel="touch = undefined"
      >
        <header>
          <span>{{ current.tags[0] || "自由複習" }}</span
          ><span>{{ index + 1 }} / {{ filtered.length }}</span>
        </header>
        <div class="review-content">
          <h2>{{ current.title }}</h2>
          <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="current.image?.alt || '複習圖解'"
          />
          <p>{{ current.body }}</p>
        </div>
        <footer>
          <span>{{ current.sourceTitle }}</span
          ><IconAction
            v-if="current.sourceBookId"
            compact
            :icon="BookOpen"
            label="查看小卡來源"
            :disabled="
              busy ||
              !sources.some((b) => b.document.id === current?.sourceBookId)
            "
            @click="emit('source', current.sourceBookId!)"
          /><IconAction
            compact
            :icon="SquarePen"
            label="編輯小卡"
            @click="edit(current)"
          /><IconAction
            compact
            :icon="Trash2"
            label="刪除小卡"
            danger
            @click="deleteOpen = true"
          />
        </footer>
      </article>
      <div class="study-navigation">
        <IconAction
          :icon="ChevronLeft"
          label="上一張小卡"
          :disabled="index === 0"
          @click="move(-1)"
        /><span aria-live="polite">{{ index + 1 }} / {{ filtered.length }}</span
        ><IconAction
          :icon="ChevronRight"
          label="下一張小卡"
          :disabled="index + 1 >= filtered.length"
          @click="move(1)"
        />
      </div>
    </template>
    <div v-else class="study-empty">
      <Layers :size="36" />
      <h2>{{ cards.length ? "沒有符合的小卡" : "準備你的第一組複習小卡" }}</h2>
      <p>
        {{
          cards.length
            ? "換個關鍵字，或清除主題篩選。"
            : "可以自行新增，或從筆記標題、段落與重點摘錄建立。"
        }}
      </p>
      <button
        v-if="cards.length"
        class="toolbar-button"
        @click="
          query = '';
          topic = '';
        "
      >
        清除篩選
      </button>
    </div>
    <div v-if="!cards.length" class="study-import">
      <span>匯入資料建立小卡</span
      ><button
        class="toolbar-button"
        :disabled="busy"
        @click="emit('import', 'word')"
      >
        匯入 Word</button
      ><button
        class="toolbar-button"
        :disabled="busy"
        @click="emit('import', 'pdf')"
      >
        匯入 PDF
      </button>
    </div>
    <p class="study-note">
      小卡會保存在這個瀏覽器，並包含在書架 ZIP
      備份中。內容來自原文，請確認後再作應考資料。
    </p>
  </main>
  <ModalShell
    v-if="showResults"
    title="小卡搜尋結果"
    @close="showResults = false"
    ><p>{{ filtered.length }} 張，點選直接跳到該張；返回後可繼續左右複習。</p>
    <div class="study-result-list">
      <button
        v-for="(card, n) in filtered.slice(0, resultLimit)"
        :key="card.id"
        @click="
          index = n;
          showResults = false;
        "
      >
        <span>{{ n + 1 }} · {{ card.tags.join("／") }}</span
        ><strong>{{ card.title }}</strong>
        <p>{{ card.body.slice(0, 100) }}</p>
      </button>
      <button
        v-if="filtered.length > resultLimit"
        class="toolbar-button"
        @click="resultLimit += 60"
      >
        顯示更多小卡（還有 {{ filtered.length - resultLimit }} 張）
      </button>
    </div></ModalShell
  >
  <ModalShell
    v-if="showEdit"
    :title="editing ? '編輯小卡' : '新增小卡'"
    @close="showEdit = false"
    ><form class="study-form" @submit.prevent="save">
      <label
        >標題<input
          v-model="title"
          maxlength="160"
          aria-label="小卡標題" /></label
      ><label
        >主題標籤<span>以逗號分隔，可自行修正匯入的主題。</span
        ><input
          v-model="tags"
          aria-label="小卡標籤"
          placeholder="例如：無線網路，藍牙" /></label
      ><label
        >重點內容<textarea
          v-model="body"
          rows="8"
          maxlength="6000"
          aria-label="小卡內容"
        />
      </label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button class="import-button">儲存小卡</button>
    </form></ModalShell
  >
  <ModalShell
    v-if="showGenerate"
    title="從筆記建立小卡"
    @close="showGenerate = false"
    ><div class="study-form">
      <label
        >來源筆記<ChoiceSelect
          v-model="sourceId"
          label="小卡來源筆記"
          :disabled="!sources.length"
          :options="
            sources.map((b) => ({
              value: b.document.id,
              label: b.document.title,
            }))
          " /></label
      ><label
        >使用內容<ChoiceSelect
          v-model="mode"
          label="小卡建立方式"
          :options="[
            { value: 'content', label: '依標題與段落' },
            { value: 'highlights', label: '只用重點摘錄' },
          ]"
      /></label>
      <p>
        Word 的標題 1／2
        會成為主題標籤。沒有標題時使用筆記名稱；長內容會拆成多張，保留原文並允許編輯。
      </p>
      <p v-if="source?.document.pdfAssetId">
        PDF 原頁尚未辨識主題；建議先用「圖文重排」整理，或建立後手動校正標籤。
      </p>
      <div class="study-import">
        <button
          class="toolbar-button"
          :disabled="busy"
          @click="
            showGenerate = false;
            emit('import', 'word');
          "
        >
          匯入 Word</button
        ><button
          class="toolbar-button"
          :disabled="busy"
          @click="
            showGenerate = false;
            emit('import', 'pdf');
          "
        >
          匯入 PDF
        </button>
      </div>
      <strong>可新增 {{ generated.length }} 張（已建立過的來源會略過）</strong>
      <p v-if="error" role="alert">{{ error }}</p>
      <button
        class="import-button"
        :disabled="!generated.length"
        @click="generate"
      >
        建立小卡
      </button>
    </div></ModalShell
  >
  <ModalShell
    v-if="deleteOpen && current"
    title="刪除小卡"
    @close="deleteOpen = false"
    ><p>刪除「{{ current.title }}」？原筆記會保留。</p>
    <button
      class="toolbar-button danger-action"
      @click="
        emit('remove', current.id);
        deleteOpen = false;
      "
    >
      確認刪除小卡
    </button></ModalShell
  >
</template>
<style scoped>
.study-page {
  padding: 24px var(--workspace-gutter) 32px;
  max-width: 1100px;
  margin: auto;
  width: 100%;
}
.study-heading,
.study-actions,
.study-controls,
.study-navigation,
.study-import {
  display: flex;
  align-items: center;
  gap: 12px;
}
.study-heading {
  justify-content: space-between;
  margin-bottom: 22px;
}
h1 {
  font-size: 27px;
  color: var(--heading);
}
.study-heading p,
.study-note,
.study-import,
.study-filter-status {
  font-size: 12px;
  color: var(--muted);
}
.study-heading p {
  margin-top: 6px;
}
.study-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field);
  padding: 0 12px;
}
.study-search input {
  flex: 1;
  width: 0;
  min-width: 0;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 16px;
}
.study-search:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.study-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
  max-height: 116px;
  overflow: auto;
  padding: 3px;
}
.study-topics button {
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--ink);
  background: var(--field);
  font-size: 13px;
}
.study-topics button[aria-pressed="true"] {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.study-filter-status {
  margin-bottom: 12px;
}
.study-filter-status button {
  background: transparent;
  color: var(--accent-ink);
  text-decoration: underline;
  margin-left: 8px;
}
.review-card {
  width: min(100%, 720px);
  margin: 0 auto;
  border: 1px solid var(--border);
  border-top: 4px solid var(--accent);
  border-radius: 18px;
  background: var(--field);
  box-shadow: 0 10px 35px #30251d12;
  height: min(60dvh, 570px);
  min-height: 280px;
  display: flex;
  flex-direction: column;
  touch-action: pan-y pinch-zoom;
}
.review-card header,
.review-card footer {
  display: flex;
  align-items: center;
  padding: 16px 22px;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}
.review-card header {
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}
.review-card header > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-card footer {
  border-top: 1px solid var(--border);
  padding-block: 8px;
}
.review-card footer > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-content {
  padding: 22px;
  overflow: auto;
  min-height: 0;
  flex: 1;
  overscroll-behavior: contain;
}
.review-content h2 {
  font-size: clamp(20px, 3vw, 27px);
  line-height: 1.5;
  color: var(--heading);
  margin-bottom: 18px;
  overflow-wrap: anywhere;
}
.review-content p {
  white-space: pre-wrap;
  font-size: 17px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.review-content img {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin: 0 auto 18px;
  object-fit: contain;
}
.study-navigation {
  justify-content: center;
  margin: 12px 0;
  color: var(--muted);
  font-size: 13px;
}
.study-import {
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 18px;
}
.study-note {
  text-align: center;
  margin-top: 12px;
  line-height: 1.8;
}
.study-empty {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  color: var(--muted);
}
.study-result-list {
  display: grid;
  gap: 10px;
}
.study-result-list button {
  display: block;
  width: 100%;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--ink);
  padding: 12px;
  overflow-wrap: anywhere;
}
.study-result-list button:hover {
  border-color: var(--accent);
}
.study-result-list span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.study-result-list strong {
  display: block;
  margin: 4px 0;
}
.study-result-list p {
  font-size: 13px;
}
.study-form {
  display: grid;
  gap: 18px;
}
.study-form label {
  display: grid;
  gap: 6px;
  font-size: 14px;
}
.study-form label > span {
  font-size: 12px;
  color: var(--muted);
}
.study-form input,
.study-form textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--field);
  color: var(--ink);
  font: inherit;
  font-size: 16px;
}
.study-form [role="alert"] {
  color: var(--danger);
}
@media (max-width: 540px) {
  .study-page {
    padding: 18px 16px;
  }
  .study-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .study-controls {
    gap: 8px;
    flex-wrap: wrap;
  }
  .study-search {
    flex-basis: 100%;
  }
  .study-actions {
    gap: 5px;
  }
  .review-card {
    height: min(58dvh, 500px);
  }
  .review-content {
    padding: 18px;
  }
  .review-content p {
    font-size: 16px;
  }
}

.study-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-block: 16px;
  margin-block: 0;
}
.study-heading,
.study-controls,
.study-topics,
.study-filter-status,
.study-navigation,
.study-import,
.study-note {
  flex-shrink: 0;
}
.review-card {
  flex: 1;
  min-height: 0;
  height: auto;
  max-height: 620px;
}
.study-topics {
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 44px;
  max-height: 44px;
  margin-block: 10px;
}
.study-topics button {
  flex-shrink: 0;
  white-space: nowrap;
}
.study-search input:focus-visible {
  outline: none;
}
@media (max-width: 540px) {
  .study-page {
    padding: 10px 16px;
  }
  .study-heading {
    flex-direction: row;
    align-items: center;
    margin-bottom: 12px;
    gap: 8px;
  }
  .study-heading h1 {
    font-size: 23px;
  }
  .study-heading p,
  .study-action-label,
  .study-result-label,
  .study-note {
    display: none;
  }
  .study-actions .toolbar-button {
    min-width: 42px;
    min-height: 40px;
    padding: 9px;
    justify-content: center;
  }
  .study-controls {
    flex-wrap: nowrap;
  }
  .study-controls .study-search {
    flex-basis: auto;
  }
  .study-controls > .toolbar-button {
    padding: 9px;
    min-height: 44px;
    flex-shrink: 0;
    gap: 5px;
  }
  .review-card {
    height: auto;
    max-height: none;
  }
  .review-card header {
    padding: 10px 16px;
  }
  .review-card footer {
    padding: 4px 12px;
  }
  .review-content {
    padding: 14px 16px;
  }
  .review-content h2 {
    margin-bottom: 12px;
  }
  .study-navigation {
    margin: 5px 0 0;
    gap: 16px;
  }
  .study-filter-status {
    font-size: 11px;
    margin-bottom: 8px;
  }
}
</style>
