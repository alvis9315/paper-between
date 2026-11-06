<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from "@tiptap/vue-3";
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { mediaUrl } from "../core/media";
import { imageLayoutStyle } from "../core/imageLayout";
import ChoiceSelect from "./ChoiceSelect.vue";
import AppIcon from "./AppIcon.vue";
import IconAction from "./IconAction.vue";
import { X } from "@lucide/vue";
const props = defineProps(nodeViewProps);
const src = ref("");
const error = ref("");
const target = ref<HTMLElement>();
const copyEmpty = computed(() => !props.node.textContent.trim());
const groupNumber = computed(() => {
  let n = 0;
  const position = props.getPos();
  props.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "figureNote" && pos <= Number(position)) n++;
  });
  return n;
});
function focusCopy() {
  if (!props.editor.isEditable) return;
  const position = props.getPos();
  if (typeof position === "number") {
    // Focus synchronously so the first keystroke after clicking the label is kept.
    props.editor.view.focus();
    props.editor.commands.setTextSelection(position + 2);
    props.editor.commands.scrollIntoView();
  }
}
let observer: IntersectionObserver | undefined;
async function load() {
  try {
    src.value = await mediaUrl(props.node.attrs.mediaId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "無法讀取圖片";
  }
}
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void load();
        observer?.disconnect();
      }
    },
    { rootMargin: "300px" },
  );
  if (target.value) observer.observe(target.value);
});
watch(
  () => props.node.attrs.mediaId,
  () => {
    src.value = "";
    void load();
  },
);
onBeforeUnmount(() => observer?.disconnect());
function move(direction: number) {
  const position = props.getPos();
  if (typeof position !== "number") return;
  const { state, view } = props.editor;
  const resolved = state.doc.resolve(position),
    index = resolved.index(0);
  if (
    resolved.depth !== 0 ||
    index + direction < 0 ||
    index + direction >= state.doc.childCount
  )
    return;
  const neighbour = state.doc.child(index + direction),
    current = state.doc.child(index);
  const from = direction < 0 ? position - neighbour.nodeSize : position;
  const to =
    direction < 0
      ? position + current.nodeSize
      : position + current.nodeSize + neighbour.nodeSize;
  const tr = state.tr.replaceWith(
    from,
    to,
    direction < 0 ? [current, neighbour] : [neighbour, current],
  );
  view.dispatch(tr);
  props.editor.commands.focus();
}
</script>
<template>
  <NodeViewWrapper
    class="editor-figure"
    :class="{ stacked: node.attrs.layout === 'stacked' }"
  >
    <div class="figure-group-heading" contenteditable="false">
      <span
        >圖文 {{ groupNumber }}<small>每組圖片都有自己的對應文字</small></span
      ><IconAction
        compact
        :icon="X"
        label="刪除此圖文區塊"
        :disabled="!editor.isEditable"
        danger
        @mousedown.prevent
        @click="deleteNode()"
      />
    </div>
    <div ref="target" class="editor-image-side" contenteditable="false">
      <div
        class="editor-image-preview proportional-image"
        :style="imageLayoutStyle(node.attrs.width, node.attrs.height)"
      >
        <img
          v-if="src"
          :src="src"
          :alt="node.attrs.alt"
          :width="node.attrs.width"
          :height="node.attrs.height"
          loading="lazy"
        /><span v-else>{{ error || "圖片載入中…" }}</span>
      </div>
      <label
        >圖說<input
          :value="node.attrs.caption"
          aria-label="圖片圖說"
          @input="
            updateAttributes({
              caption: ($event.target as HTMLInputElement).value,
            })
          " /></label
      ><label
        >替代文字<input
          :value="node.attrs.alt"
          aria-label="圖片替代文字"
          @input="
            updateAttributes({ alt: ($event.target as HTMLInputElement).value })
          "
      /></label>
      <div class="figure-actions">
        <ChoiceSelect
          :model-value="String(node.attrs.layout)"
          label="圖文版型"
          :options="[
            { value: 'side', label: '左圖右文' },
            { value: 'stacked', label: '上圖下文' },
          ]"
          :disabled="!editor.isEditable"
          @update:model-value="updateAttributes({ layout: $event })"
        /><button type="button" @click="move(-1)">上移</button
        ><button type="button" @click="move(1)">下移</button>
      </div>
    </div>
    <div
      class="editor-copy-pane"
      :class="{ empty: copyEmpty }"
      @click.self="focusCopy"
      @keydown.enter.self.prevent="focusCopy"
      tabindex="0"
      aria-label="對應文字輸入區"
    >
      <div
        class="editor-copy-label"
        contenteditable="false"
        @mousedown.prevent
        @click="focusCopy"
      >
        <AppIcon name="edit" :size="15" />對應文字
        <span>{{ copyEmpty ? "點這裡開始寫" : "可繼續補充" }}</span>
      </div>
      <NodeViewContent
        class="editor-figure-copy"
        :data-empty="copyEmpty"
        data-placeholder="輸入這張圖片的說明、重點或你的理解…"
        @click="copyEmpty && focusCopy()"
      />
    </div>
  </NodeViewWrapper>
