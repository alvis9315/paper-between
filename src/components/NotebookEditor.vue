<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import type { Notebook } from "../core/model";
import { notebookHtml } from "../core/backup";
import { normalizeHtml } from "../core/normalize";
const props = defineProps<{ open: boolean; document?: Notebook }>();
const emit = defineEmits<{ close: []; save: [doc: Notebook] }>();
const title = ref("");
const editor = ref<HTMLElement>();
const error = ref("");
watch(
  () => props.open,
  async (open) => {
    if (open && props.document) {
      title.value = props.document.title;
      error.value = "";
      await nextTick();
      if (editor.value) {
        editor.value.innerHTML = notebookHtml(props.document);
        editor.value.focus();
      }
    }
  },
);
function paste(event: ClipboardEvent) {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.value?.contains(selection.anchorNode))
    return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
function save() {
  if (!props.document || !editor.value) return;
  try {
    if (!title.value.trim()) throw new Error("請輸入筆記名稱。");
    if (editor.value.innerHTML.length > 4_000_000)
      throw new Error("內容過大，請拆成較短的筆記。");
    const clone = editor.value.cloneNode(true) as HTMLElement;
    [...clone.querySelectorAll("div")].reverse().forEach((div) => {
      const p = document.createElement("p");
      p.innerHTML = div.innerHTML;
      div.replaceWith(p);
    });
    const parsed = normalizeHtml(clone.innerHTML, title.value.trim());
    emit("save", {
      ...parsed,
      id: props.document.id,
      warnings: props.document.warnings,
    });
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "無法儲存這份筆記。";
  }
}
</script>
<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section
      class="dialog notebook-editor"
      role="dialog"
      aria-modal="true"
      aria-label="編輯目前筆記"
    >
      <button
        class="dialog-close icon-button"
        aria-label="關閉編輯"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
      <h2>繼續整理，這一本想法。</h2>
      <p class="editor-hint">
        直接修改文字，保留既有標題、粗體與表格。貼上內容採純文字。
      </p>
      <form @submit.prevent="save">
        <label for="edit-title">筆記名稱</label
        ><input id="edit-title" v-model="title" maxlength="120" /><label
          id="editor-label"
          >筆記內容</label
        >
        <div
          ref="editor"
          class="rich-editor"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-labelledby="editor-label"
          @paste="paste"
        ></div>
        <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        <div class="editor-footer">
          <p>儲存後更新這一本並重新分頁。<br />取消會保留原本內容。</p>
          <button class="quiet-button" type="button" @click="emit('close')">
            取消</button
          ><button class="import-button" type="submit">儲存修改</button>
        </div>
      </form>
    </section>
  </div>
</template>
<style scoped>
.notebook-editor {
  max-width: 800px;
}
.editor-hint {
  font-size: 11px;
  line-height: 1.9;
  color: #9c8b77;
  margin: 9px 0 22px;
}
.notebook-editor form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.notebook-editor label {
  font-size: 12px;
  color: #80664f;
}
.notebook-editor input {
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border: 1px solid #d8c9b7;
  background: #fffaf3;
  color: #614b39;
  margin-bottom: 8px;
}
.rich-editor {
  height: 38dvh;
  min-height: 240px;
  overflow: auto;
  border: 1px solid #d8c9b7;
  border-radius: 6px;
  background: #fffdf7;
  padding: 20px;
  color: #574b3e;
  font-size: 14px;
  line-height: 1.9;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.rich-editor:focus {
  outline: 2px solid #aa8866;
  outline-offset: 2px;
}
.rich-editor :deep(p) {
  margin-bottom: 14px;
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
  border: 1px solid #d9cbbc;
  padding: 8px;
}
.rich-editor :deep(th) {
  background: #f1e8db;
}
.editor-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid #e1d5c7;
  padding-top: 17px;
  margin-top: 7px;
}
.editor-footer p {
  font-size: 10px;
  line-height: 1.8;
  color: #a08d78;
  margin-right: auto;
}
.editor-error {
  font-size: 12px;
  color: #a05339;
}
@media (max-width: 600px) {
  .notebook-editor {
    padding: 28px 20px;
  }
  .notebook-editor h2 {
    font-size: 21px;
  }
  .rich-editor {
    padding: 13px;
    font-size: 16px;
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
