<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import IconAction from "./IconAction.vue";
import {
  ArchiveRestore,
  Copy,
  Download,
  RotateCcw,
  SquarePen,
  Trash2,
} from "@lucide/vue";
import type { BookRecord } from "../core/model";
const props = defineProps<{
  books: BookRecord[];
  activeId?: string;
  busy: boolean;
}>();
const emit = defineEmits<{
  open: [id: string];
  create: [];
  importWord: [];
  importPdf: [];
  createRich: [];
  backup: [];
  backupOne: [id: string];
  restoreBackup: [];
  rename: [id: string, title: string];
  duplicate: [id: string];
  trash: [id: string];
  restore: [id: string];
  back: [];
}>();
const trash = ref(false);
const query = ref("");
const editing = ref<string>();
const renameValue = ref("");
const renameError = ref("");
const alive = computed(() => props.books.filter((b) => !b.deletedAt));
const deleted = computed(() => props.books.filter((b) => b.deletedAt));
const visible = computed(() =>
  (trash.value ? deleted.value : alive.value)
    .filter((b) =>
      b.document.title
        .toLocaleLowerCase()
        .includes(query.value.toLocaleLowerCase()),
    )
    .toSorted(
      (a, b) => (b.deletedAt || b.updatedAt) - (a.deletedAt || a.updatedAt),
    ),
);
function preview(b: BookRecord) {
  return b.document.blocks
    .filter((x) => x.kind !== "heading")
    .map((x) => x.text)
    .join(" ")
    .slice(0, 100);
}
function date(time: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(time);
}
function startRename(b: BookRecord) {
  editing.value = b.document.id;
  renameValue.value = b.document.title;
  renameError.value = "";
}
function rename(id: string) {
  if (!renameValue.value.trim()) {
    renameError.value = "請輸入筆記名稱。";
    return;
  }
  emit("rename", id, renameValue.value.trim());
  editing.value = undefined;
}
</script>
<template>
  <main class="bookshelf-page">
    <section class="shelf-heading">
      <div>
        <div class="eyebrow"><span></span> 你的私人藏書</div>
        <h1>我的書架</h1>
        <p>每一本筆記，都留著一段自己的思考。</p>
      </div>
      <button
        v-if="activeId"
        class="toolbar-button"
        :disabled="busy"
        @click="emit('back')"
      >
        <AppIcon name="book" />回到閱讀
      </button>
    </section>
    <div class="shelf-toolbar">
      <div class="shelf-primary-actions">
        <button class="import-button" :disabled="busy" @click="emit('create')">
          <AppIcon name="edit" :size="17" />新增筆記</button
        ><button
          class="toolbar-button"
          :disabled="busy"
          @click="emit('importWord')"
        >
          <AppIcon name="upload" />匯入 Word
        </button>
        <button
          class="toolbar-button"
          :disabled="busy"
          @click="emit('importPdf')"
        >
          <AppIcon name="file" />匯入 PDF
        </button>
        <button
          class="toolbar-button"
          :disabled="busy"
          @click="emit('createRich')"
        >
          <AppIcon name="image" />圖文筆記
        </button>
      </div>
      <div class="shelf-backup-actions">
        <button
          class="toolbar-button"
          :disabled="busy || !books.length"
          @click="emit('backup')"
        >
          <AppIcon name="download" :size="16" />備份書架</button
        ><button
          class="toolbar-button"
          :disabled="busy"
          @click="emit('restoreBackup')"
        >
          <ArchiveRestore
            :size="17"
            :stroke-width="1.7"
            aria-hidden="true"
          />匯入備份
        </button>
      </div>
    </div>
    <div class="shelf-filter">
      <div class="shelf-tabs">
        <button :class="{ active: !trash }" @click="trash = false">
          我的筆記 <span>{{ alive.length }}</span></button
        ><button :class="{ active: trash }" @click="trash = true">
          回收桶 <span>{{ deleted.length }}</span>
        </button>
      </div>
      <label class="shelf-search"
        ><AppIcon name="search" :size="16" /><input
          v-model="query"
          placeholder="搜尋筆記名稱"
          aria-label="搜尋筆記名稱"
      /></label>
    </div>
    <p v-if="trash" class="trash-hint">
      移到回收桶的筆記仍會保留，你可以隨時還原。
    </p>
    <section
      v-if="visible.length"
      class="shelf-grid"
      :aria-label="trash ? '回收桶筆記' : '我的筆記'"
    >
      <article
        v-for="(b, n) in visible"
        :key="b.document.id"
        class="book-card"
        :data-book-id="b.document.id"
        :class="{ 'recycled-book': trash }"
      >
        <button
          class="book-open"
          :aria-label="`閱讀《${b.document.title}》`"
          :disabled="busy || trash"
          @click="emit('open', b.document.id)"
        >
          <div class="mini-book" :class="`cover-${n % 3}`">
            <span class="mini-book-line"></span
            ><AppIcon name="book" :size="20" />
            <h2>{{ b.document.title }}</h2>
            <span class="mini-book-label">頁 白 · 閱 讀 筆 記</span>
          </div>
          <div class="book-card-content">
            <div
              class="card-current"
              v-if="b.document.id === activeId && !trash"
            >
              上次閱讀
            </div>
            <p class="book-preview">{{ preview(b) }}</p>
            <div class="book-progress">
              <div>
                <span
                  :style="{ width: `${Math.round(b.progress * 100)}%` }"
                ></span>
              </div>
              <span>{{ Math.round(b.progress * 100) }}%</span>
            </div>
            <p class="book-updated">
              {{ trash ? "移除於" : "更新於" }}
              {{ date(b.deletedAt || b.updatedAt) }}
            </p>
          </div>
        </button>
        <form
          v-if="editing === b.document.id"
          class="rename-form"
          @submit.prevent="rename(b.document.id)"
        >
          <input
            v-model="renameValue"
            aria-label="新的筆記名稱"
            maxlength="120"
          /><button type="submit">儲存</button
          ><button type="button" @click="editing = undefined">取消</button
          ><span v-if="renameError" role="alert">{{ renameError }}</span>
        </form>
        <div
          v-else
          class="book-card-actions"
          role="group"
          :aria-label="`《${b.document.title}》的筆記操作`"
        >
          <IconAction
            :icon="Download"
            label="備份此本"
            :disabled="busy"
            @click="emit('backupOne', b.document.id)"
          />
          <template v-if="!trash">
            <IconAction
              :icon="SquarePen"
              label="重新命名"
              :disabled="busy"
              @click="startRename(b)"
            />
            <IconAction
              :icon="Copy"
              label="複製"
              :disabled="busy"
              @click="emit('duplicate', b.document.id)"
            />
            <IconAction
              :icon="Trash2"
              label="移到回收桶"
              :disabled="busy"
              danger
              @click="emit('trash', b.document.id)"
            />
          </template>
          <IconAction
            v-else
            :icon="RotateCcw"
            label="還原筆記"
            :disabled="busy"
            @click="emit('restore', b.document.id)"
          />
        </div>
      </article>
    </section>
    <section v-else class="shelf-empty">
      <AppIcon :name="trash ? 'restore' : 'book'" :size="40" />
      <h2>
        {{
          query
            ? "找不到這本筆記"
            : trash
              ? "回收桶目前是空的"
              : "留一個位置，給新的想法。"
        }}
      </h2>
      <p>
        {{
          query
            ? "試試其他名稱，或清除搜尋。"
            : trash
              ? "移除的筆記會先保留在這裡。"
              : "這是你的空白書架。匯入 PDF、Word、書架備份，或自行新增圖文與文字筆記。"
        }}
      </p>
      <button
        v-if="!trash && !query"
        class="import-button"
        :disabled="busy"
        @click="emit('create')"
      >
        新增第一本筆記
      </button>
    </section>
    <p class="shelf-local-note">
      <AppIcon
        name="shield"
        :size="14"
      />書架儲存在這個瀏覽器。定期下載備份，讓想法多一份保存。
    </p>
  </main>