</template>
<style scoped>
.editor-figure {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
  gap: 20px;
  padding: 18px;
  border: 1px solid var(--line, #dac9b5);
  border-radius: 7px;
  margin: 16px 0;
  background: var(--surface-panel, #f7f1e8);
  position: relative;
}
.editor-figure.stacked {
  display: block;
}
.editor-image-side {
  min-width: 0;
  color: var(--text-secondary, #9a8167);
  font-size: 11px;
}
.editor-image-preview {
  --image-max-height: 240px;
  margin: 0 auto 12px;
}
.editor-image-side label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 10px;
}
.editor-image-side input {
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--line, #d9c8b2);
  border-radius: 4px;
  background: var(--surface-raised, #fffaf2);
  color: var(--text-primary, #765a40);
}
.figure-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.figure-actions select,
.figure-actions button {
  font: inherit;
  font-size: 10px;
  background: var(--surface-panel, #ede1d1);
  border: 0;
  padding: 6px;
  border-radius: 4px;
  color: var(--text-primary, #805e43);
}
.editor-figure-copy {
  min-width: 0;
  white-space: pre-wrap;
  flex: 1;
  min-height: 150px;
  position: relative;
  outline: none;
}
.stacked .editor-copy-pane {
  margin-top: 18px;
}
.figure-group-heading {
  grid-column: 1/-1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}
.figure-group-heading > span {
  display: flex;
  align-items: center;
  gap: 12px;
}
.figure-group-heading small {
  font-size: 11px;
  color: var(--muted);
  font-weight: 400;
}
.remove-figure {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  background: var(--field);
  color: var(--muted);
  border-radius: 50%;
}
.remove-figure:hover {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--surface);
}
.editor-copy-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 14px;
  background: var(--field);
  cursor: text;
  color: var(--ink);
}
.editor-copy-pane:focus-within,
.editor-copy-pane:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--focus-soft);
  outline-offset: 2px;
}
.editor-copy-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 13px;
  color: var(--accent);
  margin-bottom: 14px;
  cursor: text;
}
.editor-copy-label span {
  font-size: 11px;
  font-weight: 400;
  margin-left: auto;
  color: var(--muted);
}
.editor-figure-copy[data-empty="true"]::before {
  content: attr(data-placeholder);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  color: var(--muted);
  font-size: 14px;
  pointer-events: none;
}
@media (max-width: 650px) {
  .remove-figure {
    width: 44px;
    height: 44px;
  }
  .editor-figure {
    display: block;
    padding: 12px;
  }
  .editor-copy-pane {
    margin-top: 17px;
  }
  .editor-image-preview {
    --image-max-height: 200px;
  }
  .figure-group-heading {
    margin-bottom: 16px;
  }
  .figure-group-heading small {
    display: none;
  }
}
</style>
