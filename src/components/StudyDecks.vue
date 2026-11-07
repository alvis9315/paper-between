<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Layers,
  Plus,
  Search,
  SquarePen,
  Trash2,
  ArrowUpRight,
} from "@lucide/vue";
import type { ReviewDeck, ReviewCard } from "../core/model";
import IconAction from "./IconAction.vue";
import ModalShell from "./ModalShell.vue";
const props = defineProps<{
  decks: ReviewDeck[];
  cards: ReviewCard[];
  busy: boolean;
}>();
const emit = defineEmits<{
  open: [id: string];
  create: [title: string];
  rename: [id: string, title: string];
  remove: [id: string];
}>();
const query = ref(""),
  editing = ref<ReviewDeck>(),
  formOpen = ref(false),
  title = ref(""),
  error = ref(""),
  removing = ref<ReviewDeck>();
const visible = computed(() =>
  props.decks.filter((d) =>
    d.title
      .normalize("NFKC")
      .toLocaleLowerCase()
      .includes(query.value.normalize("NFKC").trim().toLocaleLowerCase()),
  ),
);
function deckCards(id: string) {
  return props.cards.filter((c) => c.deckId === id);
}
function edit(deck?: ReviewDeck) {
  editing.value = deck;
  title.value = deck?.title || "";
  error.value = "";
  formOpen.value = true;
}
function save() {
  const value = title.value.trim();
  if (!value) {
    error.value = "請輸入卡組名稱。";
    return;
  }
  if (
    props.decks.some((d) => d.id !== editing.value?.id && d.title === value)
  ) {
    error.value = "已有同名卡組，請換個名稱。";
    return;
  }
  if (editing.value) emit("rename", editing.value.id, value);
  else emit("create", value);
  formOpen.value = false;
}
</script>
<template>
  <main class="study-decks" aria-label="小卡組管理">
    <div class="deck-heading">
      <h1>
        我的小卡組 <small>{{ decks.length }}</small>
      </h1>
      <button
        class="toolbar-button"
        :disabled="busy || decks.length >= 200"
        @click="edit()"
      >
        <Plus :size="19" />新增卡組
      </button>
    </div>
    <label class="deck-search"
      ><Search :size="20" /><input
        v-model="query"
        type="search"
        aria-label="搜尋卡組"
        placeholder="搜尋卡組名稱…"
    /></label>
    <div v-if="!decks.length" class="deck-empty">
      <Layers :size="36" />
      <p>建立第一組小卡</p>
      <button class="toolbar-button" :disabled="busy" @click="edit()">
        <Plus :size="18" />新增卡組
      </button>
    </div>
    <p v-else-if="!visible.length" class="deck-empty">沒有符合的卡組</p>
    <div v-else class="deck-grid">
      <article v-for="deck in visible" :key="deck.id" class="deck-tile">
        <button
          class="deck-open"
          :aria-label="`開啟卡組：${deck.title}`"
          :disabled="busy"
          @click="emit('open', deck.id)"
        >
          <span class="deck-stack" aria-hidden="true"
            ><Layers :size="26" /><ArrowUpRight
              class="deck-open-arrow"
              :size="20"
          /></span>
          <strong>{{ deck.title }}</strong
          ><span class="deck-meta"
            >{{ deckCards(deck.id).length }} 張小卡
            <span v-if="deckCards(deck.id).some((c) => c.favorite)">
              ·
              {{ deckCards(deck.id).filter((c) => c.favorite).length }}
              張收藏</span
            ></span
          >
        </button>
        <div class="deck-actions">
          <IconAction
            :icon="SquarePen"
            label="重新命名卡組"
            :disabled="busy"
            @click="edit(deck)"
          /><IconAction
            :icon="Trash2"
            label="刪除卡組"
            :disabled="busy"
            @click="removing = deck"
          />
        </div>
      </article>
    </div>
  </main>
  <ModalShell
    v-if="formOpen"
    :title="editing ? '重新命名卡組' : '新增卡組'"
    @close="formOpen = false"
    ><form class="deck-form" @submit.prevent="save">
      <label
        >卡組名稱<input
          v-model="title"
          aria-label="卡組名稱"
          maxlength="120"
          placeholder="例如：企業網路、資料庫"
      /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button class="import-button">
        {{ editing ? "儲存名稱" : "建立卡組" }}
      </button>
    </form></ModalShell
  >
  <ModalShell v-if="removing" title="刪除卡組" @close="removing = undefined"
    ><p>
      刪除「{{ removing.title }}」及其中
      {{ deckCards(removing.id).length }}
      張小卡？此操作無法復原，來源筆記仍會保留。
    </p>
    <div class="deck-confirm">
      <button class="toolbar-button" @click="removing = undefined">取消</button
      ><button
        class="import-button"
        @click="
          emit('remove', removing.id);
          removing = undefined;
        "
      >
        刪除卡組與小卡
      </button>
    </div></ModalShell
  >
