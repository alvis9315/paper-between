<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
function close() {
  if (!props.busy) emit("close");
}
onMounted(() => dialog.value?.showModal());
</script>
<template>
  <dialog
    ref="dialog"
    class="bounded-modal"
    :aria-label="title"
    @cancel.prevent="close"
    @click="$event.target === dialog && close()"
  >
    <header class="bounded-modal-heading">
      <h2>{{ title }}</h2>
      <button
        class="icon-button"
        :aria-label="`關閉${title}`"
        :disabled="busy"
        autofocus
        @click="close"
      >
        <AppIcon name="close" />
      </button>
    </header>
    <div class="bounded-modal-body"><slot /></div>
  </dialog>
</template>
<style scoped>
.bounded-modal {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(580px, calc(100vw - 32px));
  max-width: none;
  max-height: calc(100dvh - 40px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--field);
  color: var(--ink);
  overflow: hidden;
  box-shadow: 0 18px 70px #17120e40;
}
.bounded-modal[open] {
  display: flex;
  flex-direction: column;
}
.bounded-modal::backdrop {
  background: #211a1555;
  backdrop-filter: blur(5px);
}
.bounded-modal-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
h2 {
  font-size: 21px;
  color: var(--heading);
}
.bounded-modal-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  font-size: 14px;
  line-height: 1.9;
}
.bounded-modal-body :deep(h3) {
  font-size: 15px;
  color: var(--heading);
  margin: 14px 0 4px;
}
.bounded-modal-body :deep(ul) {
  padding-left: 21px;
}
.bounded-modal-body :deep(li) {
  margin: 7px 0;
}
.bounded-modal-body :deep(p) {
  margin: 0 0 12px;
}
@media (max-width: 540px) {
  .bounded-modal-heading {
    padding: 16px;
  }
  .bounded-modal-body {
    padding: 16px;
  }
}
</style>