</template>
<style scoped>
.bookshelf-page {
  min-height: calc(100dvh - 160px);
  padding-bottom: 40px;
}
.shelf-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 29px;
}
.shelf-heading h1 {
  font:
    700 34px/1.5 "PMingLiU",
    serif;
  letter-spacing: 3px;
  color: var(--text-primary, #594535);
}
.shelf-heading p {
  font-size: 12px;
  color: var(--text-secondary, #9a8978);
  margin-top: 8px;
  letter-spacing: 1px;
}
.shelf-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 13px;
  background: var(--surface-raised, #f7f3ed);
  border: 1px solid var(--line, #ddd2c6);
  border-radius: 8px;
}
.shelf-primary-actions,
.shelf-backup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.shelf-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 29px 0 24px;
  border-bottom: 1px solid var(--line, #d8cfc3);
  padding-bottom: 12px;
}
.shelf-tabs {
  display: flex;
  gap: 20px;
}
.shelf-tabs button {
  background: transparent;
  color: var(--text-secondary, #a3917e);
  font-size: 13px;
  padding: 8px 0;
}
.shelf-tabs button.active {
  color: var(--text-primary, #775139);
  box-shadow: 0 2px var(--shadow-deep, #88634f);
  border-radius: 0;
}
.shelf-tabs button > span {
  font-size: 10px;
  background: var(--surface-panel, #e3d9cb);
  border-radius: 4px;
  padding: 2px 6px;
  margin-left: 5px;
}
.shelf-search {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary, #a18c77);
}
.shelf-search input {
  width: 160px;
  border: 0;
  background: transparent;
  font-size: 11px;
  color: var(--text-primary, #765e49);
  padding: 8px 0;
}
.shelf-search input::placeholder {
  color: var(--text-secondary, #ad9c8a);
}
.shelf-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 25px;
}
.book-card {
  border: 1px solid var(--line, #d9cebf);
  border-radius: 9px;
  background: var(--surface-raised, #f8f5ee);
  overflow: hidden;
  box-shadow: 0 4px 9px var(--shadow-soft, #67503908);
}
.book-open {
  display: block;
  width: 100%;
  background: transparent;
  text-align: left;
  padding: 18px 18px 0;
  color: var(--text-primary, #5d4939);
}
.book-open:disabled {
  opacity: 1;
}
.mini-book {
  height: 180px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px 20px 18px 30px;
  border-radius: 3px 6px 6px 3px;
  background: #cbb69f;
  border: 1px solid var(--line-strong, #bca489);
  box-shadow:
    3px 4px 0 var(--shadow-deep, #e9e1d4),
    4px 5px 0 var(--shadow-deep, #c4b8a8);
  isolation: isolate;
  overflow: hidden;
}
.cover-1 {
  background: #c9b5ab;
  border-color: var(--line-strong, #bca292);
}
.cover-2 {
  background: #c6c0b2;
  border-color: var(--line-strong, #b4ac9a);
}
.mini-book-line {
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #7b5b3930;
  box-shadow: 2px 0 var(--shadow-deep, #f0e5d33b);
}
.mini-book > svg {
  opacity: 0.6;
}
.mini-book h2 {
  font:
    700 22px/1.6 "PMingLiU",
    serif;
  letter-spacing: 1px;
  margin-top: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.mini-book-label {
  font-size: 8px;
  opacity: 0.6;
  letter-spacing: 1px;
  margin-top: auto;
  padding-top: 10px;
}
.book-card-content {
  padding: 17px 2px 13px;
  position: relative;
}
.card-current {
  position: absolute;
  right: 0;
  top: -13px;
  background: var(--surface-panel, #f5efe4);
  border: 1px solid var(--line, #d6c4ae);
  border-radius: 3px;
  font-size: 9px;
  padding: 2px 7px;
  color: var(--text-primary, #8d6e4f);
}
.book-preview {
  font-size: 11px;
  line-height: 1.9;
  color: var(--text-secondary, #9b8975);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
  overflow-wrap: anywhere;
}
.book-progress {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 15px;
  font:
    10px Georgia,
    serif;
  color: var(--text-secondary, #a08b72);
}
.book-progress > div {
  height: 3px;
  flex: 1;
  background: var(--surface-panel, #e7ded1);
  border-radius: 2px;
  overflow: hidden;
}
.book-progress > div > span {
  height: 100%;
  display: block;
  background: var(--accent, #a58363);
}
.book-updated {
  font-size: 9px;
  color: var(--text-secondary, #b09d87);
  margin-top: 13px;
}
.book-card-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--line, #e9e0d3);
  background: color-mix(in srgb, var(--field) 50%, transparent);
}
.rename-form {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--line, #e9e0d3);
  padding: 12px;
}
.rename-form input {
  min-width: 0;
  flex: 1;
  width: 100%;
  font-size: 11px;
  border: 1px solid var(--line, #d2bfa8);
  background: var(--surface-raised, #fffaf2);
  padding: 7px;
  color: var(--text-primary, #785c43);
}
.rename-form button {
  font-size: 10px;
  padding: 6px;
  background: var(--surface-panel, #ece1d3);
}
.rename-form span {
  color: var(--text-primary, #a05339);
  font-size: 10px;
  width: 100%;
}
.trash-hint {
  font-size: 11px;
  color: var(--text-secondary, #a18e77);
  margin-bottom: 20px;
}
.recycled-book .mini-book {
  opacity: 0.55;
}
.shelf-empty {
  min-height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;
  text-align: center;
  color: var(--text-secondary, #b49a7e);
}
.shelf-empty h2 {
  font:
    22px "PMingLiU",
    serif;
  color: var(--text-primary, #8b7055);
}
.shelf-empty p {
  font-size: 12px;
  line-height: 1.9;
  color: var(--text-secondary, #a89681);
}
.shelf-local-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 10px;
  color: var(--text-secondary, #a59078);
  margin-top: 40px;
  line-height: 1.8;
}
@media (max-width: 900px) {
  .shelf-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
}
@media (max-width: 540px) {
  .shelf-heading {
    align-items: flex-start;
    gap: 8px;
  }
  .shelf-heading h1 {
    font-size: 29px;
  }
  .shelf-heading p {
    font-size: 10px;
    letter-spacing: 0;
  }
  .shelf-heading .toolbar-button {
    font-size: 10px;
    margin-top: 20px;
    padding: 5px;
  }
  .shelf-toolbar {
    flex-direction: column;
    gap: 5px;
  }
  .shelf-backup-actions {
    justify-content: flex-end;
    border-top: 1px solid var(--line, #e5dbcf);
    padding-top: 7px;
  }
  .shelf-filter {
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin: 20px 0;
  }
  .shelf-search {
    width: 100%;
    border: 1px solid var(--line, #ded1c0);
    padding: 0 10px;
    border-radius: 5px;
    background: var(--surface-panel, #f5eee5);
  }
  .shelf-search input {
    width: 100%;
    font-size: 12px;
  }
  .shelf-tabs {
    gap: 20px;
  }
  .shelf-grid {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .mini-book {
    height: 170px;
  }
  .mini-book h2 {
    font-size: 24px;
  }
  .book-open {
    padding: 18px 20px 0;
  }
  .book-card-actions {
    padding: 8px 10px;
    gap: 4px;
  }
  .shelf-local-note {
    font-size: 9px;
    align-items: flex-start;
  }
  .shelf-empty {
    min-height: 260px;
  }
}
</style>
