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
import AppIcon from "./components/AppIcon.vue";
import BookView from "./components/BookView.vue";
import PaginationBar from "./components/PaginationBar.vue";
import TextEntryDialog from "./components/TextEntryDialog.vue";
import Bookshelf from "./components/Bookshelf.vue";
import NotebookEditor from "./components/NotebookEditor.vue";
import { createDemo } from "./data/demo";
import { paginate } from "./core/pagination";
import { importDocx } from "./core/importer";
import { anchorForPage, pageForAnchor, spreadForPage } from "./core/navigation";
import { searchDocument } from "./core/search";
import { loadLibrary, saveLibrary } from "./core/storage";
import {
  appendNotebook,
  cloneRecord,
  createRecord,
  progressForAnchor,
} from "./core/library";
import { exportBackup, importBackup } from "./core/backup";
import type {
  Anchor,
  Notebook,
  PageSize,
  PaperPage,
  SearchHit,
  BookRecord,
} from "./core/model";

const doc = shallowRef<Notebook>();
const pages = shallowRef<PaperPage[]>([]);
const index = ref(0);
const size = ref<PageSize>({ width: 500, height: 650, mobile: false });
const book = ref<InstanceType<typeof BookView>>();
const workspace = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const searchInput = ref<HTMLInputElement>();
const searchOpen = ref(false);
const importOpen = ref(false);
const helpOpen = ref(false);
const textOpen = ref(false);
const shelfOpen = ref(false);
const editorOpen = ref(false);
const books = shallowRef<BookRecord[]>([]);
const activeId = ref<string>();
const backupInput = ref<HTMLInputElement>();
const dirtyIds = new Set<string>();
let saveChain = Promise.resolve();
const query = ref("");
const debouncedQuery = ref("");
const activeResult = ref(0);
const resultLimit = ref(60);
const progress = ref(0);
const layingOut = ref(true);
const parsing = ref(false);
const turning = ref(false);
const toast = ref("");
const toastError = ref(false);
const storageStatus = ref("僅儲存於此瀏覽器");
const dragOver = ref(false);
const located = ref<number>();
const pendingResize = ref(false);
let controller: AbortController | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
let queryTimer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let locatorTimer: ReturnType<typeof setTimeout> | undefined;
let resizeObserver: ResizeObserver | undefined;
let restoredAnchor: Anchor | undefined;
let currentAnchor: Anchor | undefined;
let pendingNavigationAnchor: Anchor | undefined;
let savedVersion = 0;
let pendingDocument: Notebook | undefined;
let pendingImportMessage: string | undefined;
const busy = computed(() => layingOut.value || parsing.value);
const hits = computed(() =>
  doc.value ? searchDocument(doc.value, debouncedQuery.value, pages.value) : [],
);
const activeHit = computed<SearchHit | undefined>(
  () => hits.value[activeResult.value],
);
const title = computed(() => doc.value?.title || "正在打開筆記本");
const bookStyle = computed(() => ({
  "--page-width": `${size.value.width}px`,
  "--page-height": `${size.value.height}px`,
}));
const chapter = computed(() => {
  const first = pages.value[index.value]?.fragments[0];
  if (!doc.value || !first) return "閱讀筆記";
  const at = doc.value.blocks.findIndex((b) => b.id === first.blockId);
  return (
    doc.value.blocks.slice(0, at + 1).findLast((b) => b.kind === "heading")
      ?.text || "閱讀筆記"
  );
});
function notify(message: string, error = false) {
  toast.value = message;
  toastError.value = error;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      toast.value = "";
    },
    error ? 10000 : 6500,
  );
}
function measureSize(): PageSize {
  const available =
    workspace.value?.clientWidth || Math.min(window.innerWidth - 32, 1120);
  const mobile = window.innerWidth < 820;
  const width = Math.floor(Math.min(1120, available) / (mobile ? 1 : 2));
  const height = Math.round(
    Math.max(
      mobile ? 540 : 570,
      Math.min(760, window.innerHeight - (mobile ? 225 : 275)),
    ),
  );
  return { width, height, mobile };
}
async function layout(candidate?: Notebook, anchor?: Anchor) {
  if (candidate) pendingDocument = candidate;
  const source = candidate || pendingDocument || doc.value;
  if (!source) return;
  controller?.abort();
  const run = new AbortController();
  controller = run;
  const nextSize = measureSize();
  const position =
    anchor || currentAnchor || anchorForPage(pages.value, index.value);
  layingOut.value = true;
  progress.value = 0;
  try {
    const result = await paginate(source, nextSize, run.signal, (n) => {
      if (!run.signal.aborted) progress.value = n;
    });
    if (run.signal.aborted) return;
    const replacing = !!pendingDocument;
    doc.value = source;
    pages.value = result;
    size.value = nextSize;
    index.value = spreadForPage(
      pageForAnchor(result, position),
      nextSize.mobile,
    );
    currentAnchor =
      position &&
      result.some((p) =>
        p.fragments.some((f) => f.blockId === position.blockId),
      )
        ? position
        : anchorForPage(result, index.value);
    if (replacing) {
      const existing = books.value.find((b) => b.document.id === source.id);
      const record = existing
        ? {
            ...existing,
            document: source,
            anchor: currentAnchor!,
            updatedAt:
              existing.document === source ? existing.updatedAt : Date.now(),
          }
        : createRecord(source, currentAnchor);
      books.value = [
        ...books.value.filter((b) => b.document.id !== source.id),
        record,
      ];
      activeId.value = source.id;
      dirtyIds.add(source.id);
      query.value = "";
      debouncedQuery.value = "";
      activeResult.value = 0;
      searchOpen.value = false;
      pendingDocument = undefined;
      if (pendingImportMessage) {
        notify(pendingImportMessage);
        pendingImportMessage = undefined;
      }
    }
    layingOut.value = false;
    queueSave();
    await nextTick();
  } catch (error) {
    if (run.signal.aborted) return;
    pendingDocument = undefined;
    pendingImportMessage = undefined;
    layingOut.value = false;
    notify(
      error instanceof Error ? error.message : "排版失敗，請稍後再試。",
      true,
    );
  }
}
function queueSave() {
  clearTimeout(saveTimer);
  captureCurrent();
  storageStatus.value = "正在儲存…";
  const version = ++savedVersion;
  saveTimer = setTimeout(async () => {
    try {
      await persist();
      if (version === savedVersion) storageStatus.value = "已儲存於此瀏覽器";
    } catch {
      storageStatus.value = "此瀏覽器無法儲存";
      notify(
        "瀏覽器儲存失敗，這次內容與閱讀位置無法保存；仍可繼續閱讀。",
        true,
      );
    }
  }, 220);
}
function captureCurrent() {
  if (!doc.value || !pages.value.length) return;
  const record = books.value.find(
    (b) => b.document.id === doc.value!.id && !b.deletedAt,
  );
  if (!record) return;
  const anchor = currentAnchor || anchorForPage(pages.value, index.value);
  if (!anchor) return;
  const progress =
    index.value + (size.value.mobile ? 1 : 2) >= pages.value.length
      ? 1
      : progressForAnchor(doc.value, anchor);
  books.value = books.value.map((b) =>
    b === record ? { ...record, document: doc.value!, anchor, progress } : b,
  );
  dirtyIds.add(record.document.id);
}
async function persist() {
  const snapshot = { books: books.value, activeId: activeId.value };
  const ids = [...dirtyIds];
  const version = savedVersion;
  const job = saveChain.catch(() => {}).then(() => saveLibrary(snapshot, ids));
  saveChain = job;
  await job;
  if (version === savedVersion) ids.forEach((id) => dirtyIds.delete(id));
}
function showShelf() {
  if (busy.value || turning.value) return;
  captureCurrent();
  queueSave();
  shelfOpen.value = true;
}
function returnToReading() {
  if (!doc.value) return;
  shelfOpen.value = false;
  void nextTick(scheduleResize);
}
async function openBook(id: string) {
  if (busy.value || turning.value) return;
  const record = books.value.find((b) => b.document.id === id && !b.deletedAt);
  if (!record) return;
  captureCurrent();
  shelfOpen.value = false;
  await nextTick();
  currentAnchor = record.anchor;
  await layout(record.document, record.anchor);
}
function renameBook(id: string, name: string) {
  if (!name.trim()) return;
  const record = books.value.find((b) => b.document.id === id);
  if (!record) return;
  const renamed = { ...record.document, title: name.trim().slice(0, 120) };
  books.value = books.value.map((b) =>
    b === record ? { ...record, document: renamed, updatedAt: Date.now() } : b,
  );
  if (doc.value?.id === id) doc.value = renamed;
  dirtyIds.add(id);
  queueSave();
  notify("筆記已重新命名。");
}
function duplicateBook(id: string) {
  captureCurrent();
  const record = books.value.find((b) => b.document.id === id);
  if (!record) return;
  const copy = cloneRecord(record);
  books.value = [...books.value, copy];
  dirtyIds.add(copy.document.id);
  queueSave();
  notify("已建立一份副本。");
}
function trashBook(id: string) {
  captureCurrent();
  books.value = books.value.map((b) =>
    b.document.id === id ? { ...b, deletedAt: Date.now() } : b,
  );
  dirtyIds.add(id);
  if (activeId.value === id) {
    activeId.value = undefined;
    doc.value = undefined;
    pages.value = [];
    currentAnchor = undefined;
  }
  queueSave();
  notify("已移到回收桶，隨時可以還原。");
}
function restoreBook(id: string) {
  books.value = books.value.map((b) =>
    b.document.id === id ? { ...b, deletedAt: undefined } : b,
  );
  dirtyIds.add(id);
  queueSave();
  notify("筆記已還原到書架。");
}
function downloadBackup() {
  try {
    captureCurrent();
    const data = exportBackup(books.value);
    if (new Blob([data]).size > 50 * 1024 * 1024)
      throw new Error("書架超過單份備份 50MB 上限，請先減少大型文件。");
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `紙間書架備份-${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("書架備份已下載，包含回收桶與閱讀位置。");
  } catch (e) {
    notify(e instanceof Error ? e.message : "無法匯出備份。", true);
  }
}
async function restoreBackupFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || busy.value) return;
  try {
    if (file.size > 50 * 1024 * 1024)
      throw new Error("備份超過 50MB，請選擇較小的紙間備份。");
    const restored = importBackup(await file.text());
    books.value = [...books.value, ...restored];
    restored.forEach((b) => dirtyIds.add(b.document.id));
    queueSave();
    notify(`已加入 ${restored.length} 本備份筆記，原有書架完整保留。`);
  } catch (e) {
    notify(
      e instanceof Error ? e.message : "匯入備份失敗，原有書架已保留。",
      true,
    );
  } finally {
    input.value = "";
  }
}
async function saveEdited(candidate: Notebook) {
  editorOpen.value = false;
  currentAnchor = { blockId: candidate.blocks[0]!.id, offset: 0 };
  pendingImportMessage = "這本筆記已更新並重新分頁。";
  await layout(candidate, currentAnchor);
}
function changed(next: number) {
  index.value = next;
  currentAnchor = pendingNavigationAnchor || anchorForPage(pages.value, next);
  pendingNavigationAnchor = undefined;
  queueSave();
}
function setTurning(value: boolean) {
  turning.value = value;
  if (!value && pendingResize.value) {
    pendingResize.value = false;
    scheduleResize();
  }
}
function jump(page: number, anchor?: Anchor) {
  if (busy.value || turning.value) return;
  const target = Math.max(0, Math.min(pages.value.length - 1, page - 1));
  const spread = spreadForPage(target, size.value.mobile);
  const destination = anchor || anchorForPage(pages.value, target);
  if (spread !== index.value) pendingNavigationAnchor = destination;
  currentAnchor = destination;
  book.value?.go(spread, true);
  if (spread === index.value) queueSave();
  clearTimeout(locatorTimer);
  located.value = target;
  locatorTimer = setTimeout(() => {
    located.value = undefined;
  }, 1800);
}
function selectHit(n: number) {
  if (turning.value || busy.value || !hits.value.length) return;
  activeResult.value = (n + hits.value.length) % hits.value.length;
  const hit = hits.value[activeResult.value]!;
  jump(hit.page + 1, { blockId: hit.blockId, offset: hit.offset });
}
function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (shelfOpen.value) return;
    if (turning.value || parsing.value) {
      pendingResize.value = true;
      return;
    }
    const next = measureSize();
    if (
      next.width === size.value.width &&
      next.height === size.value.height &&
      next.mobile === size.value.mobile
    )
      return;
    void layout();
  }, 220);
}
async function loadFile(file?: File) {
  if (!file || busy.value || turning.value) return;
  parsing.value = true;
  importOpen.value = false;
  try {
    const candidate = await importDocx(file);
    captureCurrent();
    shelfOpen.value = false;
    await nextTick();
    parsing.value = false;
    pendingImportMessage = candidate.warnings.length
      ? "匯入完成。部分格式已簡化，請查看下方文件提醒。"
      : "匯入完成，筆記已準備好。";
    await layout(candidate);
  } catch (error) {
    parsing.value = false;
    notify(
      error instanceof Error ? error.message : "匯入失敗，原本的筆記已保留。",
      true,
    );
  } finally {
    if (fileInput.value) fileInput.value.value = "";
    if (pendingResize.value) {
      pendingResize.value = false;
      scheduleResize();
    }
  }
}
function pickFile(e: Event) {
  void loadFile((e.target as HTMLInputElement).files?.[0]);
}
function dropFile(e: DragEvent) {
  dragOver.value = false;
  if (e.dataTransfer?.files.length) void loadFile(e.dataTransfer.files[0]);
}
async function demo() {
  if (busy.value || turning.value) return;
  importOpen.value = false;
  captureCurrent();
  shelfOpen.value = false;
  await nextTick();
  await layout(createDemo());
  notify("已載入示範筆記。");
}
async function createTextNotebook(
  candidate: Notebook,
  mode: "new" | "append" = "new",
) {
  if (busy.value || turning.value) return;
  textOpen.value = false;
  captureCurrent();
  shelfOpen.value = false;
  await nextTick();
  const source =
    mode === "append" && doc.value
      ? appendNotebook(doc.value, candidate)
      : candidate;
  pendingImportMessage =
    mode === "append"
      ? "已追加到這本筆記，原有內容完整保留。"
      : "文字筆記已建立，原有筆記保留在書架。";
  await layout(source);
}
function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) void nextTick(() => searchInput.value?.focus());
}
function keydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (e.key === "Escape") {
    importOpen.value = false;
    helpOpen.value = false;
    textOpen.value = false;
    editorOpen.value = false;
    if (searchOpen.value) {
      searchOpen.value = false;
      query.value = "";
    }
    return;
  }
  if (
    importOpen.value ||
    helpOpen.value ||
    textOpen.value ||
    editorOpen.value
  ) {
    if (e.key === "Tab") {
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          ".dialog button:not(:disabled),.dialog a[href],.dialog input:not(:disabled),.dialog textarea,.dialog select,.dialog [contenteditable=true]",
        ),
      ];
      const first = controls[0];
      const last = controls.at(-1);
      if (e.shiftKey && target === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && target === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if (shelfOpen.value) return;
  if (
    target.closest('input,textarea,select,[contenteditable="true"]') ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    busy.value ||
    turning.value
  )
    return;
  if (e.key === "/") {
    e.preventDefault();
    if (!searchOpen.value) toggleSearch();
    else searchInput.value?.focus();
    return;
  }
  if (window.getSelection()?.toString()) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    book.value?.move(e.key === "ArrowRight" ? 1 : -1);
  }
}
watch(query, (value) => {
  clearTimeout(queryTimer);
  if (!value.trim()) {
    debouncedQuery.value = "";
    activeResult.value = 0;
    return;
  }
  queryTimer = setTimeout(() => {
    debouncedQuery.value = value;
    activeResult.value = 0;
    resultLimit.value = 60;
  }, 260);
});
watch([importOpen, helpOpen], async ([openImport, openHelp]) => {
  if (openImport || openHelp) {
    await nextTick();
    document.querySelector<HTMLElement>(".dialog-close")?.focus();
  }
});
onMounted(async () => {
  window.addEventListener("resize", scheduleResize);
  window.addEventListener("keydown", keydown);
  resizeObserver = new ResizeObserver(scheduleResize);
  if (workspace.value) resizeObserver.observe(workspace.value);
  try {
    const library = await loadLibrary();
    books.value = library.books;
    activeId.value = library.activeId;
    library.books.forEach((b) => dirtyIds.add(b.document.id));
    const saved =
      library.books.find(
        (b) => b.document.id === library.activeId && !b.deletedAt,
      ) || library.books.find((b) => !b.deletedAt);
    if (saved?.document?.blocks?.length) {
      doc.value = saved.document;
      restoredAnchor = saved.anchor;
      currentAnchor = saved.anchor;
    }
    if (library.books.length && !saved) {
      layingOut.value = false;
      shelfOpen.value = true;
      return;
    }
  } catch {
    notify("無法讀取本機筆記，已為你打開示範。這次內容可能無法保存。", true);
  }
  await layout(doc.value || createDemo(), restoredAnchor);
});
onBeforeUnmount(() => {
  controller?.abort();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleResize);
  window.removeEventListener("keydown", keydown);
  [resizeTimer, queryTimer, saveTimer, toastTimer, locatorTimer].forEach(
    clearTimeout,
  );
});
</script>

<template>
  <div
    class="app"
    @dragover.prevent="
      dragOver = !!$event.dataTransfer?.types.includes('Files')
    "
    @drop.prevent="dropFile"
  >
    <header class="site-header">
      <a class="brand" href="#" aria-label="紙間首頁" @click.prevent="showShelf"
        ><span class="brand-mark"><AppIcon name="book" :size="25" /></span
        ><span class="brand-name">紙間</span
        ><span class="brand-subtitle">留一點時間，給閱讀。</span></a
      >
      <div class="header-actions">
        <button
          class="quiet-button shelf-toggle"
          :disabled="busy || turning"
          @click="shelfOpen ? returnToReading() : showShelf()"
        >
          <AppIcon name="grid" :size="17" />我的書架
          <span>{{ books.filter((b) => !b.deletedAt).length }}</span></button
        ><button class="quiet-button help-button" @click="helpOpen = true">
          <AppIcon name="help" :size="17" /><span>閱讀指南</span>
        </button>
      </div>
    </header>
    <Bookshelf
      v-if="shelfOpen"
      :books="books"
      :active-id="activeId"
      :busy="busy"
      @open="openBook"
      @create="textOpen = true"
      @import-word="fileInput?.click()"
      @backup="downloadBackup"
      @restore-backup="backupInput?.click()"
      @rename="renameBook"
      @duplicate="duplicateBook"
      @trash="trashBook"
      @restore="restoreBook"
      @back="returnToReading"
    />
    <input
      ref="backupInput"
      id="backup-file"
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      aria-label="選擇書架備份"
      @change="restoreBackupFile"
    />
    <main v-show="!shelfOpen">
      <section class="notebook-heading" aria-labelledby="document-title">
        <div>
          <div class="eyebrow"><span></span> 你的私人閱讀空間</div>
          <h1 id="document-title">{{ title }}</h1>
          <p>把散落的知識，收進一本好讀的筆記。</p>
        </div>
        <div class="document-badge">
          <AppIcon name="book" :size="18" /><span
            >閱讀筆記 <i>·</i> {{ pages.length || "—" }} 頁</span
          >
        </div>
      </section>
      <section class="toolbar" aria-label="筆記本工具列">
        <div class="toolbar-left">
          <button
            class="toolbar-button"
            :class="{ selected: searchOpen }"
            @click="toggleSearch"
          >
            <AppIcon name="search" /><span>搜尋筆記</span><kbd>/</kbd></button
          ><span class="toolbar-divider"></span
          ><button
            class="toolbar-button"
            :disabled="busy || turning"
            @click="demo"
          >
            <AppIcon name="book" /><span>載入示範筆記</span>
          </button>
        </div>
        <div class="toolbar-right">
          <button
            class="toolbar-button edit-current-button"
            :disabled="busy || turning || !doc"
            @click="editorOpen = true"
          >
            <AppIcon name="edit" :size="16" />編輯
          </button>
          <button
            class="toolbar-button text-entry-button"
            :disabled="busy || turning"
            @click="textOpen = true"
          >
            <AppIcon name="edit" :size="17" /><span>貼上文字</span>
          </button>
          <span class="local-note"
            ><AppIcon name="shield" :size="15" />文件只留在你的裝置</span
          ><button
            class="import-button"
            :disabled="busy || turning"
            @click="importOpen = true"
          >
            <AppIcon name="upload" :size="17" />匯入 Word
          </button>
        </div>
      </section>
      <input
        ref="fileInput"
        id="word-file"
        class="visually-hidden"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="選擇 Word 文件"
        @change="pickFile"
      />

      <section v-if="searchOpen" class="search-panel" aria-label="全文搜尋">
        <div class="search-top">
          <div class="search-field">
            <AppIcon name="search" /><input
              ref="searchInput"
              v-model="query"
              placeholder="搜尋整本筆記，例如 TCP、藍牙…"
              aria-label="搜尋整本筆記"
              @keydown.enter.prevent="
                selectHit(activeResult + ($event.shiftKey ? -1 : 1))
              "
            /><button
              v-if="query"
              class="icon-button"
              aria-label="清除搜尋"
              @click="query = ''"
            >
              <AppIcon name="close" :size="16" />
            </button>
          </div>
          <span class="result-count">{{
            debouncedQuery ? `${hits.length} 筆結果` : "中文、英文皆可搜尋"
          }}</span
          ><button
            class="icon-button"
            aria-label="上一筆搜尋結果"
            :disabled="!hits.length || busy || turning"
            @click="selectHit(activeResult - 1)"
          >
            <AppIcon name="left" /></button
          ><button
            class="icon-button"
            aria-label="下一筆搜尋結果"
            :disabled="!hits.length || busy || turning"
            @click="selectHit(activeResult + 1)"
          >
            <AppIcon name="right" /></button
          ><button
            class="icon-button"
            aria-label="關閉搜尋"
            @click="
              searchOpen = false;
              query = '';
            "
          >
            <AppIcon name="close" />
          </button>
        </div>
        <div
          v-if="debouncedQuery"
          class="search-results"
          role="list"
          aria-label="搜尋結果"
        >
          <p v-if="!hits.length" class="no-results">
            找不到「{{ debouncedQuery }}」，試試其他關鍵字。
          </p>
          <button
            v-for="(hit, n) in hits.slice(0, resultLimit)"
            :key="`${hit.blockId}-${hit.offset}`"
            class="search-result"
            :class="{ active: n === activeResult }"
            :disabled="busy || turning"
            @click="selectHit(n)"
          >
            <span class="result-page">第 {{ hit.page + 1 }} 頁</span
            ><span>{{ hit.excerpt }}</span
            ><AppIcon name="right" :size="15" /></button
          ><button
            v-if="hits.length > resultLimit"
            class="more-results"
            @click="resultLimit += 60"
          >
            顯示更多結果（還有 {{ hits.length - resultLimit }} 筆）
          </button>
        </div>
      </section>

      <div class="reading-context">
        <span><AppIcon name="file" :size="14" />{{ chapter }}</span
        ><span class="saved-status"
          ><span class="status-dot"></span>{{ storageStatus }}</span
        >
      </div>
      <div
        ref="workspace"
        class="book-workspace"
        :style="bookStyle"
        :aria-busy="busy"
      >
        <BookView
          v-if="pages.length"
          ref="book"
          :pages="pages"
          :index="index"
          :single="size.mobile"
          :title="title"
          :hits="hits"
          :active-hit="activeHit"
          :located="located"
          :disabled="busy"
          @change="changed"
          @turning="setTurning"
        />
        <div v-else class="initial-paper"></div>
        <div v-if="busy" class="loading-overlay" role="status">
          <span class="loading-book"><AppIcon name="book" :size="30" /></span
          ><strong>{{ parsing ? "正在解析 Word…" : "正在整理紙頁…" }}</strong
          ><span>{{
            parsing
              ? "文件只在你的瀏覽器內處理"
              : `依照內容量測與分頁 ${progress}%`
          }}</span
          ><progress
            v-if="!parsing"
            :value="progress"
            max="100"
            aria-label="排版進度"
          ></progress>
        </div>
      </div>
      <PaginationBar
        v-if="pages.length"
        :index="index"
        :total="pages.length"
        :single="size.mobile"
        :disabled="busy || turning"
        @jump="jump"
        @move="book?.move($event)"
      />
      <div class="reading-tips">
        <span class="desktop-tip"
          ><kbd>←</kbd><kbd>→</kbd> 使用方向鍵翻頁，或點擊紙頁外側邊緣</span
        ><span class="mobile-tip">左右輕滑，慢慢翻閱</span
        ><span>你的閱讀進度會自動保存</span>
      </div>
      <details v-if="doc?.warnings.length" class="document-warnings" open>
        <summary>文件提醒（{{ doc.warnings.length }}）</summary>
        <ul>
          <li v-for="warning in doc.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </details>
    </main>
    <footer class="site-footer">
      <span
        >紙間 <span class="footer-dot">·</span> 讓閱讀，回到紙上的節奏。</span
      ><span>純前端閱讀 <span class="footer-dot">·</span> 無須登入</span>
    </footer>
    <NotebookEditor
      :open="editorOpen"
      :document="doc"
      @close="editorOpen = false"
      @save="saveEdited"
    />
    <TextEntryDialog
      :open="textOpen"
      :can-append="!!doc"
      @close="textOpen = false"
      @create="createTextNotebook"
    />
    <Transition name="toast"
      ><div
        v-if="toast"
        class="toast-message"
        :class="{ error: toastError }"
        :role="toastError ? 'alert' : 'status'"
      >
        <AppIcon :name="toastError ? 'help' : 'check'" /><span>{{ toast }}</span
        ><button class="icon-button" aria-label="關閉提示" @click="toast = ''">
          <AppIcon name="close" :size="15" />
        </button></div
    ></Transition>

    <div
      v-if="importOpen || helpOpen"
      class="modal-backdrop"
      @click.self="
        importOpen = false;
        helpOpen = false;
      "
    >
      <section
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="importOpen ? '匯入 Word 文件' : '閱讀指南'"
      >
        <button
          class="dialog-close icon-button"
          aria-label="關閉視窗"
          autofocus
          @click="
            importOpen = false;
            helpOpen = false;
          "
        >
          <AppIcon name="close" />
        </button>
        <template v-if="importOpen"
          ><span class="dialog-emblem"
            ><AppIcon name="upload" :size="28"
          /></span>
          <h2>把你的筆記，帶進紙間。</h2>
          <p>選擇一份 Word 文件，我們會替你整理成好讀的紙頁。</p>
          <button
            class="drop-zone"
            @click="fileInput?.click()"
            @dragover.prevent
            @drop.prevent.stop="
              dropFile($event);
              importOpen = false;
            "
          >
            <AppIcon name="file" :size="33" /><strong
              >點擊選擇檔案，或拖曳到這裡</strong
            ><span>僅支援 .docx · 檔案上限 10MB</span>
          </button>
          <div class="import-information">
            <AppIcon name="shield" :size="18" />
            <p>
              文件在瀏覽器內解析，不會上傳伺服器。保留標題、段落、粗體、清單與基本表格；圖片、文字方塊與複雜版面不支援，略過項目會另行提醒。
            </p>
          </div>
          <p class="dialog-footnote">
            新文件成功解析與排版後會建立新的一本，原有筆記保留在書架。
          </p></template
        >
        <template v-else
          ><span class="dialog-emblem"><AppIcon name="book" :size="28" /></span>
          <h2>慢一點，讀得更清楚。</h2>
          <p>紙間會依照你的螢幕，自動把內容排入固定紙頁。</p>
          <ul class="help-list">
            <li>點擊下方按鈕、紙頁邊緣，或使用 ← → 翻頁。</li>
            <li>手機左右輕滑可翻頁；長按仍可選取文字。</li>
            <li>使用搜尋找整本筆記，點結果會跳到命中頁。</li>
            <li>點頁碼或輸入頁碼，即可直接前往指定位置。</li>
            <li>文件與閱讀位置儲存在目前瀏覽器；清除網站資料會移除筆記。</li>
            <li>匯入與貼上預設建立新的一本；貼上也能選擇追加到目前筆記。</li>
            <li>
              「我的書架」可以切換、重新命名、複製及移除筆記；回收桶可還原。
            </li>
            <li>請定期下載書架備份；匯入備份會加入書架並保留原有筆記。</li>
          </ul></template
        >
      </section>
    </div>
    <div
      v-if="dragOver"
      class="global-drop"
      @dragleave.self="dragOver = false"
      @drop.prevent.stop="dropFile"
    >
      <AppIcon name="upload" :size="42" /><strong
        >放開檔案，開始整理你的筆記</strong
      ><span>.docx · 最大 10MB · 不上傳伺服器</span>
    </div>
  </div>
</template>
