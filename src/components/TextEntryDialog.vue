<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import { MAX_TEXT_LENGTH, notebookFromText } from "../core/fromText";
import type { Notebook } from "../core/model";

const props = defineProps<{ open: boolean; canAppend?: boolean }>();
const emit = defineEmits<{
  close: [];
  create: [notebook: Notebook, mode: "new" | "append"];
}>();
const title = ref("");
const text = ref("");
const format = ref(true);
const mode = ref<"new" | "append">("new");
const error = ref("");
const input = ref<HTMLTextAreaElement>();
watch(
  () => props.open,
  async (open) => {
    if (open) {
      mode.value = "new";
      await nextTick();
      input.value?.focus();
    }
  },
);
watch([text, format], () => {
  error.value = "";
});
function submit() {
  try {
    emit(
      "create",
      notebookFromText(text.value, title.value, format.value),
      mode.value,
    );
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "無法建立筆記，請稍後再試。";
  }
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section
      class="dialog text-entry-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-entry-heading"
    >
      <button
        class="dialog-close icon-button"
        aria-label="關閉文字輸入"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
      <span class="dialog-emblem"><AppIcon name="edit" :size="28" /></span>
      <h2 id="text-entry-heading">讓想法，從這一頁開始。</h2>
      <p>直接輸入或貼上文字，我們會依螢幕大小自動排成紙頁。</p>
      <form class="text-entry-form" @submit.prevent="submit">
        <fieldset class="text-destination">
          <legend>放在哪裡？</legend>
          <label
            ><input
              v-model="mode"
              type="radio"
              value="new"
              name="text-destination"
            />建立新的一本</label
          ><label v-if="canAppend"
            ><input
              v-model="mode"
              type="radio"
              value="append"
              name="text-destination"
            />追加到目前筆記</label
          >
        </fieldset>
        <label for="text-note-title">筆記名稱 <span>選填</span></label>
        <input
          id="text-note-title"
          v-model="title"
          type="text"
          maxlength="120"
          :disabled="mode === 'append'"
          placeholder="例如：今天的閱讀筆記"
          autocomplete="off"
        />
        <label for="text-note-body">筆記內容</label>
        <textarea
          id="text-note-body"
          ref="input"
          v-model="text"
          placeholder="在這裡貼上你的內容…&#10;&#10;# 我的筆記&#10;這是一段文字，也能使用 **粗體**。&#10;&#10;- 第一個重點&#10;- 第二個重點"
          :aria-invalid="!!error"
          aria-describedby="text-format-hint text-input-error"
          spellcheck="false"
        ></textarea>
        <div class="text-entry-options">
          <label class="format-toggle"
            ><input v-model="format" type="checkbox" />辨識基本格式</label
          ><span
            class="text-length"
            :class="{ exceeded: text.length > MAX_TEXT_LENGTH }"
            >{{ text.length.toLocaleString("zh-TW") }} /
            {{ MAX_TEXT_LENGTH.toLocaleString("zh-TW") }} 字元</span
          >
        </div>
        <p id="text-format-hint" class="text-format-hint">
          {{
            format
              ? "支援 # 標題、**粗體**、- 清單與 1. 編號。空行分段，單次換行會保留。"
              : "保留純文字與換行，所有符號照原樣顯示，不辨識格式。"
          }}
          不會自動摘要或改寫內容。
        </p>
        <p
          id="text-input-error"
          class="text-input-error"
          :role="error ? 'alert' : undefined"
        >
          {{ error }}
        </p>
        <div class="text-entry-footer">
          <p>
            {{
              mode === "append"
                ? "原有內容保留，新內容接在筆記最後。"
                : "建立新的一本，原有筆記保留在書架。"
            }}<br />關閉視窗會保留草稿；重新整理會清除尚未建立的草稿。
          </p>
          <div class="text-entry-actions">
            <button class="quiet-button" type="button" @click="emit('close')">
              稍後再寫</button
            ><button class="import-button" type="submit">
              <AppIcon name="book" :size="16" />{{
                mode === "append" ? "追加內容" : "建立筆記"
              }}
            </button>
          </div>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.text-entry-dialog {
  max-width: 680px;
  padding: 30px 34px;
}
.text-entry-dialog .dialog-emblem {
  width: 46px;
  height: 46px;
  margin-bottom: 17px;
}
.text-entry-dialog > p {
  font-size: 12px;
  color: var(--text-secondary, #8b7c6d);
  line-height: 1.8;
}
.text-entry-form {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 23px;
}
.text-entry-form > label {
  font-size: 12px;
  color: var(--text-primary, #6f5c4c);
  margin-top: 3px;
}
.text-entry-form > label > span {
  font-size: 10px;
  color: var(--text-secondary, #a19485);
  margin-left: 7px;
}
.text-entry-form > input,
.text-entry-form textarea {
  width: 100%;
  border: 1px solid var(--line, #d9cbbc);
  background: var(--surface-raised, #fefcf7);
  color: var(--text-primary, #4b4036);
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  padding: 11px 12px;
}
.text-entry-form > input {
  margin-bottom: 9px;
  height: 40px;
}
.text-entry-form textarea {
  min-height: 200px;
  height: clamp(180px, 30dvh, 300px);
  max-height: 50dvh;
  resize: vertical;
  line-height: 1.85;
}
.text-entry-form textarea::placeholder,
.text-entry-form > input::placeholder {
  color: var(--text-secondary, #aa9d8f);
}
.text-entry-form textarea:focus-visible {
  outline: 2px solid var(--line-strong, #9f7d60);
  outline-offset: 2px;
}
.text-entry-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
}
.format-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--text-primary, #75604e);
  cursor: pointer;
}
.format-toggle input {
  accent-color: var(--accent, #88634f);
  margin: 0;
  width: 14px;
  height: 14px;
}
.text-length {
  font-size: 10px;
  color: var(--text-secondary, #a29384);
}
.text-length.exceeded,
.text-input-error {
  color: var(--danger, #a05339);
}
.text-format-hint {
  font-size: 10px;
  line-height: 1.8;
  color: var(--text-secondary, #968775);
}
.text-input-error {
  font-size: 11px;
  line-height: 1.6;
  min-height: 0;
}
.text-entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid var(--line, #e4d9cd);
  padding-top: 16px;
  margin-top: 4px;
}
.text-entry-footer > p {
  font-size: 10px;
  line-height: 1.8;
  color: var(--text-secondary, #9b8c7b);
}
.text-entry-actions {
  display: flex;
  gap: 9px;
  align-items: center;
  white-space: nowrap;
}
.text-entry-actions .quiet-button {
  font-size: 11px;
}
@media (max-width: 600px) {
  .text-entry-dialog {
    padding: 25px 21px;
  }
  .text-entry-dialog h2 {
    font-size: 21px;
  }
  .text-entry-dialog > p {
    font-size: 11px;
  }
  .text-entry-form {
    margin-top: 18px;
  }
  .text-entry-form textarea {
    font-size: 16px;
    min-height: 180px;
    height: 27dvh;
  }
  .text-entry-form > input {
    font-size: 16px;
  }
  .text-entry-options {
    gap: 8px;
  }
  .text-length {
    font-size: 9px;
  }
  .text-entry-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .text-entry-actions {
    justify-content: flex-end;
  }
  .text-entry-dialog .dialog-emblem {
    width: 40px;
    height: 40px;
    margin-bottom: 12px;
  }
  .text-entry-dialog .dialog-emblem svg {
    width: 23px;
  }
}
</style>
