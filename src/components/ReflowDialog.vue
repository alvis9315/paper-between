<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ModalShell from "./ModalShell.vue";
import ChoiceSelect from "./ChoiceSelect.vue";
import IconAction from "./IconAction.vue";
import { ArrowUp, ArrowDown, Trash2 } from "@lucide/vue";
import type { Notebook } from "../core/model";
import {
  renderReflowPage,
  suggestReflowMode,
  suggestReflowHeading,
  textFromRegion,
  cropReflowFigure,
  notebookFromReflow,
  type RegionText,
  type ReflowMode,
  type ReflowPage,
} from "../core/reflow";
const props = defineProps<{ document: Notebook; startPage: number }>();
const emit = defineEmits<{ close: []; create: [doc: Notebook] }>();
const page = ref(props.startPage),
  mode = ref<ReflowMode>("text"),
  fraction = ref(60),
  columns = ref<"auto" | "one" | "two">("auto");
const canvas = ref<HTMLCanvasElement>(),
  items = ref<RegionText[]>([]),
  body = ref(""),
  heading = ref(""),
  title = ref(`${props.document.title} · 重排`);
const manualHeading = ref(false);
const loading = ref(false),
  working = ref(false),
  error = ref(""),
  queue = ref<ReflowPage[]>([]),
  step = ref(1);
let token = 0,
  jobs = Promise.resolve();
function load() {
  const request = ++token;
  loading.value = true;
  error.value = "";
  jobs = jobs
    .catch(() => {})
    .then(async () => {
      if (request !== token || !canvas.value || !props.document.pdfAssetId)
        return;
      try {
        const data = await renderReflowPage(
          props.document.pdfAssetId,
          page.value,
          canvas.value,
        );
        if (request !== token) return;
        manualHeading.value = false;
        items.value = data;
        mode.value = suggestReflowMode(data);
        heading.value = `原檔第 ${page.value} 頁`;
        refreshText();
      } catch (e) {
        if (request === token)
          error.value = e instanceof Error ? e.message : "原頁載入失敗。";
      } finally {
        if (request === token) loading.value = false;
      }
    });
}
function refreshText() {
  if (!manualHeading.value)
    heading.value =
      suggestReflowHeading(items.value, mode.value, fraction.value / 100) ||
      `原檔第 ${page.value} 頁`;
  body.value = textFromRegion(
    items.value,
    mode.value,
    fraction.value / 100,
    columns.value,
  );
}
watch(page, load);
watch([mode, fraction, columns], refreshText);
onMounted(load);
onBeforeUnmount(() => {
  token++;
  void jobs.finally(() => {
    if (canvas.value) canvas.value.width = canvas.value.height = 0;
  });
});
const regionStyle = computed(() => ({
  width: mode.value === "left" ? `${fraction.value}%` : "100%",
  height: mode.value === "top" ? `${fraction.value}%` : "100%",
}));
async function addPage() {
  if (!canvas.value || loading.value || working.value) return;
  error.value = "";
  if (mode.value === "text" && !body.value.trim()) {
    error.value =
      "這頁沒有可讀文字。掃描頁目前沒有 OCR，請保留原貌或選擇圖解區域。";
    return;
  }
  if (queue.value.length >= 50) {
    error.value = "一次最多重排 50 頁。";
    return;
  }
  working.value = true;
  try {
    const image = await cropReflowFigure(
      canvas.value,
      mode.value,
      fraction.value / 100,
    );
    const entry = {
      page: page.value,
      title: heading.value,
      body: body.value,
      image,
    };
    const existing = queue.value.findIndex((p) => p.page === page.value);
    if (existing >= 0) queue.value[existing] = entry;
    else queue.value.push(entry);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "無法加入這一頁。";
  } finally {
    working.value = false;
  }
}
function reorder(n: number, direction: number) {
  const target = n + direction;
  if (target >= 0 && target < queue.value.length) {
    const value = queue.value.splice(n, 1)[0]!;
    queue.value.splice(target, 0, value);
  }
}
async function apply() {
  working.value = true;
  error.value = "";
  try {
    emit("create", await notebookFromReflow(queue.value, title.value));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "重排失敗，原筆記保留。";
  } finally {
    working.value = false;
  }
}
</script>
<template>
  <ModalShell title="圖文重排" wide :busy="working" @close="emit('close')">
    <p>保留完整圖解，讓說明文字放大重排。另建新筆記，原始 PDF 與重點保留。</p>
    <div class="reflow-steps" aria-label="重排步驟">
      <button :aria-current="step === 1 ? 'step' : undefined" @click="step = 1">
        1 選區與校正</button
      ><button
        :aria-current="step === 2 ? 'step' : undefined"
        :disabled="!queue.length"
        @click="step = 2"
      >
        2 確認 {{ queue.length }} 頁
      </button>
    </div>
    <div v-show="step === 1" class="reflow-workbench">
      <div>
        <label class="reflow-label"
          >來源頁<ChoiceSelect
            v-model="page"
            label="重排來源頁"
            :disabled="loading || working"
            :options="
              document.blocks.map((_, n) => ({
                value: n + 1,
                label: `原檔第 ${n + 1} 頁`,
              }))
            "
        /></label>
        <div class="reflow-original" :aria-busy="loading">
          <canvas ref="canvas" aria-label="重排原頁預覽" />
          <div
            v-if="mode !== 'text' && !loading"
            class="reflow-region"
            :style="regionStyle"
          >
            <span>保留圖解</span>
          </div>
        </div>
        <p class="reflow-hint">
          有顏色的範圍保留為完整圖解，其餘文字會顯示在右方。這版不會自動拆開圖解裡的卡片或箭頭。
        </p>
      </div>
      <div class="reflow-form">
        <label
          >排列方式<ChoiceSelect
            v-model="mode"
            label="重排模板"
            :disabled="loading || working"
            :options="[
              { value: 'text', label: '全文重排' },
              { value: 'top', label: '上方圖解，下方說明' },
              { value: 'left', label: '左側圖解，右側說明' },
            ]" /></label
        ><label v-if="mode !== 'text'"
          >圖解佔比 {{ fraction }}%<input
            v-model.number="fraction"
            type="range"
            min="20"
            max="90"
            aria-label="圖解區域佔比"
            :disabled="loading || working" /></label
        ><label
          >說明的欄位順序<ChoiceSelect
            v-model="columns"
            label="重排文字欄位"
            :disabled="loading || working"
            :options="[
              { value: 'auto', label: '自動判斷' },
              { value: 'one', label: '單欄' },
              { value: 'two', label: '先左欄，再右欄' },
            ]" /></label
        ><label
          >主題標題<input
            v-model="heading"
            @input="manualHeading = true"
            aria-label="重排主題標題"
            maxlength="120"
            :disabled="loading || working" /></label
        ><label
          >說明文字（可校正）<textarea
            v-model="body"
            rows="9"
            aria-label="重排說明文字"
            :disabled="loading || working"
          /></label
        ><button
          class="toolbar-button"
          :disabled="loading || working"
          @click="refreshText"
        >
          重新擷取文字</button
        ><button
          class="import-button"
          :disabled="loading || working"
          @click="addPage"
        >
          {{
            loading
              ? "正在讀取原頁…"
              : queue.some((p) => p.page === page)
                ? "更新這一頁"
                : "加入這一頁"
          }}
        </button>
        <p class="reflow-hint">
          先加入這一頁，再切換來源頁。放不下的內容會續到下一書頁。
        </p>
      </div>
    </div>
    <div v-if="step === 2" class="reflow-form">
      <label
        >新筆記名稱<input
          v-model="title"
          aria-label="重排筆記名稱"
          maxlength="120"
      /></label>
      <div v-for="(entry, n) in queue" :key="entry.page" class="reflow-queued">
        <div>
          <strong>{{ n + 1 }} · {{ entry.title }}</strong>
          <p>
            原檔第 {{ entry.page }} 頁 · {{ entry.image ? "含圖解 · " : ""
            }}{{ entry.body.length }} 字
          </p>
        </div>
        <IconAction
          compact
          :icon="ArrowUp"
          label="重排區塊上移"
          :disabled="n === 0 || working"
          @click="reorder(n, -1)"
        /><IconAction
          compact
          :icon="ArrowDown"
          label="重排區塊下移"
          :disabled="n === queue.length - 1 || working"
          @click="reorder(n, 1)"
        /><IconAction
          compact
          :icon="Trash2"
          label="移除重排頁"
          :disabled="working"
          @click="queue.splice(n, 1)"
        />
      </div>
      <p>
        建立後可用圖文編輯器繼續修正。圖解保持原樣；抽出的文字會用閱讀字級重新分頁。
      </p>
      <button
        class="import-button"
        :disabled="!queue.length || working"
        @click="apply"
      >
        {{ working ? "正在建立筆記…" : "建立重排筆記" }}
      </button>
    </div>
    <p v-if="error" class="reflow-error" role="alert">{{ error }}</p>
  </ModalShell>