</template>
<style scoped>
.study-decks {
  width: 100%;
  max-width: none;
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px var(--workspace-gutter) 32px;
  color: var(--ink);
}
.deck-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.deck-heading h1 {
  font-size: 24px;
  margin: 0;
  font-weight: 600;
}
.deck-heading small {
  font-size: 13px;
  color: var(--muted);
  font-weight: 400;
  margin-left: 8px;
}
.deck-search {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 14px;
  background: var(--field);
  min-height: 46px;
  max-width: 560px;
  margin-bottom: 24px;
  color: var(--muted);
}
.deck-search:focus-within {
  border-color: var(--accent-ink);
  box-shadow: 0 0 0 3px var(--focus-soft);
}
.deck-search input {
  width: 100%;
  min-width: 0;
  font-size: 16px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--ink);
}
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 24px;
}
.deck-tile {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  min-width: 0;
  box-shadow: 0 5px 16px #392b2010;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.deck-open {
  display: flex;
  flex-direction: column;
  text-align: left;
  width: 100%;
  padding: 24px;
  gap: 12px;
  min-height: 240px;
  border-radius: 16px;
  color: var(--ink);
  background: transparent;
}
.deck-stack {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 90px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  color: var(--accent-ink);
  box-shadow:
    0 5px 0 -1px var(--field),
    0 6px 0 var(--border);
  margin-bottom: 8px;
  transition: transform 0.2s;
}
.deck-open strong {
  font-size: 21px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.deck-meta {
  font-size: 13px;
  color: var(--muted);
}
.deck-open-arrow {
  opacity: 0;
  transition: opacity 0.2s;
}
.deck-actions {
  display: flex;
  justify-content: space-evenly;
  border-top: 1px solid var(--border);
  padding: 8px 14px;
}
.deck-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 16px;
  color: var(--muted);
}
.deck-empty p {
  margin: 0;
}
.deck-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.deck-form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.deck-form input {
  font-size: 16px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field);
  color: var(--ink);
  min-width: 0;
}
.deck-confirm {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}
@media (hover: hover) {
  .deck-tile:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px #392b2020;
  }
  .deck-open:hover .deck-stack {
    transform: translateY(-3px) rotate(-1deg);
  }
  .deck-open:hover .deck-open-arrow {
    opacity: 1;
  }
}
@media (max-width: 600px) {
  .study-decks {
    padding-top: 12px;
  }
  .deck-heading h1 {
    font-size: 21px;
  }
  .deck-heading .toolbar-button {
    padding: 9px 12px;
  }
  .deck-grid {
    gap: 18px;
  }
  .deck-open {
    min-height: 205px;
    padding: 20px;
  }
  .deck-search {
    max-width: none;
  }
  .deck-stack {
    min-height: 70px;
  }
  .deck-confirm {
    flex-wrap: wrap;
  }
}
@media (prefers-reduced-motion: reduce) {
  .deck-tile,
  .deck-stack,
  .deck-open-arrow {
    transition: none;
  }
  .deck-tile:hover,
  .deck-open:hover .deck-stack {
    transform: none;
  }
}
</style>
