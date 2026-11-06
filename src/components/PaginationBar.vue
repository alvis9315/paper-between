<script setup lang="ts">
import { computed, ref } from "vue";
import { pageNumbers } from "../core/navigation";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{
  index: number;
  total: number;
  single: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ jump: [page: number]; move: [direction: number] }>();
const input = ref("");
const error = ref("");
const end = computed(() =>
  Math.min(props.total, props.index + (props.single ? 1 : 2)),
);
const numbers = computed(() => pageNumbers(props.total, props.index + 1));
function jump() {
  const value = Number(input.value);
  if (
    !/^\d+$/.test(input.value) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > props.total
  ) {
    error.value = `請輸入 1 至 ${props.total} 的頁碼`;
    return;
  }
  error.value = "";
  emit("jump", value);
  input.value = "";
}
</script>
<template>
  <nav class="pagination" aria-label="頁碼與翻頁控制">
    <div class="reading-range" aria-live="polite">
      第
      <strong>{{ index + 1 }}{{ end > index + 1 ? `–${end}` : "" }}</strong> 頁
      <span>／ 共 {{ total }} 頁</span>
    </div>
    <div class="page-controls">
      <button
        class="icon-button endpoint"
        aria-label="首頁"
        title="首頁"
        :disabled="disabled || index === 0"
        @click="emit('jump', 1)"
      >
        <AppIcon name="first" />
      </button>
      <button
        class="icon-button"
        aria-label="上一頁"
        title="上一頁（←）"
        :disabled="disabled || index === 0"
        @click="emit('move', -1)"
      >
        <AppIcon name="left" />
      </button>
      <div class="page-numbers">
        <template v-for="n in numbers" :key="n"
          ><span v-if="typeof n === 'string'" class="ellipsis">…</span
          ><button
            v-else
            class="number-button"
            :class="{ current: n >= index + 1 && n <= end }"
            :aria-label="`跳到第 ${n} 頁`"
            :aria-current="n >= index + 1 && n <= end ? 'page' : undefined"
            :disabled="disabled"
            @click="emit('jump', n)"
          >
            {{ n }}
          </button></template
        >
      </div>
      <button
        class="icon-button"
        aria-label="下一頁"
        title="下一頁（→）"
        :disabled="disabled || end >= total"
        @click="emit('move', 1)"
      >
        <AppIcon name="right" />
      </button>
      <button
        class="icon-button endpoint"
        aria-label="末頁"
        title="末頁"
        :disabled="disabled || end >= total"
        @click="emit('jump', total)"
      >
        <AppIcon name="last" />
      </button>
    </div>
    <form class="jump-form" @submit.prevent="jump">
      <label for="jump-page">跳至</label
      ><input
        id="jump-page"
        v-model="input"
        inputmode="numeric"
        autocomplete="off"
        placeholder="頁碼"
        aria-label="輸入頁碼"
        :aria-invalid="!!error"
        :disabled="disabled"
        @input="error = ''"
      /><button type="submit" :disabled="disabled" aria-label="前往頁碼">
        <AppIcon name="right" :size="16" /></button
      ><span v-if="error" class="jump-error" role="alert">{{ error }}</span>
    </form>
  </nav>
</template>
