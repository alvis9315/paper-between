<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import ModalShell from "./components/ModalShell.vue";
import AppIcon from "./components/AppIcon.vue";
import DisclosurePanel from "./components/DisclosurePanel.vue";
import IconAction from "./components/IconAction.vue";
const ReaderDetail = defineAsyncComponent(
  () => import("./components/ReaderDetail.vue"),
);
import {
  Search,
  SquarePen,
  ImagePlus,
  ClipboardPaste,
  Upload,
  FileText,
  Highlighter,
  CircleHelp,
  Info,
  Sun,
  Moon,
  Menu,
  Layers,
  ScanText,
} from "@lucide/vue";
import { theme, toggleTheme, restoreTheme } from "./core/theme";
import BookView from "./components/BookView.vue";
import PaginationBar from "./components/PaginationBar.vue";
import TextEntryDialog from "./components/TextEntryDialog.vue";
import Bookshelf from "./components/Bookshelf.vue";
import { cardsFromBook, MAX_REVIEW_CARDS } from "./core/reviewCards";
const ReflowDialog = defineAsyncComponent(
  () => import("./components/ReflowDialog.vue"),
);
const reflowOpen = ref(false);
const StudyCards = defineAsyncComponent(
  () => import("./components/StudyCards.vue"),
);
const NotebookEditor = defineAsyncComponent(
  () => import("./components/NotebookEditor.vue"),
);
import HighlightPanel from "./components/HighlightPanel.vue";
import {
  categories,
  selectionTargets,
  reanchorAnnotations,
} from "./core/annotations";
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
import { createBundle, readBundle } from "./core/backupBundle";
import { validateBookMedia, cleanupPending } from "./core/media";
import type {
  Anchor,
  Notebook,
  PageSize,
  PaperPage,
  SearchHit,
  BookRecord,
  Annotation,
  AnnotationTarget,
  ReviewCard,
} from "./core/model";

const doc = shallowRef<Notebook>();
const pages = shallowRef<PaperPage[]>([]);
const index = ref(0);
const size = ref<PageSize>({ width: 500, height: 650, mobile: false });
const book = ref<InstanceType<typeof BookView>>();
const workspace = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const pdfInput = ref<HTMLInputElement>();
const parseMessage = ref("正在解析文件…");
const searchInput = ref<HTMLInputElement>();
const searchOpen = ref(false);
const searchDialog = ref<HTMLDialogElement>();
const jumpOpen = ref(false);
const detailPage = ref<number>();
const infoOpen = ref(false);
const importOpen = ref(false);
const helpOpen = ref(false);
const compactTools = ref(window.innerWidth < 1100);
const readerTools = ref<HTMLElement>();
const readerMenuOpen = ref(false);
function viewportChanged() {
  compactTools.value = window.innerWidth < 1100;
  const viewport = window.visualViewport;
  if (!viewport || Math.abs(viewport.scale - 1) < 0.01) {
    document.documentElement.style.setProperty(
      "--visual-height",
      `${viewport?.height || innerHeight}px`,
    );
    document.documentElement.style.setProperty(
      "--visual-top",
      `${viewport?.offsetTop || 0}px`,
    );
  }
}

const backupImportOpen = ref(false);
const backupError = ref("");
const backupFileName = ref("");
const textOpen = ref(false);
const shelfOpen = ref(false);
const libraryView = ref<"books" | "cards">("books");
const reviewCards = shallowRef<ReviewCard[]>([]);
const cardImport = ref(false);
function showCards() {
  if (busy.value || turning.value) return;
  readerMenuOpen.value = false;
  if (!toastError.value) toast.value = "";
  captureCurrent();
  queueSave();
  libraryView.value = "cards";
  shelfOpen.value = true;
}
function addReviewCards(cards: ReviewCard[]) {
  const keys = new Set(
    reviewCards.value.map((c) => c.sourceKey).filter(Boolean),
  );
  const fresh = cards.filter((c) => {
    if (!c.sourceKey) return true;
    if (keys.has(c.sourceKey)) return false;
    keys.add(c.sourceKey);
    return true;
  });
  if (reviewCards.value.length + fresh.length > MAX_REVIEW_CARDS) {
    notify("小卡上限 2000 張，請先整理。", true);
    return;
  }
  reviewCards.value = [...reviewCards.value, ...fresh];
  queueSave();
  if (libraryView.value === "cards" && fresh.length) {
    toast.value = "";
    return;
  }
  notify(
    fresh.length
      ? `已建立 ${fresh.length} 張小卡，內容可再校正。`
      : "沒有新增小卡：來源已建立過，或沒有可讀取的文字。",
  );
}
function saveReviewCard(card: ReviewCard) {
  if (!reviewCards.value.some((c) => c.id === card.id)) addReviewCards([card]);
  else {
    reviewCards.value = reviewCards.value.map((c) =>
      c.id === card.id ? card : c,
    );
    queueSave();
  }
}
function removeReviewCard(id: string) {
  reviewCards.value = reviewCards.value.filter((c) => c.id !== id);
  queueSave();
}
function importForCards(kind: "pdf" | "word") {
  cardImport.value = true;
  (kind === "pdf" ? pdfInput.value : fileInput.value)?.click();
}

