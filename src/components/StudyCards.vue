<script setup lang="ts">
import {
  computed,
  nextTick,
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
  Star,
  Type,
  Menu,
  Upload,
  Info,
  Grid2X2,
  Search,
  X,
  ZoomIn,
  FileText,
  Zap,
} from "@lucide/vue";
import IconAction from "./IconAction.vue";
import ChoiceSelect from "./ChoiceSelect.vue";
import ModalShell from "./ModalShell.vue";
import { cardsFromBook, MAX_REVIEW_CARDS } from "../core/reviewCards";
import { mediaUrl, cleanupPending } from "../core/media";
import {
  answerHtml,
  highlightCardHtml,
  normalizeCardSearch,
} from "../core/cardContent";
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
const preferenceKey = "paper-between-card-view";
let saved: { selected?: string; font?: number } = {};
try {
  saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}") || {};
} catch {
  /* Reading works without storage. */
}
const selectedId = ref(
  typeof saved.selected === "string" ? saved.selected : "",
);
const font = ref([17, 19, 21].includes(saved.font || 0) ? saved.font! : 17);
const fontLabel = computed(
  () => ({ 17: "標準", 19: "較大", 21: "最大" })[font.value],
);
const media = window.matchMedia("(max-width: 900px)");
const mobile = ref(media.matches);
const draftQuery = ref(""),
  query = ref(""),
  topic = ref(""),
  sourceFilter = ref(""),
  sectionFilter = ref("");
const favoritesOnly = ref(false),
  showResults = ref(false),
  showTags = ref(false),
  showHelp = ref(false),
  showSource = ref(false),
  showImage = ref(false);
const showGenerate = ref(false),
  showEdit = ref(false),
  deleteOpen = ref(false),
  importing = ref(false),
  importError = ref("");
const resultLimit = ref(60),
  imageZoom = ref("1");
const searchInput = ref<HTMLInputElement>(),
  deckInput = ref<HTMLInputElement>(),
  tools = ref<HTMLElement>(),
  content = ref<HTMLElement>(),
  resultList = ref<HTMLElement>();
const editing = shallowRef<ReviewCard>();
const title = ref(""),
  body = ref(""),
  tags = ref(""),
  summary = ref(""),
  error = ref("");
