<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{
  open: boolean;
  index: number;
  total: number;
  single: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ jump: [page: number]; close: [] }>();
const dialog = ref<HTMLDialogElement>();
const field = ref<HTMLInputElement>();
const input = ref("");
const error = ref("");
const end = computed(() =>
  Math.min(props.total, props.index + (props.single ? 1 : 2)),
);
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      input.value = String(props.index + 1);
      error.value = "";
      dialog.value?.showModal();
      field.value?.focus();
      field.value?.select();
    } else dialog.value?.close();
  },
);
function navigate(page: number) {
  emit("jump", page);
  emit("close");
}
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
  navigate(value);
}
</script>
<template>
  <dialog
    ref="dialog"
    class="page-jump-dialog"
    aria-labelledby="jump-title"
    @cancel="emit('close')"
    @close="emit('close')"
    @click="$event.target === dialog && emit('close')"
  >
    <div class="jump-heading">
      <h2 id="jump-title">跳至頁碼</h2>
      <button class="icon-button" aria-label="關閉跳頁" @click="emit('close')">
        <AppIcon name="close" />
      </button>
    </div>
    <p class="jump-range">
      第 {{ index + 1 }}{{ end > index + 1 ? `–${end}` : "" }} 頁／共
      {{ total }} 頁
    </p>
    <form class="reader-jump-form" @submit.prevent="jump">
      <label for="jump-page">頁碼</label>
      <input
        id="jump-page"
        ref="field"
        v-model="input"
        inputmode="numeric"
        autocomplete="off"
        aria-label="輸入頁碼"
        :aria-invalid="!!error"
        :aria-describedby="error ? 'jump-error' : undefined"
        :disabled="disabled"
        @input="error = ''"
      />
      <button type="submit" :disabled="disabled">前往</button>
    </form>
    <p v-if="error" id="jump-error" class="reader-jump-error" role="alert">
      {{ error }}
    </p>
    <div class="jump-endpoints">
      <button :disabled="disabled || index === 0" @click="navigate(1)">
        <AppIcon name="first" :size="16" />第一頁
      </button>
      <button :disabled="disabled || end >= total" @click="navigate(total)">
        最後一頁<AppIcon name="last" :size="16" />
      </button>
    </div>
  </dialog>
</template>