const editorOpen = ref(false);
const richNew = ref(false);
const highlightOpen = ref(false);
const pendingTargets = shallowRef<AnnotationTarget[]>([]);
const selectedAnnotation = ref<string>();
let deletedAnnotation: { bookId: string; annotation: Annotation } | undefined;
const books = shallowRef<BookRecord[]>([]);
const activeId = ref<string>();
const backupInput = ref<HTMLInputElement>();
const backupWorking = ref(false);
const dirtyIds = new Set<string>();
let saveChain = Promise.resolve();
const query = ref("");
const debouncedQuery = ref("");
const activeResult = ref(0);
const resultLimit = ref(60);
const progress = ref(0);
const layingOut = ref(true);
const layoutError = ref("");
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
  const available = workspace.value?.clientWidth || window.innerWidth * 0.898;
  const mobile = window.innerWidth < 820;
  const width = Math.floor(available / (mobile ? 1 : 2));
  const height = Math.max(
    120,
    Math.floor(workspace.value?.clientHeight || window.innerHeight - 90),
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
  layoutError.value = "";
  progress.value = 0;
  try {
    await validateBookMedia(source);
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
    layoutError.value =
      error instanceof Error ? error.message : "筆記載入失敗。";
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
    } catch (error) {
      console.warn(
        "Local save failed",
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      );
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
  const snapshot = {
    books: books.value,
    activeId: activeId.value,
    reviewCards: reviewCards.value,
  };
  const ids = [...dirtyIds];
  const version = savedVersion;
  const job = saveChain.catch(() => {}).then(() => saveLibrary(snapshot, ids));
  saveChain = job;
  await job;
  if (version === savedVersion) ids.forEach((id) => dirtyIds.delete(id));
}
function showShelf() {
  if (busy.value || turning.value) return;
  readerMenuOpen.value = false;
  captureCurrent();
  queueSave();
  libraryView.value = "books";
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
async function downloadBackup(id?: string) {
  if (backupWorking.value) return;
  backupWorking.value = true;
  try {
    notify("正在打包筆記、圖片與重點，請稍候…");
    captureCurrent();
    const selected = id
      ? books.value.filter((b) => b.document.id === id)
      : books.value;
    const data = await createBundle(
      selected,
      id
        ? reviewCards.value.filter((c) => c.sourceBookId === id)
        : reviewCards.value,
    );
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `頁白書架備份-${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date())}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(
      id
        ? "這本筆記的完整備份已下載。"
        : "書架備份已下載，包含圖片、PDF、重點、回收桶與閱讀位置。",
    );
  } catch (e) {
    notify(e instanceof Error ? e.message : "無法匯出備份。", true);
  } finally {
    backupWorking.value = false;
  }
}
function toggleFavorite(id: string) {
  books.value = books.value.map((b) =>
    b.document.id === id ? { ...b, favorite: !b.favorite } : b,
  );
  dirtyIds.add(id);
  queueSave();
}
function openBackupImport() {
  backupError.value = "";
  backupFileName.value = "";
  backupImportOpen.value = true;
}
async function restoreBackupFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await restoreBackup(file);
  input.value = "";
}
async function restoreBackup(file: File) {
  if (busy.value || backupWorking.value) return;
  backupImportOpen.value = true;
  backupFileName.value = file.name;
  backupError.value = "";
  backupWorking.value = true;
  try {
    if (!/\.(zip|json)$/i.test(file.name)) {
      const hint = /\.pdf$/i.test(file.name)
        ? "PDF 請使用書架的「匯入 PDF」。"
        : /\.docx?$/i.test(file.name)
          ? "Word 請使用書架的「匯入 Word」。"
          : "請選擇由頁白「備份書架」或「備份此本」下載的 ZIP。";
      throw new Error(`這個檔案不是書架備份。${hint}`);
    }
    const restored = await readBundle(file);
    if (
      reviewCards.value.length + (restored.reviewCards?.length || 0) >
      MAX_REVIEW_CARDS
    )
      throw new Error("匯入後小卡會超過 2000 張，請先整理。");
    books.value = [...books.value, ...restored];
    reviewCards.value = [...reviewCards.value, ...(restored.reviewCards || [])];
    restored.forEach((b) => dirtyIds.add(b.document.id));
    queueSave();
    restoreTheme(restored.settings?.theme);
    backupImportOpen.value = false;
    notify(
      `已加入 ${restored.length} 本筆記、${restored.reviewCards?.length || 0} 張小卡，原有資料完整保留。`,
    );
  } catch (e) {
    backupError.value =
      e instanceof Error
        ? e.message
        : "無法讀取備份。請重新下載完整備份後再試。";
  } finally {
    backupWorking.value = false;
  }
}
async function saveEdited(candidate: Notebook) {
  if (candidate.id === doc.value?.id)
    candidate.annotations = reanchorAnnotations(
      doc.value.annotations || [],
      candidate,
    );
  captureCurrent();
  editorOpen.value = false;
  shelfOpen.value = false;
  await nextTick();
  currentAnchor = { blockId: candidate.blocks[0]!.id, offset: 0 };
  pendingImportMessage = richNew.value
    ? "圖文筆記已建立，原有筆記保留在書架。"
    : "這本筆記已更新並重新分頁。";
  await layout(candidate, currentAnchor);
}
function captureSelection() {
  if (busy.value || turning.value || !doc.value || !workspace.value) return;
  pendingTargets.value = selectionTargets(workspace.value, doc.value);
}
function setAnnotations(bookId: string, annotations: Annotation[]) {
  books.value = books.value.map((b) =>
    b.document.id === bookId
      ? {
          ...b,
          document: { ...b.document, annotations },
          updatedAt: Date.now(),
        }
      : b,
  );
  if (doc.value?.id === bookId) doc.value = { ...doc.value, annotations };
  dirtyIds.add(bookId);
  queueSave();
}
function addAnnotation(category: Annotation["category"]) {
  if (!doc.value || !pendingTargets.value.length) return;
  if ((doc.value.annotations?.length || 0) >= 10000) {
    notify("每本最多 10,000 筆重點，請拆成多本筆記。", true);
    return;
  }
  const annotation: Annotation = {
    id: crypto.randomUUID(),
    targets: pendingTargets.value,
    category,
    tags: [],
    comment: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "linked",
  };
  setAnnotations(doc.value.id, [...(doc.value.annotations || []), annotation]);
  pendingTargets.value = [];
  window.getSelection()?.removeAllRanges();
  notify(`已收好一筆${categories[category]}。`);
}
function updateAnnotation(id: string, annotation: Annotation) {
  const record = books.value.find((b) => b.document.id === id);
  if (!record) return;
  setAnnotations(
    id,
    (record.document.annotations || []).map((a) =>
      a.id === annotation.id ? annotation : a,
    ),
  );
}
function removeAnnotation(id: string, annotationId: string) {
  const record = books.value.find((b) => b.document.id === id),
    annotation = record?.document.annotations?.find(
      (a) => a.id === annotationId,
    );
  if (!record || !annotation) return;
  deletedAnnotation = { bookId: id, annotation };
  setAnnotations(
    id,
    record.document.annotations!.filter((a) => a.id !== annotationId),
  );
  notify("已刪除重點，可在重點面板復原。");
}
function undoAnnotation() {
  if (!deletedAnnotation) {
    notify("目前沒有可復原的重點。");
    return;
  }
  const { bookId, annotation } = deletedAnnotation;
  const record = books.value.find((b) => b.document.id === bookId);
  if (record) {
    setAnnotations(bookId, [
      ...(record.document.annotations || []),
      annotation,
    ]);
    deletedAnnotation = undefined;
    notify("重點已復原。");
  }
}
async function locateAnnotation(id: string, a: Annotation) {
  if (busy.value || turning.value || a.status !== "linked") return;
  if (doc.value?.id !== id) await openBook(id);
  const target = a.targets[0]!;
  jump(
    pageForAnchor(pages.value, {
      blockId: target.blockId,
      offset: target.start,
    }) + 1,
    { blockId: target.blockId, offset: target.start },
  );
  selectedAnnotation.value = a.id;
  highlightOpen.value = false;
}
function annotationClick(event: MouseEvent) {
  if (window.getSelection()?.toString()) return;
  const id = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-annotation-id]",
  )?.dataset.annotationId;
  if (id) {
    selectedAnnotation.value = id;
    highlightOpen.value = true;
  }
}
function changed(next: number) {
  pendingTargets.value = [];
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
  const asCards = cardImport.value;
  cardImport.value = false;
  parsing.value = true;
  importOpen.value = false;
  try {
    parseMessage.value = "正在解析文件…";
    const candidate = /\.pdf$/i.test(file.name)
      ? await (
          await import("./core/pdf")
        ).importPdf(file, (message) => {
          parseMessage.value = message;
        })
      : await importDocx(file);
    captureCurrent();
    shelfOpen.value = false;
    await nextTick();
    parsing.value = false;
    pendingImportMessage = candidate.pdfAssetId
      ? "PDF 已加入書架，原始版面與檔案已保留。"
      : candidate.warnings.length
        ? "匯入完成。部分格式已簡化，可在頂部文件資訊查看提醒。"
        : "匯入完成，筆記已準備好。";
    await layout(candidate);
    if (asCards) {
      const record = books.value.find((b) => b.document.id === candidate.id);
      if (record) addReviewCards(cardsFromBook(record));
      libraryView.value = "cards";
      shelfOpen.value = true;
    }
  } catch (error) {
    parsing.value = false;
    notify(
      error instanceof Error ? error.message : "匯入失敗，原本的筆記已保留。",
      true,
    );
  } finally {
    if (fileInput.value) fileInput.value.value = "";
    if (pdfInput.value) pdfInput.value.value = "";
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
  if (editorOpen.value || textOpen.value || backupImportOpen.value) return;
  if (e.dataTransfer?.files.length) void loadFile(e.dataTransfer.files[0]);
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
function closeDetail() {
  if (detailPage.value !== undefined) jump(detailPage.value + 1);
  detailPage.value = undefined;
}
function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) void nextTick(() => searchInput.value?.focus());
}
function keydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("dialog[open]")) return;
  if (e.key === "Escape") {
    importOpen.value = false;
    helpOpen.value = false;
    textOpen.value = false;
    editorOpen.value = false;
    highlightOpen.value = false;
    infoOpen.value = false;
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
  if (
    readerMenuOpen.value ||
    shelfOpen.value ||
    highlightOpen.value ||
    infoOpen.value
  )
    return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!searchOpen.value) toggleSearch();
    else searchInput.value?.focus();
    return;
  }
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
watch(searchOpen, async (open) => {
  await nextTick();
  if (open) {
    searchDialog.value?.showModal();
    searchInput.value?.focus({ preventScroll: true });
  } else {
    searchInput.value?.blur();
    searchDialog.value?.close();
    query.value = "";
  }
});
watch(shelfOpen, async () => {
  searchOpen.value = false;
  jumpOpen.value = false;
  detailPage.value = undefined;
  infoOpen.value = false;
  await nextTick();
  scheduleResize();
});
watch(activeResult, async () => {
  await nextTick();
  searchDialog.value
    ?.querySelector(".search-result.active")
    ?.scrollIntoView({ block: "nearest" });
});
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
watch(
  () => doc.value?.id,
  () => {
    pendingTargets.value = [];
    highlightOpen.value = false;
  },
);
watch([importOpen, helpOpen], async ([openImport, openHelp]) => {
  if (openImport || openHelp) {
    await nextTick();
    document.querySelector<HTMLElement>(".dialog-close")?.focus();
  }
});
onMounted(async () => {
  window.addEventListener("resize", scheduleResize);
  window.addEventListener("resize", viewportChanged);
  window.visualViewport?.addEventListener("resize", viewportChanged);
  window.visualViewport?.addEventListener("scroll", viewportChanged);
  viewportChanged();
  window.addEventListener("keydown", keydown);
  document.addEventListener("selectionchange", captureSelection);
  resizeObserver = new ResizeObserver(scheduleResize);
  if (workspace.value) resizeObserver.observe(workspace.value);
  try {
    const library = await loadLibrary();
    if (library.storageWarning) notify(library.storageWarning, true);
    books.value = library.books;
    reviewCards.value = library.reviewCards || [];
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
    if (!saved) {
      layingOut.value = false;
      shelfOpen.value = true;
      return;
    }
  } catch {
    notify(
      "無法讀取本機書架，仍可匯入文件或備份；這次內容可能無法保存。",
      true,
    );
  }
  if (doc.value) await layout(doc.value, restoredAnchor);
  else {
    layingOut.value = false;
    shelfOpen.value = true;
  }
});
onBeforeUnmount(() => {
  controller?.abort();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleResize);
  window.removeEventListener("resize", viewportChanged);
  window.visualViewport?.removeEventListener("resize", viewportChanged);
  window.visualViewport?.removeEventListener("scroll", viewportChanged);
  window.removeEventListener("keydown", keydown);
  document.removeEventListener("selectionchange", captureSelection);
  [resizeTimer, queryTimer, saveTimer, toastTimer, locatorTimer].forEach(
    clearTimeout,
  );
});
</script>

<template>
  <div
    class="app"
    :class="{
      'reading-mode': !shelfOpen,
      'study-mode': shelfOpen && libraryView === 'cards',
    }"
    @dragover.prevent="
      dragOver =
        !editorOpen &&
        !textOpen &&
        !backupImportOpen &&
        !!$event.dataTransfer?.types.includes('Files')
    "
    @drop.prevent="dropFile"
  >
    <header class="site-header">
      <a
        class="brand"
        href="#"
        aria-label="頁白首頁"
        :aria-disabled="busy || turning"
        @click.prevent="showShelf"
        ><span class="brand-mark"><AppIcon name="book" :size="25" /></span
        ><span class="brand-name">頁白</span
        ><span v-if="shelfOpen" class="brand-subtitle"
          >留一點時間，給閱讀。</span
        ></a
      >
      <h1 v-if="!shelfOpen" class="reader-title">{{ title }}</h1>
      <div
        v-if="!shelfOpen"
        class="reader-actions"
        role="toolbar"
        aria-label="筆記本工具列"
      >
        <IconAction
          compact
          :icon="Search"
          label="搜尋筆記（⌘K / Ctrl K / /）"
          :aria-expanded="searchOpen"
          @click="toggleSearch"
        />
        <IconAction
          v-if="compactTools"
          compact
          :icon="Menu"
          label="操作選單"
          :aria-expanded="readerMenuOpen"
          @click="readerTools?.togglePopover()"
        />
        <div
          ref="readerTools"
          class="reader-tools"
          :popover="compactTools ? 'auto' : undefined"
          role="group"
          aria-label="閱讀操作"
          @toggle="readerMenuOpen = $event.newState === 'open'"
          @click="
            compactTools &&
            ($event.target as HTMLElement).closest('button') &&
            readerTools?.hidePopover()
          "
        >
          <span class="reader-divider" aria-hidden="true"></span>
          <IconAction
            compact
            :icon="SquarePen"
            label="編輯這本筆記"
            :disabled="busy || turning || !doc || !!doc.pdfAssetId"
            @click="
              richNew = false;
              editorOpen = true;
            "
          />
          <IconAction
            compact
            :icon="ImagePlus"
            label="新增圖文筆記"
            :disabled="busy || turning"
            @click="
              richNew = true;
              editorOpen = true;
            "
          />
          <IconAction
            compact
            :icon="ClipboardPaste"
            label="貼上文字"
            :disabled="busy || turning"
            @click="textOpen = true"
          />
          <IconAction
            compact
            :icon="Upload"
            label="匯入 Word"
            :disabled="busy || turning"
            @click="importOpen = true"
          />
          <IconAction
            compact
            :icon="FileText"
            label="匯入 PDF"
            :disabled="busy || turning"
            @click="pdfInput?.click()"
          />
          <span class="reader-divider" aria-hidden="true"></span>
          <IconAction
            compact
            :icon="Highlighter"
            :label="`重點筆記（${doc?.annotations?.length || 0}）`"
            :disabled="busy || turning"
            :aria-expanded="highlightOpen"
            @click="highlightOpen = !highlightOpen"
          />
          <IconAction
            compact
            :icon="Info"
            :label="
              doc?.warnings.length
                ? `文件資訊與提醒（${doc.warnings.length}）`
                : `文件資訊：${storageStatus}`
            "
            :aria-expanded="infoOpen"
            @click="infoOpen = !infoOpen"
          />
          <IconAction
            compact
            :icon="theme === 'dark' ? Sun : Moon"
            :label="theme === 'dark' ? '切換白天模式' : '切換夜間模式'"
            @click="toggleTheme"
          />
          <IconAction
            compact
            :icon="ScanText"
            label="圖文重排"
            :disabled="busy || turning || !doc?.pdfAssetId"
            @click="reflowOpen = true"
          />
          <IconAction
            compact
            :icon="Layers"
            label="考前小卡"
            @click="showCards"
          />
          <IconAction
            compact
            :icon="CircleHelp"
            label="閱讀指南"
            @click="helpOpen = true"
          />
        </div>
      </div>
      <div v-else class="header-actions">
        <button
          class="theme-toggle"
          :aria-pressed="theme === 'dark'"
          :aria-label="theme === 'dark' ? '切換白天模式' : '切換夜間模式'"
          @click="toggleTheme"
        >
          <span :class="{ active: theme === 'light' }"
            ><AppIcon name="sun" :size="17" /></span
          ><span :class="{ active: theme === 'dark' }"
            ><AppIcon name="moon" :size="17"
          /></span>
        </button>
        <button class="quiet-button help-button" @click="helpOpen = true">
          <AppIcon name="help" :size="17" /><span>閱讀指南</span>
        </button>
      </div>
    </header>
    <nav v-if="shelfOpen" class="library-nav" aria-label="資料區塊">
      <button
        :aria-current="libraryView === 'books' ? 'page' : undefined"
        @click="showShelf"
      >
        我的書架
      </button>
      <button
        :aria-current="libraryView === 'cards' ? 'page' : undefined"
        @click="showCards"
      >
        考前小卡 <span>{{ reviewCards.length }}</span>
      </button>
    </nav>
    <StudyCards
      v-if="shelfOpen && libraryView === 'cards'"
      :cards="reviewCards"
      :books="books"
      :busy="busy || backupWorking"
      @add="addReviewCards"
      @save="saveReviewCard"
      @remove="removeReviewCard"
      @source="openBook"
      @import="importForCards"
    />
    <Bookshelf
      v-if="shelfOpen && libraryView === 'books'"
      :books="books"
      :has-cards="!!reviewCards.length"
      :active-id="activeId"
      :busy="busy || backupWorking"
      @open="openBook"
      @create="textOpen = true"
      @import-word="fileInput?.click()"
      @import-pdf="pdfInput?.click()"
      @create-rich="
        richNew = true;
        editorOpen = true;
      "
      @backup="downloadBackup"
      @backup-one="downloadBackup"
      @restore-backup="openBackupImport"
      @favorite="toggleFavorite"
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
      accept=".zip,.json,application/zip,application/json"
      aria-label="選擇書架備份"
      @change="restoreBackupFile"
    />
    <main v-show="!shelfOpen" class="reader-main" aria-label="筆記閱讀區">
      <input
        ref="fileInput"
        id="word-file"
        class="visually-hidden"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="選擇 Word 文件"
        @cancel="cardImport = false"
        @change="pickFile"
      />
      <input
        ref="pdfInput"
        id="pdf-file"
        class="visually-hidden"
        type="file"
        accept=".pdf,application/pdf"
        aria-label="選擇 PDF 文件"
        @cancel="cardImport = false"
        @change="pickFile"
      />
      <dialog
        ref="searchDialog"
        class="search-panel reader-search"
        aria-label="全文搜尋"
        @cancel="searchOpen = false"
        @close="searchOpen = false"
        @click="$event.target === searchDialog && (searchOpen = false)"
      >
        <div class="search-top">
          <div class="search-field">
            <AppIcon name="search" /><input
              ref="searchInput"
              v-model="query"
              placeholder="搜尋整本筆記，例如 TCP、藍牙…"
              aria-label="搜尋整本筆記"
              @keydown.enter.prevent="
                selectHit(activeResult);
                searchOpen = false;
              "
              @keydown.down.prevent="
                activeResult = (activeResult + 1) % Math.max(1, hits.length)
              "
              @keydown.up.prevent="
                activeResult =
                  (activeResult - 1 + hits.length) % Math.max(1, hits.length)
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
          <span class="result-count" aria-live="polite">{{
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
            @click="
              selectHit(n);
              searchOpen = false;
            "
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
      </dialog>
      <div
        ref="workspace"
        @pointerup="captureSelection"
        @keyup="captureSelection"
        @click="annotationClick"
        class="book-workspace"
        :style="bookStyle"
        :aria-busy="busy"
      >
        <BookView
          v-if="pages.length"
          ref="book"
          :pages="pages"
          :annotations="doc?.annotations"
          :index="index"
          :single="size.mobile"
          :title="title"
          :hits="hits"
          :active-hit="activeHit"
          :located="located"
          :disabled="busy"
          @jump="jumpOpen = true"
          @enlarge="detailPage = $event"
          @change="changed"
          @turning="setTurning"
        />
        <div v-else class="initial-paper">
          <div v-if="layoutError" class="reader-recovery" role="alert">
            <AppIcon name="file" :size="32" />
            <h2>這本筆記暫時無法載入</h2>
            <p>{{ layoutError }}</p>
            <p>筆記紀錄未刪除。可以重試，或從原始檔／ZIP 備份還原。</p>
            <div>
              <button class="toolbar-button" @click="layout()">
                重試載入筆記</button
              ><button class="toolbar-button" @click="openBackupImport">
                從備份還原</button
              ><button class="toolbar-button" @click="showShelf">
                回到書架
              </button>
            </div>
          </div>
        </div>
        <div v-if="busy" class="loading-overlay" role="status">
          <span class="loading-book"><AppIcon name="book" :size="30" /></span
          ><strong>{{ parsing ? parseMessage : "正在整理紙頁…" }}</strong
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
      <div
        v-if="pendingTargets.length"
        class="selection-tools"
        role="toolbar"
        aria-label="畫重點"
        @pointerdown.prevent
      >
        <span>畫重點</span
        ><button
          v-for="(label, key) in categories"
          :key="key"
          :class="`swatch-${key}`"
          @click="addAnnotation(key)"
        >
          {{ label }}</button
        ><button aria-label="取消畫重點" @click="pendingTargets = []">×</button>
      </div>
      <div
        v-if="highlightOpen"
        class="reader-panel-backdrop"
        @click.self="highlightOpen = false"
      >
        <HighlightPanel
          v-if="highlightOpen"
          :books="books"
          :active-id="activeId"
          :selected="selectedAnnotation"
          @close="highlightOpen = false"
          @locate="locateAnnotation"
          @update="updateAnnotation"
          @remove="removeAnnotation"
          @undo="undoAnnotation"
        />
      </div>
      <PaginationBar
        :open="jumpOpen"
        @close="jumpOpen = false"
        v-if="pages.length"
        :index="index"
        :total="pages.length"
        :single="size.mobile"
        :disabled="busy || turning"
        @jump="jump"
      />
      <aside v-if="infoOpen" class="reader-info" aria-label="文件資訊">
        <button
          class="icon-button"
          aria-label="關閉文件資訊"
          @click="infoOpen = false"
        >
          <AppIcon name="close" />
        </button>
        <p role="status">{{ storageStatus }}</p>
        <p>文件只留在你的裝置，閱讀進度會自動保存。</p>
        <p v-if="doc?.pdfAssetId">PDF 保留原貌；文字修改請另建圖文筆記。</p>
        <DisclosurePanel
          v-if="doc?.warnings.length"
          :label="`文件提醒（${doc.warnings.length}）`"
        >
          <ul>
            <li v-for="warning in doc.warnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </DisclosurePanel>
      </aside>
      <ReaderDetail
        v-if="detailPage !== undefined && pages[detailPage]"
        :pages="pages"
        :page-index="detailPage"
        :title="title"
        :hits="hits"
        :active-hit="activeHit"
        :annotations="doc?.annotations"
        :size="size"
        @close="closeDetail"
        @navigate="detailPage = $event"
      />
    </main>
    <footer v-if="shelfOpen" class="site-footer">
      <span
        >頁白 <span class="footer-dot">·</span> 讓閱讀，回到紙上的節奏。</span
      ><span>純前端閱讀 <span class="footer-dot">·</span> 無須登入</span>
    </footer>
    <NotebookEditor
      v-if="editorOpen"
      :open="editorOpen"
      :document="richNew ? undefined : doc"
      @close="
        editorOpen = false;
        cleanupPending(
          books.map((b) => b.document),
          reviewCards.flatMap((c) => (c.image ? [c.image.mediaId] : [])),
        );
      "
      @save="saveEdited"
    />
    <TextEntryDialog
      :open="textOpen"
      :can-append="!!doc && !doc.pdfAssetId"
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
      v-if="importOpen"
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
        aria-label="匯入 Word 文件"
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
          <h2>把你的筆記，帶進頁白。</h2>
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
              文件在瀏覽器內解析，不會上傳伺服器。保留標題、段落、粗體、清單、基本表格與內嵌圖片；文字方塊及複雜版面可能簡化，略過項目會另行提醒。PDF
              請使用工具列的「匯入 PDF」。
            </p>
          </div>
          <p class="dialog-footnote">
            新文件成功解析與排版後會建立新的一本，原有筆記保留在書架。
          </p></template
        >
      </section>
    </div>
    <ReflowDialog
      v-if="reflowOpen && doc?.pdfAssetId"
      :document="doc"
      :start-page="pages[index]?.fragments[0]?.pdf?.page || 1"
      @close="reflowOpen = false"
      @create="
        reflowOpen = false;
        createTextNotebook($event);
      "
    />
    <ModalShell v-if="helpOpen" title="閱讀指南" @close="helpOpen = false">
      <p>書頁依螢幕自動排版，把空間留給閱讀。</p>
      <h3>翻頁與細節</h3>
      <ul>
        <li>
          點兩側箭頭、使用 ← →，或在 Mac
          觸控板以兩指橫向滑動翻頁；手機可左右輕滑。
        </li>
        <li>點書頁底部頁碼，直接跳頁或前往首末頁。</li>
        <li>
          右下角放大鏡開啟細節閱讀，可捲動、縮放及切換頁面。搜尋可找到整本筆記中的文字。
        </li>
      </ul>
      <h3>整理書架</h3>
      <ul>
        <li>
          點左上「頁白」回書架。可切換卡片／條列、搜尋名稱、分頁、重新命名或複製筆記。
        </li>
        <li>點星星收藏到「我的最愛」；移除的筆記可在回收桶還原。</li>
        <li>
          匯入與貼上預設建立新的一本；貼上也能追加到目前筆記。選取文字可分類畫重點，加入標籤及心得。
        </li>
      </ul>
      <h3>檔案與保存</h3>
      <ul>
        <li>
          筆記存在目前瀏覽器；清除網站資料會移除筆記。請定期備份，換電腦時直接匯入
          ZIP，不需解壓縮；也相容舊版 JSON。
        </li>
        <li>
          備份包含圖片、PDF、重點、我的最愛、回收桶與閱讀位置；匯入會加入書架，保留原有筆記。
        </li>
        <li>
          Word／PDF 上限 10MB；PDF 最多 200
          頁，掃描頁沒有文字層時無法搜尋，目前沒有 OCR。
        </li>
        <li>
          圖文筆記支援 PNG／JPEG／WebP，每張原檔上限 10MB、自動縮圖，每本最多 50
          張。
        </li>
      </ul>
    </ModalShell>
    <ModalShell
      v-if="backupImportOpen"
      title="匯入書架備份"
      :busy="backupWorking"
      @close="backupImportOpen = false"
    >
      <p>
        直接選擇頁白匯出的 <strong>ZIP 備份</strong>，不需要解壓縮。也可匯入舊版
        JSON。
      </p>
      <p>
        筆記、圖片、PDF、重點、我的最愛及考前小卡會加入這個書架，原有筆記會保留。
      </p>
      <div v-if="backupError" class="backup-import-error" role="alert">
        <strong>無法匯入 {{ backupFileName }}</strong>
        <p>{{ backupError }}</p>
        <p>
          尚未加入任何內容，原有書架完整保留。請確認是頁白下載的完整備份，或重新選擇檔案。
        </p>
      </div>
      <button
        class="drop-zone"
        :disabled="backupWorking"
        @click="backupInput?.click()"
        @dragover.prevent.stop
        @drop.prevent.stop="
          $event.dataTransfer?.files[0] &&
          restoreBackup($event.dataTransfer.files[0])
        "
      >
        <AppIcon name="upload" :size="28" /><strong>{{
          backupWorking
            ? "正在檢查備份…"
            : backupError
              ? "重新選擇備份"
              : "選擇備份，或拖曳到這裡"
        }}</strong
        ><span>頁白 ZIP · 舊版 JSON</span>
      </button>
      <p class="dialog-footnote">
        Word 與 PDF 文件請使用書架上對應的匯入按鈕。
      </p>
    </ModalShell>
    <div
      v-if="dragOver"
      class="global-drop"
      @dragleave.self="dragOver = false"
      @drop.prevent.stop="dropFile"
    >
      <AppIcon name="upload" :size="42" /><strong
        >放開檔案，開始整理你的筆記</strong
      ><span>.docx / .pdf · 最大 10MB · 不上傳伺服器</span>
    </div>
  </div>
</template>
