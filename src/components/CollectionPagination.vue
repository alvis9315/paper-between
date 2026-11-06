<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "@lucide/vue";
import IconAction from "./IconAction.vue";
import { pageNumbers } from "../core/navigation";
const props = defineProps<{
  total: number;
  pageSize: number;
  disabled?: boolean;
}>();
const page = defineModel<number>({ required: true });
const totalPages = computed(() => Math.ceil(props.total / props.pageSize));
const numbers = computed(() => pageNumbers(totalPages.value, page.value));
const input = ref(String(page.value));
const error = ref("");
watch(page, (value) => {
  input.value = String(value);
  error.value = "";
});
function go(target: number) {
  if (!props.disabled)
    page.value = Math.max(1, Math.min(totalPages.value, target));
}
function jump() {
  const target = Number(input.value);
  if (!Number.isInteger(target) || target < 1 || target > totalPages.value) {
    error.value = `請輸入 1–${totalPages.value} 的整數頁碼。`;
    return;
  }
  error.value = "";
  go(target);
}
</script>
<template>
  <nav class="collection-pagination" aria-label="書架分頁">
    <p aria-live="polite">
      第 {{ (page - 1) * pageSize + 1 }}–{{
        Math.min(page * pageSize, total)
      }}
      本，共 {{ total }} 本
    </p>
    <div class="collection-pages">
      <IconAction
        compact
        :icon="ChevronFirst"
        label="書架：第一頁"
        :disabled="disabled || page === 1"
        @click="go(1)"
      />
      <IconAction
        compact
        :icon="ChevronLeft"
        label="書架：上一頁"
        :disabled="disabled || page === 1"
        @click="go(page - 1)"
      />
      <template v-for="n in numbers" :key="n">
        <button
          v-if="typeof n === 'number'"
          class="collection-page"
          :aria-label="`書架第 ${n} 頁`"
          :aria-current="page === n ? 'page' : undefined"
          :disabled="disabled"
          @click="go(n)"
        >
          {{ n }}
        </button>
        <span v-else class="collection-gap" aria-hidden="true">…</span>
      </template>
      <span class="collection-mobile-count" aria-live="polite"
        >{{ page }} / {{ totalPages }}</span
      >
      <IconAction
        compact
        :icon="ChevronRight"
        label="書架：下一頁"
        :disabled="disabled || page === totalPages"
        @click="go(page + 1)"
      />
      <IconAction
        compact
        :icon="ChevronLast"
        label="書架：最後一頁"
        :disabled="disabled || page === totalPages"
        @click="go(totalPages)"
      />
    </div>
    <form @submit.prevent="jump">
      <label
        >跳至<input
          v-model="input"
          inputmode="numeric"
          aria-label="書架頁碼"
          :aria-invalid="!!error"
          :disabled="disabled"
      /></label>
      <button class="toolbar-button" :disabled="disabled">前往</button>
      <span v-if="error" role="alert">{{ error }}</span>
    </form>
  </nav>
</template>
<style scoped>
.collection-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px 24px;
  margin: 28px 0;
  font-size: 12px;
  color: var(--muted);
}
.collection-pages,
form,
label {
  display: flex;
  align-items: center;
  gap: 5px;
}
.collection-mobile-count {
  display: none;
}
.collection-page {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
}
.collection-page:hover,
.collection-page[aria-current="page"] {
  background: var(--accent);
  color: var(--on-accent);
}
input {
  width: 44px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--field);
  color: var(--ink);
  padding: 7px 4px;
  text-align: center;
  font: inherit;
}
form {
  flex-wrap: wrap;
  justify-content: center;
}
form [role="alert"] {
  width: 100%;
  color: var(--danger);
  text-align: center;
}
@media (max-width: 540px) {
  .collection-pagination > p {
    width: 100%;
    text-align: center;
  }
  .collection-pages {
    gap: 0;
  }
  .collection-pages > .collection-page,
  .collection-pages > .collection-gap {
    display: none;
  }
  .collection-mobile-count {
    display: inline-block;
    min-width: 58px;
    text-align: center;
  }
}
</style>
