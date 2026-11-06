<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import AppIcon from "./AppIcon.vue";
import type { Notebook } from "../core/model";
import { notebookHtml } from "../core/backup";
import { normalizeHtml } from "../core/normalize";
import { FigureNote, StableIds } from "../core/editorExtensions";
import {
  prepareImage,
  getMedia,
  storageUsage,
  validateBookMedia,
} from "../core/media";
const props = defineProps<{ open: boolean; document?: Notebook }>();
const emit = defineEmits<{ close: []; save: [doc: Notebook] }>();
const title = ref(props.document?.title || "");
const error = ref("");
const processing = ref("");
const count = ref(0);
const bytes = ref(0);
const quota = ref("");
const fileInput = ref<HTMLInputElement>();
const isEmpty = computed(() => editor.value?.isEmpty ?? true);
let lastSignature = "";
const editor = useEditor({
  parseOptions: { preserveWhitespace: "full" },
  extensions: [
    StarterKit,
    TableKit.configure({ table: { resizable: false } }),
    FigureNote,
    StableIds,
  ],
  content: props.document ? notebookHtml(props.document) : "<p></p>",
  editorProps: {
    attributes: {
      role: "textbox",
      "aria-label": "筆記內容",
      spellcheck: "false",
    },
    handlePaste: (_view, event) => {
      const files = [...(event.clipboardData?.files || [])].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        void addImages(files);
        return true;
      }
      return false;
    },
    handleDrop: (_view, event) => handleImageDrop(event),
  },
  onUpdate: () => {
    void updateUsage();
  },
});
onMounted(async () => {
  await updateUsage();
  quota.value = await storageUsage();
});
function handleImageDrop(event: DragEvent) {
  const files = [...(event.dataTransfer?.files || [])];
  if (!files.length) return false;
  event.preventDefault();
  event.stopPropagation();
  void addImages(files);
  return true;
}
async function updateUsage() {
  if (!editor.value) return;
  const ids: string[] = [];
  editor.value.state.doc.descendants((n) => {
    if (n.type.name === "figureNote") ids.push(n.attrs.mediaId);
  });
  count.value = ids.length;
  const signature = ids.join("|");
  if (signature === lastSignature) return;
  lastSignature = signature;
  let total = 0;
  for (const id of new Set(ids)) {
    try {
      total += (await getMedia(id)).bytes;
    } catch {}
  }
  if (signature === lastSignature) bytes.value = total;
}
watch(
  () => props.open,
  async (open) => {
    if (open) {
      title.value = props.document?.title || "";
      error.value = "";
      processing.value = "";
      editor.value?.commands.setContent(
        props.document ? notebookHtml(props.document) : "<p></p>",
        { parseOptions: { preserveWhitespace: "full" } },
      );
      lastSignature = "";
      void updateUsage();
      quota.value = await storageUsage();
    } else editor.value?.commands.setContent("<p></p>");
  },
);
async function addImages(files: File[]) {
  if (processing.value || !editor.value) return;
  error.value = "";
  if (count.value + files.length > 50) {
    error.value = "每本最多 50 張圖片，請拆成多本筆記。";
    return;
  }
  editor.value.setEditable(false);
  try {
    const assets = [];
    let total = bytes.value;
    for (let i = 0; i < files.length; i++) {
      processing.value = `正在處理第 ${i + 1}／${files.length} 張圖片…`;
      const asset = await prepareImage(files[i]!);
      total += asset.bytes;
      if (total > 50 * 1024 * 1024)
        throw new Error("這本圖片合計超過 50MB，請拆成多本筆記。");
      assets.push(asset);
    }
    for (const asset of assets)
      editor.value.commands.insertContentAt(
        editor.value.state.doc.content.size,
        [
          {
            type: "figureNote",
            attrs: {
              mediaId: asset.id,
              width: asset.width,
              height: asset.height,
              alt: asset.name,
              layout: "side",
              caption: "",
            },
            content: [{ type: "paragraph" }],
          },
          { type: "paragraph" },
        ],
      );
    await updateUsage();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "圖片處理失敗。";
  } finally {
    processing.value = "";
    editor.value.setEditable(true);
    if (fileInput.value) fileInput.value.value = "";
  }
}
async function save() {
  if (!editor.value || processing.value) return;
  try {
    if (!title.value.trim()) throw new Error("請輸入筆記名稱。");
    const html = editor.value.getHTML();
    if (html.length > 4000000) throw new Error("內容過大，請拆成較短的筆記。");
    const parsed = normalizeHtml(html, title.value.trim());
    await validateBookMedia(parsed);
    emit("save", {
      ...parsed,
      id: props.document?.id || parsed.id,
      warnings: props.document?.warnings || [],
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "無法儲存這份筆記。";
  }
}
</script>
<template>
  <div
    v-if="open"
    class="modal-backdrop"
    @click.self="!processing && emit('close')"
  >
    <section
      class="dialog notebook-editor"
      role="dialog"
      aria-modal="true"
      @keydown.esc.stop.prevent="!processing && emit('close')"
      :aria-label="document ? '編輯目前筆記' : '新增圖文筆記'"
    >
      <button
        class="dialog-close icon-button"
        :disabled="!!processing"
        aria-label="關閉編輯"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
      <h2>
        {{ document ? "繼續整理，這一本想法。" : "一張圖片，一段自己的理解。" }}
      </h2>
      <p class="editor-hint">
        可持續新增多組圖文，貼上截圖或拖曳圖片也可以。手機會以上圖下文呈現。
      </p>
      <form @submit.prevent="save">
        <label for="edit-title">筆記名稱</label
        ><input
          id="edit-title"
          v-model="title"
          maxlength="120"
          :disabled="!!processing"
          placeholder="替這本圖文筆記取個名字"
        />
        <div class="rich-toolbar" aria-label="文字與圖片工具">
          <button
            type="button"
            :disabled="!!processing"
            @click="editor?.chain().focus().toggleBold().run()"
          >
            粗體</button
          ><button
            type="button"
            :disabled="!!processing"
            @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
          >
            標題</button
          ><button
            type="button"
            :disabled="!!processing"
            @click="editor?.chain().focus().toggleBulletList().run()"
          >
            清單</button
          ><button
            type="button"
            :disabled="!!processing"
            @click="fileInput?.click()"
          >
            <AppIcon name="image" :size="15" />加入圖片</button
          ><span
            >{{ count }}／50 張 · {{ (bytes / 1048576).toFixed(1) }}／50MB</span
          >
        </div>
        <input
          ref="fileInput"
          id="image-files"
          class="visually-hidden"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          @change="
            addImages([...(($event.target as HTMLInputElement).files || [])])
          "
        />
        <div class="rich-editor" @drop="handleImageDrop">
          <div
            v-if="isEmpty && count === 0 && !processing"
            class="editor-empty-guide"
          >
            <AppIcon name="image" :size="30" /><strong>從第一組圖文開始</strong>
            <ol>
              <li>
                按「加入圖片」，一張圖片一組，可一次選多張並持續往下新增。
              </li>
              <li>直接把圖片拖曳到這個區塊，也可以貼上截圖。</li>
            </ol>
            <button
              type="button"
              class="add-image-group"
              @click="fileInput?.click()"
            >
              ＋ 加入第一張圖片
            </button>
            <span>只想寫文字？也可以直接在下方輸入。</span>
          </div>
          <EditorContent
            :editor="editor"
            class="editor-content"
            :class="{ empty: isEmpty }"
          />
          <button
            v-if="count > 0"
            class="add-image-group another-group"
            type="button"
            :disabled="!!processing"
            @click="fileInput?.click()"
          >
            ＋ 再加入一組圖文<span>或直接拖放下一張圖片</span>
          </button>
        </div>
        <p class="image-limits">
          PNG／JPEG／WebP；原圖 10MB 內，自動縮至長邊 2,000px，儲存後每張最多
          2MB。{{ quota }}
        </p>
        <p v-if="processing" class="editor-processing" role="status">
          {{ processing }}
        </p>
        <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        <div class="editor-footer">
          <p>
            {{
              document
                ? "儲存後更新這一本並重新分頁。"
                : "建立新的一本，原有筆記保留。"
            }}<br />取消會保留原有內容。
          </p>
          <button
            class="quiet-button"
            type="button"
            :disabled="!!processing"
            @click="emit('close')"
          >
            取消</button
          ><button class="import-button" type="submit" :disabled="!!processing">
            {{ document ? "儲存修改" : "建立圖文筆記" }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
<style scoped>
.notebook-editor {
  max-width: 1000px;
  padding: 30px 34px;
}
.editor-hint {
  font-size: 11px;
  line-height: 1.9;
  color: var(--text-secondary, #927c65);
  margin: 9px 0 18px;
}
.notebook-editor form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.notebook-editor label {
  font-size: 12px;
  color: var(--text-primary, #80664f);
}
.notebook-editor input {
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border: 1px solid var(--line, #d8c9b7);
  background: var(--surface-raised, #fffaf3);
  color: var(--text-primary, #614b39);
}
.rich-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  background: var(--surface-panel, #f2e8da);
  border: 1px solid var(--line, #dfcbb4);
  padding: 7px;
  border-radius: 5px;
}
.rich-toolbar button {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  background: var(--surface-raised, #fff8ed);
  color: var(--text-primary, #886344);
  padding: 7px 10px;
}
.rich-toolbar span {
  font-size: 10px;
  color: var(--text-secondary, #a18b72);
  margin-left: auto;
}
.rich-editor {
  max-height: 50dvh;
  min-height: 240px;
  overflow: auto;
  border: 1px solid var(--line, #d8c9b7);
  border-radius: 6px;
  background: var(--surface-raised, #fffdf7);
  color: var(--text-primary, #574b3e);
  font-size: 14px;
  line-height: 1.9;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.rich-editor :deep(.tiptap) {
  padding: 20px;
  min-height: 270px;
  outline: none;
}
.editor-empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 26px 22px 14px;
  text-align: center;
  color: var(--muted);
  white-space: normal;
}
.editor-empty-guide strong {
  font-size: 17px;
  color: var(--heading);
  font-weight: 500;
}
.editor-empty-guide ol {
  font-size: 13px;
  line-height: 1.9;
  text-align: left;
  margin: 0;
  padding-left: 22px;
  max-width: 480px;
}
.editor-empty-guide > span {
  font-size: 12px;
}
.add-image-group {
  background: var(--surface-inset);
  border: 1px dashed var(--border-strong);
  color: var(--accent);
  font-size: 13px;
  padding: 11px 18px;
}
.another-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  margin: 0 20px 20px;
  width: calc(100% - 40px);
}
.another-group span {
  font-size: 11px;
  color: var(--muted);
}
.editor-content.empty :deep(.tiptap) {
  min-height: 80px;
}
.rich-editor:focus-within {
  outline: 2px solid var(--line-strong, #aa8866);
  outline-offset: 2px;
}
.rich-editor :deep(p) {
  margin: 0 0 13px;
}
.rich-editor :deep(h1) {
  font-size: 25px;
}
.rich-editor :deep(h2) {
  font-size: 21px;
}
.rich-editor :deep(h3) {
  font-size: 17px;
}
.rich-editor :deep(table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  font-size: 12px;
}
.rich-editor :deep(td),
.rich-editor :deep(th) {
  border: 1px solid var(--line, #d9cbbc);
  padding: 8px;
}
.rich-editor :deep(th) {
  background: var(--surface-panel, #f1e8db);
}
.rich-editor :deep(.ProseMirror-selectednode) {
  outline: 2px solid var(--line-strong, #a78b6c);
}
.image-limits {
  font-size: 10px;
  color: var(--text-secondary, #a08c75);
  line-height: 1.8;
}
.editor-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--line, #e1d5c7);
  padding-top: 14px;
  margin-top: 3px;
}
.editor-footer p {
  font-size: 10px;
  line-height: 1.8;
  color: var(--text-secondary, #a08d78);
  margin-right: auto;
}
.editor-error {
  font-size: 12px;
  color: var(--danger, #a05339);
}
.editor-processing {
  font-size: 12px;
  color: var(--text-primary, #947047);
}
@media (max-width: 600px) {
  .notebook-editor {
    padding: 28px 18px;
  }
  .notebook-editor h2 {
    font-size: 21px;
  }
  .rich-editor {
    font-size: 16px;
    max-height: 45dvh;
  }
  .rich-editor :deep(.tiptap) {
    padding: 12px;
  }
  .editor-footer {
    flex-wrap: wrap;
  }
  .editor-footer p {
    width: 100%;
    flex-basis: 100%;
  }
  .notebook-editor input {
    font-size: 16px;
  }
}
</style>