const kindLabel = {
  review: "觀念整理",
  past: "考古題",
  practice: "練習題",
  glossary: "名詞對照",
};
const tokens = computed(() =>
  query.value.trim().split(/\s+/).map(normalizeCardSearch).filter(Boolean),
);
const indexed = computed(() =>
  props.cards.map((card, order) => ({
    card,
    order,
    title: normalizeCardSearch(card.title),
    tags: normalizeCardSearch(
      [...card.tags, card.section || "", ...(card.keywords || [])].join(" "),
    ),
    summary: normalizeCardSearch(card.summary || ""),
    all: normalizeCardSearch(
      [
        card.title,
        card.body,
        card.summary,
        card.context,
        card.sourceTitle,
        card.section,
        ...card.tags,
        ...(card.keywords || []),
      ].join(" "),
    ),
  })),
);
const base = computed(() =>
  indexed.value.filter(
    ({ card, all }) =>
      (!sourceFilter.value || card.sourceTitle === sourceFilter.value) &&
      (!favoritesOnly.value || card.favorite) &&
      tokens.value.every((t) => all.includes(t)),
  ),
);
const filtered = computed(() =>
  base.value
    .filter(
      ({ card }) =>
        (!topic.value || card.tags.includes(topic.value)) &&
        (!sectionFilter.value || card.section === sectionFilter.value),
    )
    .map((item) => ({
      ...item,
      score: tokens.value.reduce(
        (n, t) =>
          n +
          (item.title.includes(t) ? 90 : 0) +
          (item.tags.includes(t) ? 35 : 0) +
          (item.summary.includes(t) ? 20 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((x) => x.card),
);
const current = computed(
  () =>
    filtered.value.find((c) => c.id === selectedId.value) || filtered.value[0],
);
const index = computed(() =>
  Math.max(
    0,
    filtered.value.findIndex((c) => c.id === current.value?.id),
  ),
);
const sourceGroups = computed(() => [
  ...new Set(props.cards.map((c) => c.sourceTitle)),
]);
const topics = computed(() =>
  [...new Set(props.cards.flatMap((c) => c.tags))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  ),
);
const visibleTopics = computed(() =>
  topics.value.filter(
    (tag) =>
      base.value.some(({ card }) => card.tags.includes(tag)) ||
      topic.value === tag,
  ),
);
const favoriteCount = computed(
  () => props.cards.filter((c) => c.favorite).length,
);
const hasFilter = computed(
  () =>
    !!(
      query.value ||
      topic.value ||
      sourceFilter.value ||
      sectionFilter.value ||
      favoritesOnly.value
    ),
);
const related = computed(() =>
  current.value
    ? props.cards
        .filter(
          (c) =>
            c.id !== current.value!.id &&
            c.kind !== "glossary" &&
            c.tags.some((t) => current.value!.tags.includes(t)),
        )
        .sort(
          (a, b) =>
            Number(b.sourceTitle !== current.value!.sourceTitle) -
            Number(a.sourceTitle !== current.value!.sourceTitle),
        )
        .slice(0, 3)
    : [],
);
const highlightedAnswer = computed(() =>
  current.value ? answerHtml(current.value, query.value) : "",
);
const imageUrl = ref(""),
  imageError = ref("");
const sources = computed(() => props.books.filter((b) => !b.deletedAt));
const sourceAvailable = computed(
  () =>
    !!current.value?.sourceBookId &&
    sources.value.some((b) => b.document.id === current.value!.sourceBookId),
);
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
function topicCount(tag: string) {
  return base.value.filter(({ card }) => card.tags.includes(tag)).length;
}
function sourceCount(name: string) {
  return props.cards.filter((c) => c.sourceTitle === name).length;
}
function highlight(text: string) {
  const node = document.createElement("span");
  node.textContent = text;
  return highlightCardHtml(node.innerHTML, query.value);
}
function snippet(card: ReviewCard) {
  const text = card.summary || card.body;
  const match = query.value
    .trim()
    .split(/\s+/)
    .find((t) => card.body.toLocaleLowerCase().includes(t.toLocaleLowerCase()));
  if (match && !text.toLocaleLowerCase().includes(match.toLocaleLowerCase())) {
    const start = Math.max(
      0,
      card.body.toLocaleLowerCase().indexOf(match.toLocaleLowerCase()) - 24,
    );
    return `${start ? "…" : ""}${card.body.slice(start, start + 115)}`;
  }
  return text.slice(0, 115);
}
function persistView() {
  try {
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({ selected: current.value?.id, font: font.value }),
    );
  } catch {
    /* Optional preference. */
  }
}
watch([font, () => current.value?.id], async () => {
  persistView();
  await nextTick();
  if (content.value) content.value.scrollTop = 0;
});
watch(
  () => current.value?.image?.mediaId,
  async (id) => {
    imageUrl.value = "";
    imageError.value = "";
    if (id)
      try {
        const url = await mediaUrl(id);
        if (current.value?.image?.mediaId === id) imageUrl.value = url;
      } catch {
        imageError.value = "題圖遺失，請從 ZIP 備份還原。";
      }
  },
  { immediate: true },
);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const composing = ref(false);
function applySearch() {
  clearTimeout(searchTimer);
  query.value = draftQuery.value;
}
function inputSearch(e: Event) {
  if (composing.value || (e as InputEvent).isComposing) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applySearch, 120);
}
function clearSearch() {
  draftQuery.value = "";
  query.value = "";
  searchInput.value?.focus();
}
function reset() {
  clearTimeout(searchTimer);
  draftQuery.value = "";
  query.value = "";
  topic.value = "";
  sectionFilter.value = "";
  sourceFilter.value = "";
  favoritesOnly.value = false;
}
watch([query, topic, sourceFilter, sectionFilter, favoritesOnly], () => {
  selectedId.value = filtered.value[0]?.id || "";
  resultLimit.value = 60;
  if (mobile.value) showResults.value = true;
});
function closeTools() {
  if (mobile.value) tools.value?.hidePopover();
}
function selectTopic(tag: string) {
  sectionFilter.value = "";
  topic.value = topic.value === tag ? "" : tag;
  showTags.value = false;
}
function selectSource(name: string) {
  sourceFilter.value = name;
  sectionFilter.value = "";
  if (
    topic.value &&
    !props.cards.some(
      (c) => (!name || c.sourceTitle === name) && c.tags.includes(topic.value),
    )
  )
    topic.value = "";
}
function selectSection(section: string, group: string) {
  topic.value = "";
  sourceFilter.value = group;
  sectionFilter.value = section;
  showTags.value = false;
}
function choose(card: ReviewCard) {
  selectedId.value = card.id;
  showResults.value = false;
  searchInput.value?.blur();
}
async function chooseRelated(card: ReviewCard) {
  reset();
  await nextTick();
  choose(card);
}
function move(delta: number) {
  const card = filtered.value[index.value + delta];
  if (card) choose(card);
}
function toggleFavorite() {
  if (current.value)
    emit("save", {
      ...current.value,
      favorite: !current.value.favorite,
      updatedAt: Date.now(),
    });
}
function edit(card?: ReviewCard) {
  closeTools();
  editing.value = card;
  title.value = card?.title || "";
  body.value = card?.body || "";
  tags.value = card?.tags.join("，") || "";
  summary.value = card?.summary || "";
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
  const card: ReviewCard = {
    ...editing.value,
    id: editing.value?.id || crypto.randomUUID(),
    title: title.value.trim(),
    body: body.value.trim(),
    tags: parsedTags,
    summary: summary.value.trim(),
    answerHtml:
      editing.value?.body === body.value.trim()
        ? editing.value.answerHtml
        : undefined,
    sourceTitle: editing.value?.sourceTitle || "自建小卡",
    createdAt: editing.value?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  emit("save", card);
  selectedId.value = card.id;
  showEdit.value = false;
  showResults.value = false;
}
async function generate() {
  if (props.cards.length + generated.value.length > MAX_REVIEW_CARDS) {
    error.value = "超過 2000 張小卡，請改用重點摘錄或先整理。";
    return;
  }
  const fresh = generated.value;
  emit("add", fresh);
  reset();
  await nextTick();
  selectedId.value = fresh[0]?.id || "";
  showGenerate.value = false;
  showResults.value = false;
}
function generateDialog() {
  closeTools();
  error.value = "";
  showGenerate.value = true;
}
function pickDeck() {
  closeTools();
  deckInput.value?.click();
}
async function loadDeck(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file || props.busy || importing.value) return;
  importing.value = true;
  try {
    const { importCardDeck } = await import("../core/cardImport");
    const cards = await importCardDeck(file);
    const keys = new Set(props.cards.map((c) => c.sourceKey));
    const fresh = cards.filter((c) => !keys.has(c.sourceKey));
    if (props.cards.length + fresh.length > MAX_REVIEW_CARDS)
      throw new Error("加入後會超過 2000 張小卡，請先整理或分批匯入。");
    emit("add", fresh);
    if (fresh.length) {
      reset();
      await nextTick();
      selectedId.value = fresh[0]!.id;
      showResults.value = false;
    }
  } catch (e) {
    importError.value =
      e instanceof Error ? e.message : "無法讀取這份小卡，原有資料已保留。";
    cleanupPending(
      props.books.map((b) => b.document),
      props.cards.flatMap((c) => (c.image ? [c.image.mediaId] : [])),
    );
  } finally {
    importing.value = false;
    input.value = "";
  }
}
function cycleFont() {
  font.value = font.value === 17 ? 19 : font.value === 19 ? 21 : 17;
}
function resized(event: MediaQueryListEvent) {
  mobile.value = event.matches;
  showResults.value = false;
}
function keys(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (
    document.querySelector("dialog[open]") ||
    target.closest("[popover]:popover-open")
  )
    return;
  if (
    ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
    (e.key === "/" && !target.closest("input,textarea,[contenteditable]"))
  ) {
    e.preventDefault();
    searchInput.value?.focus();
    return;
  }
  if (
    target.closest(
      'input,textarea,dialog,[role="combobox"],.card-table-scroll',
    ) ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    window.getSelection()?.toString() ||
    (mobile.value && showResults.value)
  )
    return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    move(e.key === "ArrowRight" ? 1 : -1);
  }
}
let touch: { x: number; y: number; time: number } | undefined;
function touchStart(e: TouchEvent) {
  touch = undefined;
  if (
    e.touches.length === 1 &&
    !(e.target as HTMLElement).closest("button,input,.card-table-scroll") &&
    !window.getSelection()?.toString()
  )
    touch = {
      x: e.touches[0]!.clientX,
      y: e.touches[0]!.clientY,
      time: Date.now(),
    };
}
function touchEnd(e: TouchEvent) {
  if (!touch) return;
  const point = e.changedTouches[0],
    dx = point ? point.clientX - touch.x : 0,
    dy = point ? point.clientY - touch.y : 0;
  if (
    Math.abs(dx) > 60 &&
    Math.abs(dx) > Math.abs(dy) * 1.6 &&
    Date.now() - touch.time < 700 &&
    !window.getSelection()?.toString()
  )
    move(dx < 0 ? 1 : -1);
  touch = undefined;
}
onMounted(() => {
  window.addEventListener("keydown", keys);
  media.addEventListener("change", resized);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keys);
  media.removeEventListener("change", resized);
  clearTimeout(searchTimer);
});
</script>

<template>
  <main
    class="study-page"
    :style="{ '--card-font-size': `${font}px` }"
    :aria-busy="importing"
  >
    <h1 class="visually-hidden">考前小卡</h1>
    <input
      id="card-deck-file"
      ref="deckInput"
      class="visually-hidden"
      type="file"
      accept=".html,.htm,.json,text/html,application/json"
      aria-label="選擇小卡 HTML 或 JSON"
      @change="loadDeck"
    />
    <div class="study-controls">
      <label class="study-search"
        ><Search :size="20" /><input
          ref="searchInput"
          v-model="draftQuery"
          aria-label="搜尋小卡"
          placeholder="搜尋關鍵字、縮寫或題目…"
          maxlength="240"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          @input="inputSearch"
          @compositionstart="composing = true"
          @compositionend="
            composing = false;
            applySearch();
          "
          @keydown.enter="
            if (!$event.isComposing) {
              applySearch();
              searchInput?.blur();
            }
          "
          @keydown.esc="
            clearSearch();
            searchInput?.blur();
          "
        /><button
          v-if="draftQuery"
          class="icon-button"
          aria-label="清除小卡搜尋"
          @click="clearSearch"
        >
          <X :size="17" /></button
        ><kbd v-else class="study-search-key" aria-hidden="true">/</kbd></label
      >
      <IconAction
        v-if="mobile"
        compact
        :icon="Menu"
        label="小卡操作選單"
        @click="
          searchInput?.blur();
          tools?.togglePopover();
        "
      />
      <div
        ref="tools"
        class="study-tools"
        :popover="mobile ? 'auto' : undefined"
        role="group"
        aria-label="小卡操作"
      >
        <button
          class="study-font"
          :aria-label="`調整閱讀字級，目前${fontLabel}`"
          @click="cycleFont"
        >
          <Type :size="19" /><span>{{ fontLabel }}</span>
        </button>
        <IconAction
          v-if="cards.length"
          :compact="!mobile"
          :icon="Upload"
          label="匯入小卡 HTML／JSON"
          touch-label="匯入小卡"
          :disabled="busy || importing"
          @click="pickDeck"
        />
        <IconAction
          :compact="!mobile"
          :icon="Plus"
          label="新增小卡"
          :disabled="busy || importing"
          @click="edit()"
        />
        <IconAction
          v-if="cards.length"
          :compact="!mobile"
          :icon="Layers"
          label="從筆記建立"
          :disabled="busy || importing"
          @click="generateDialog"
        />
        <IconAction
          :compact="!mobile"
          :icon="Info"
          label="小卡使用說明"
          @click="
            closeTools();
            showHelp = true;
          "
        />
      </div>
    </div>
    <template v-if="cards.length">
      <div class="study-filter-row">
        <div class="study-source-tabs" role="group" aria-label="小卡資料來源">
          <button
            :aria-pressed="!sourceFilter"
            aria-label="全部來源"
            @click="selectSource('')"
          >
            全部 <small>{{ cards.length }}</small>
          </button>
          <button
            v-for="name in sourceGroups"
            :key="name"
            :aria-pressed="sourceFilter === name"
            :aria-label="`來源：${name}`"
            @click="selectSource(name)"
          >
            <span>{{ name }}</span
            ><small>{{ sourceCount(name) }}</small>
          </button>
        </div>
        <button
          class="study-favorites"
          aria-label="只看收藏小卡"
          :aria-pressed="favoritesOnly"
          @click="favoritesOnly = !favoritesOnly"
        >
          <Star :size="16" />收藏 <small>{{ favoriteCount }}</small>
        </button>
      </div>
      <div class="study-topic-row">
        <div class="study-topics" role="group" aria-label="小卡主題標籤">
          <button
            :aria-pressed="!topic && !sectionFilter"
            :aria-label="`全部小卡 ${cards.length}`"
            @click="
              topic = '';
              sectionFilter = '';
            "
          >
            全部 <small>{{ base.length }}</small>
          </button>
          <button
            v-for="tag in visibleTopics"
            :key="tag"
            :aria-pressed="topic === tag"
            :aria-label="`# ${tag}`"
            @click="selectTopic(tag)"
          >
            <span># {{ tag }}</span
            ><small>{{ topicCount(tag) }}</small>
          </button>
        </div>
        <IconAction
          compact
          :icon="Grid2X2"
          label="全部小卡標籤"
          @click="showTags = true"
        />
      </div>
    </template>
    <p class="visually-hidden study-filter-status" role="status">
      {{ filtered.length }} 張相關小卡{{
        sectionFilter || topic ? `，${sectionFilter || topic}` : ""
      }}
    </p>
    <div v-if="importing" class="study-loading" role="status">
      正在匯入小卡…
    </div>
    <div v-if="!cards.length" class="study-empty">
      <Layers :size="32" />
      <h2>還沒有小卡</h2>
      <div class="study-empty-actions">
        <button
          class="import-button"
          :disabled="busy || importing"
          @click="pickDeck"
        >
          <Upload :size="17" />匯入小卡</button
        ><button
          class="toolbar-button"
          :disabled="busy || importing"
          @click="generateDialog"
        >
          從筆記建立
        </button>
      </div>
    </div>
    <div
      v-else
      class="study-workspace"
      :class="{ 'mobile-list-view': showResults }"
    >
      <aside class="study-results" aria-label="小卡搜尋結果">
        <header class="study-list-heading">
          <span
            >{{ query ? "搜尋結果" : sectionFilter || topic || "題目清單" }}
            <small>{{ filtered.length }} 張</small></span
          ><button v-if="hasFilter" class="study-text-button" @click="reset">
            重設</button
          ><button
            class="study-mobile-back study-text-button"
            :disabled="!current"
            @click="
              showResults = false;
              searchInput?.blur();
            "
          >
            <ChevronLeft :size="15" />回卡片
          </button>
        </header>
        <div ref="resultList" class="study-result-list">
          <button
            v-for="card in filtered.slice(0, resultLimit)"
            :key="card.id"
            :aria-current="card.id === current?.id ? 'true' : undefined"
            @click="choose(card)"
          >
            <span class="study-result-meta"
              ><span v-if="card.kind" class="study-kind" :class="card.kind">{{
                kindLabel[card.kind]
              }}</span
              ><span>{{ card.sourceTitle }}</span
              ><Star v-if="card.favorite" :size="12" class="saved-star" /></span
            ><strong v-html="highlight(card.title)"></strong
            ><span
              class="study-result-snippet"
              v-html="highlight(snippet(card))"
            ></span>
          </button>
          <button
            v-if="filtered.length > resultLimit"
            class="study-load-more"
            @click="resultLimit += 60"
          >
            顯示更多小卡（還有 {{ filtered.length - resultLimit }} 張）
          </button>
          <div v-if="!filtered.length" class="study-no-results">
            <Search :size="25" />
            <p>沒有符合的小卡</p>
            <button class="study-text-button" @click="reset">清除篩選</button>
          </div>
        </div>
      </aside>
      <section class="study-reader" aria-label="閱讀小卡">
        <button
          class="study-mobile-results"
          :aria-label="`${hasFilter ? '相關' : '全部'}小卡 ${filtered.length}`"
          @click="showResults = true"
        >
          <List :size="17" /><span>{{
            query ? "搜尋結果" : sectionFilter || topic || "題目清單"
          }}</span
          ><small>{{ filtered.length }} 張</small><ChevronRight :size="16" />
        </button>
        <article
          v-if="current"
          class="review-card"
          :data-card-id="current.id"
          aria-label="目前小卡"
          @touchstart.passive="touchStart"
          @touchend.passive="touchEnd"
          @touchcancel="touch = undefined"
        >
          <div class="study-card-toolbar">
            <span class="study-card-label">{{
              current.kind
                ? kindLabel[current.kind]
                : current.section || current.tags[0] || current.sourceTitle
            }}</span>
            <div class="study-card-actions">
              <IconAction
                compact
                :icon="Star"
                :label="current.favorite ? '取消收藏這張小卡' : '收藏這張小卡'"
                :aria-pressed="!!current.favorite"
                :class="{ 'is-favorite': current.favorite }"
                :disabled="busy || importing"
                @click="toggleFavorite"
              /><IconAction
                compact
                :icon="SquarePen"
                label="編輯小卡"
                :disabled="busy || importing"
                @click="edit(current)"
              /><IconAction
                compact
                :icon="Trash2"
                label="刪除小卡"
                danger
                :disabled="busy || importing"
                @click="deleteOpen = true"
              />
            </div>
          </div>
          <div
            ref="content"
            class="review-content"
            tabindex="0"
            aria-label="小卡內容閱讀區"
          >
            <h2 v-html="highlight(current.title)"></h2>
            <div v-if="current.tags.length" class="study-card-tags">
              <button
                v-for="tag in current.tags"
                :key="tag"
                :aria-label="`主題：${tag}`"
                @click="selectTopic(tag)"
              >
                # {{ tag }}
              </button>
            </div>
            <section v-if="current.summary" class="study-quick-answer">
              <span><Zap :size="13" />速答</span>
              <div v-html="highlight(current.summary)"></div>
            </section>
            <p v-if="current.context" class="study-context">
              {{ current.context }}
            </p>
            <button
              v-if="imageUrl"
              class="study-diagram"
              aria-label="放大小卡題圖"
              @click="
                imageZoom = '1';
                showImage = true;
              "
            >
              <img :src="imageUrl" :alt="current.image?.alt || '原題圖'" /><span
                ><ZoomIn :size="14" />原題圖</span
              >
            </button>
            <p v-if="imageError" class="study-image-error" role="alert">
              {{ imageError }}
            </p>
            <h3 v-if="current.summary" class="study-answer-label">
              {{ current.kind === "glossary" ? "完整名詞對照" : "完整內容" }}
            </h3>
            <div
              class="review-answer"
              :class="{ 'plain-answer': !current.answerHtml }"
              v-html="highlightedAnswer"
            ></div>
            <div
              v-if="current.sourcePages?.length || current.sourceBookId"
              class="study-card-source"
            >
              <span
                >{{ current.sourceTitle
                }}<template v-if="current.sourcePages?.length">
                  · 第
                  {{ current.sourcePages.map((p) => p.page).join("、") }}
                  頁</template
                ></span
              ><button
                class="study-text-button"
                aria-label="查看小卡來源"
                @click="showSource = true"
              >
                <FileText :size="15" />原文對照
              </button>
            </div>
            <div v-if="related.length" class="study-related">
              <span>相關小卡</span>
              <div>
                <button
                  v-for="card in related"
                  :key="card.id"
                  @click="chooseRelated(card)"
                >
                  {{ card.title }}
                </button>
              </div>
            </div>
          </div>
          <nav class="study-navigation" aria-label="小卡分頁">
            <button
              :disabled="index === 0"
              aria-label="上一張小卡"
              @click="move(-1)"
            >
              <ChevronLeft :size="18" /><span>上一張</span></button
            ><span aria-live="polite"
              >{{ index + 1 }} / {{ filtered.length }}</span
            ><button
              :disabled="index + 1 >= filtered.length"
              aria-label="下一張小卡"
              @click="move(1)"
            >
              <span>下一張</span><ChevronRight :size="18" />
            </button>
          </nav>
        </article>
        <div v-else class="study-no-results">
          <Search :size="28" />
          <h2>沒有符合的小卡</h2>
          <button class="toolbar-button" @click="reset">清除篩選</button>
        </div>
      </section>
    </div>
  </main>
  <ModalShell v-if="showTags" title="全部小卡標籤" @close="showTags = false"
    ><div class="study-tag-panel">
      <h3>主題</h3>
      <div class="study-tag-grid">
        <button
          v-for="tag in topics"
          :key="tag"
          :aria-pressed="topic === tag"
          @click="selectTopic(tag)"
        >
          # {{ tag }} <small>{{ topicCount(tag) }}</small>
        </button>
      </div>
      <section v-for="group in sourceGroups" :key="group">
        <h3>{{ group }} · 章節</h3>
        <div class="study-tag-grid">
          <button
            v-for="section in [
              ...new Set(
                cards
                  .filter((c) => c.sourceTitle === group)
                  .map((c) => c.section)
                  .filter(Boolean),
              ),
            ]"
            :key="section"
            @click="selectSection(section!, group)"
          >
            {{ section }}
          </button>
        </div>
      </section>
    </div></ModalShell
  >
  <ModalShell v-if="showHelp" title="小卡使用說明" @close="showHelp = false"
    ><p>
      搜尋標題、答案、速答與縮寫；多個關鍵字以空白分隔。標籤、來源與收藏可以一起篩選。
    </p>
    <p>
      電腦左側選題、右側閱讀。手機搜尋後先顯示結果，點題目讀單張；左右滑動或箭頭切換同一組結果。
    </p>
    <p>
      Aa 字級有標準、較大、最大三種。題圖可放大，表格可以左右捲動。按 / 或
      ⌘K／Ctrl K 搜尋，方向鍵換卡。
    </p>
    <p>
      「匯入小卡」可讀取含 cards-data、sources-data、images-data 的小卡
      HTML，或相同結構的 JSON；不會執行檔案裡的程式。一般 PDF／Word
      請從「從筆記建立」匯入。
    </p>
    <p>
      收藏、內容與圖片保存在目前瀏覽器，完整書架 ZIP
      會帶入。換裝置仍需匯入備份；從原文拆出的卡片不是 AI 摘要，可自行校正。
    </p></ModalShell
  >
  <ModalShell
    v-if="showSource && current"
    title="原文對照"
    @close="showSource = false"
    ><div class="study-source-panel">
      <p>{{ current.sourceTitle }}</p>
      <p>以下為原頁文字；表格與圖形版面請以原檔為準。</p>
      <section
        v-for="sourcePage in current.sourcePages || []"
        :key="sourcePage.page"
      >
        <h3>第 {{ sourcePage.page }} 頁</h3>
        <pre>{{ sourcePage.text }}</pre>
      </section>
      <button
        v-if="sourceAvailable"
        class="toolbar-button"
        @click="
          showSource = false;
          emit('source', current.sourceBookId!);
        "
      >
        <BookOpen :size="17" />回到來源筆記
      </button>
    </div></ModalShell
  >
  <ModalShell
    v-if="showImage && current"
    title="原題圖"
    wide
    @close="showImage = false"
    ><div class="study-image-tools">
      <ChoiceSelect
        v-model="imageZoom"
        label="題圖縮放"
        :options="[
          { value: '1', label: '適中' },
          { value: '1.5', label: '150%' },
          { value: '2', label: '200%' },
        ]"
      />
    </div>
    <div class="study-image-scroll">
      <img
        :src="imageUrl"
        :alt="current.image?.alt || '原題圖'"
        :style="
          imageZoom === '1'
            ? { maxWidth: '100%' }
            : {
                maxWidth: 'none',
                width: `${(current.image?.width || 1000) * Number(imageZoom)}px`,
              }
        "
      /></div
  ></ModalShell>
  <ModalShell v-if="importError" title="無法匯入小卡" @close="importError = ''"
    ><p role="alert">{{ importError }}</p>
    <p>原有小卡與筆記已保留。</p>
    <button
      class="import-button"
      @click="
        importError = '';
        pickDeck();
      "
    >
      重新選擇檔案
    </button></ModalShell
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
        >主題標籤<input
          v-model="tags"
          aria-label="小卡標籤"
          placeholder="以逗號分隔" /></label
      ><label
        >速答（選填）<textarea
          v-model="summary"
          rows="2"
          maxlength="500"
          aria-label="小卡速答"
        /></label
      ><label
        >完整內容<textarea
          v-model="body"
          rows="8"
          maxlength="6000"
          aria-label="小卡內容"
        />
      </label>
      <p v-if="editing?.answerHtml" class="study-edit-hint">
        修改完整內容會改用文字排版；只改標題、標籤或速答會保留原格式。
      </p>
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
      <p>依原文標題、段落或重點建立，內容可再校正。</p>
      <p v-if="source?.document.pdfAssetId">
        原頁文件尚未自動辨識主題；可先用圖文重排整理，再建立小卡。
      </p>
      <div class="study-import">
        <button
          class="toolbar-button"
          :disabled="busy || importing"
          @click="
            showGenerate = false;
            emit('import', 'word');
          "
        >
          匯入 Word</button
        ><button
          class="toolbar-button"
          :disabled="busy || importing"
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
<style scoped src="../study.css"></style>
