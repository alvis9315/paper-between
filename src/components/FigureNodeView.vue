<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from "@tiptap/vue-3";
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { mediaUrl } from "../core/media";
const props = defineProps(nodeViewProps);
const src = ref("");
const error = ref("");
const target = ref<HTMLElement>();
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
    ><div ref="target" class="editor-image-side" contenteditable="false">
      <img
        v-if="src"
        :src="src"
        :alt="node.attrs.alt"
        :width="node.attrs.width"
        :height="node.attrs.height"
        loading="lazy"
      /><span v-else>{{ error || "圖片載入中…" }}</span
      ><label
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
        <select
          :value="node.attrs.layout"
          aria-label="圖文版型"
          @change="
            updateAttributes({
              layout: ($event.target as HTMLSelectElement).value,
            })
          "
        >
          <option value="side">左圖右文</option>
          <option value="stacked">上圖下文</option></select
        ><button type="button" @click="move(-1)">上移</button
        ><button type="button" @click="move(1)">下移</button
        ><button type="button" @click="deleteNode()">移除這組</button>
      </div>
    </div>
    <NodeViewContent class="editor-figure-copy"
  /></NodeViewWrapper>
</template>
<style scoped>
.editor-figure {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
  gap: 20px;
  padding: 18px;
  border: 1px solid #dac9b5;
  border-radius: 7px;
  margin: 16px 0;
  background: #f7f1e8;
}
.editor-figure.stacked {
  display: block;
}
.editor-image-side {
  min-width: 0;
  color: #9a8167;
  font-size: 11px;
}
.editor-image-side > img {
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: contain;
  display: block;
  background: #ece2d5;
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
  border: 1px solid #d9c8b2;
  border-radius: 4px;
  background: #fffaf2;
  color: #765a40;
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
  background: #ede1d1;
  border: 0;
  padding: 6px;
  border-radius: 4px;
  color: #805e43;
}
.editor-figure-copy {
  min-width: 0;
  white-space: pre-wrap;
}
.stacked .editor-figure-copy {
  margin-top: 18px;
}
@media (max-width: 650px) {
  .editor-figure {
    display: block;
    padding: 12px;
  }
  .editor-figure-copy {
    margin-top: 17px;
  }
  .editor-image-side > img {
    max-height: 200px;
  }
}
</style>
