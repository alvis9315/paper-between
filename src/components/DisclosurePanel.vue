<script setup lang="ts">
import { ref, useId } from "vue";
import { ChevronDown } from "@lucide/vue";
const props = withDefaults(
  defineProps<{ label: string; defaultOpen?: boolean }>(),
  { defaultOpen: true },
);
const open = ref(props.defaultOpen);
const id = `disclosure-${useId()}`;
</script>
<template>
  <section class="disclosure-panel">
    <button
      type="button"
      class="disclosure-trigger"
      :aria-expanded="open"
      :aria-controls="id"
      @click="open = !open"
    >
      <span>{{ label }}</span
      ><ChevronDown :size="15" :class="{ expanded: open }" aria-hidden="true" />
    </button>
    <div v-show="open" :id="id" class="disclosure-content"><slot /></div>
  </section>
</template>
<style scoped>
.disclosure-panel {
  border-top: 1px solid var(--border);
  margin-top: 12px;
  padding-top: 8px;
}
.disclosure-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.disclosure-trigger svg {
  transform: rotate(-90deg);
  transition: transform 150ms;
}
.disclosure-trigger svg.expanded {
  transform: rotate(0);
}
.disclosure-content {
  overflow-wrap: anywhere;
}
@media (prefers-reduced-motion: reduce) {
  .disclosure-trigger svg {
    transition: none;
  }
}
</style>