</template>
<style scoped>
.reflow-steps {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}
.reflow-steps button {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--field);
  color: var(--ink);
}
.reflow-steps [aria-current="step"] {
  background: var(--accent);
  color: var(--on-accent);
}
.reflow-workbench {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}
.reflow-form,
.reflow-form label,
.reflow-label {
  display: grid;
  gap: 7px;
}
.reflow-form {
  gap: 14px;
}
.reflow-form input:not([type="range"]),
.reflow-form textarea {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-size: 16px;
  background: var(--field);
  color: var(--ink);
}
.reflow-original {
  position: relative;
  margin-top: 12px;
  background: white;
}
.reflow-original canvas {
  display: block;
  width: 100%;
  height: auto;
}
.reflow-region {
  position: absolute;
  left: 0;
  top: 0;
  border: 2px solid var(--accent);
  background: #88634f14;
  pointer-events: none;
}
.reflow-region span {
  position: absolute;
  left: 0;
  top: 0;
  padding: 2px 8px;
  font-size: 12px;
  background: var(--accent);
  color: var(--on-accent);
}
.reflow-hint,
.reflow-queued p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.8;
}
.reflow-queued {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  gap: 3px;
}
.reflow-queued > div {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.reflow-error {
  color: var(--danger);
  padding: 10px;
}
input[type="range"] {
  appearance: none;
  height: 24px;
  background: transparent;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 5px;
  background: var(--border);
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 21px;
  height: 21px;
  border: 2px solid var(--field);
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 1px 4px #30251d33;
  margin-top: -8px;
}
input[type="range"]::-moz-range-track {
  height: 5px;
  border-radius: 5px;
  background: var(--border);
}
input[type="range"]::-moz-range-thumb {
  width: 19px;
  height: 19px;
  border: 2px solid var(--field);
  border-radius: 50%;
  background: var(--accent);
}
@media (max-width: 700px) {
  .reflow-workbench {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .reflow-original {
    max-width: 440px;
    margin-inline: auto;
  }
}
</style>
