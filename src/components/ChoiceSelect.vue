<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from "@floating-ui/dom";
import { Check, ChevronDown } from "@lucide/vue";
const props = defineProps<{
  options: readonly { value: T; label: string; disabled?: boolean }[];
  label: string;
  disabled?: boolean;
}>();
const model = defineModel<T>({ required: true });
const id = `choice-${useId()}`;
const host = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const open = ref(false);
const active = ref(0);
const selected = computed(() =>
  props.options.find((option) => option.value === model.value),
);
let cleanup: (() => void) | undefined;
let typed = "";
let typingTimer: ReturnType<typeof setTimeout> | undefined;
function close() {
  open.value = false;
  cleanup?.();
  cleanup = undefined;
  menu.value?.hidePopover();
  document.removeEventListener("pointerdown", outside, true);
}
function outside(event: PointerEvent) {
  if (!host.value?.contains(event.target as Node)) close();
}
async function position() {
  if (!trigger.value || !menu.value) return;
  const popup = menu.value;
  const result = await computePosition(trigger.value, popup, {
    strategy: "fixed",
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip({ padding: 10 }),
      shift({ padding: 10 }),
      size({
        padding: 10,
        apply({ availableHeight, rects, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
            maxHeight: `${Math.min(280, Math.max(80, availableHeight))}px`,
          });
        },
      }),
    ],
  });
  if (!open.value) return;
  Object.assign(popup.style, {
    left: `${result.x}px`,
    top: `${result.y}px`,
    visibility: "visible",
  });
}
async function show() {
  if (props.disabled || open.value) return;
  open.value = true;
  active.value = Math.max(
    0,
    props.options.findIndex((option) => option.value === model.value),
  );
  await nextTick();
  if (!open.value || !menu.value || !trigger.value) return;
  menu.value.style.visibility = "hidden";
  menu.value.showPopover();
  document.addEventListener("pointerdown", outside, true);
  cleanup = autoUpdate(trigger.value, menu.value, () => void position());
}
function pick(index: number) {
  const option = props.options[index];
  if (!option || option.disabled) return;
  model.value = option.value;
  close();
}
function move(direction: number) {
  for (let count = 1; count <= props.options.length; count++) {
    const index =
      (active.value + direction * count + props.options.length) %
      props.options.length;
    if (!props.options[index]?.disabled) {
      active.value = index;
      return;
    }
  }
}
function keydown(event: KeyboardEvent) {
  if (event.key === "Tab") {
    close();
    return;
  }
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    event.stopPropagation();
    close();
    return;
  }
  if (
    ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!open.value) {
      void show();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp")
      move(event.key === "ArrowDown" ? 1 : -1);
    else if (event.key === "Home") {
      active.value = props.options.length - 1;
      move(1);
    } else if (event.key === "End") {
      active.value = 0;
      move(-1);
    } else pick(active.value);
  } else if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.preventDefault();
    clearTimeout(typingTimer);
    typed += event.key.toLocaleLowerCase();
    const index = props.options.findIndex(
      (option) =>
        !option.disabled && option.label.toLocaleLowerCase().startsWith(typed),
    );
    if (index >= 0) {
      void show();
      active.value = index;
    }
    typingTimer = setTimeout(() => {
      typed = "";
    }, 700);
  }
}
watch(active, async () => {
  await nextTick();
  if (open.value)
    menu.value
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
});
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close();
  },
);
onBeforeUnmount(() => {
  close();
  clearTimeout(typingTimer);
});
</script>
<template>
  <span ref="host" class="choice-select" @keydown="keydown">
    <button
      ref="trigger"
      class="choice-trigger"
      type="button"
      role="combobox"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="id"
      :aria-activedescendant="open ? `${id}-${active}` : undefined"
      :disabled="disabled"
      @click="open ? close() : show()"
      @blur="close"
    >
      <span>{{ selected?.label || "請選擇" }}</span
      ><ChevronDown
        :size="15"
        aria-hidden="true"
        :class="{ 'choice-open': open }"
      />
    </button>
    <div
      :id="id"
      ref="menu"
      class="choice-menu"
      popover="manual"
      role="listbox"
      :aria-label="`${label}選項`"
    >
      <button
        v-for="(option, index) in options"
        :id="`${id}-${index}`"
        :key="option.value"
        class="choice-option"
        role="option"
        type="button"
        tabindex="-1"
        :aria-selected="option.value === model"
        :aria-disabled="option.disabled || undefined"
        :data-active="active === index"
        :disabled="option.disabled"
        @pointerdown.prevent
        @pointermove="!option.disabled && (active = index)"
        @click="pick(index)"
      >
        <span>{{ option.label }}</span
        ><Check v-if="option.value === model" :size="15" aria-hidden="true" />
      </button>
    </div>
  </span>
</template>
<style scoped>
.choice-select {
  display: inline-flex;
  min-width: 0;
  vertical-align: middle;
}
.choice-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--field);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.choice-trigger > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.choice-trigger svg {
  flex-shrink: 0;
  transition: transform 150ms;
}
.choice-trigger:hover,
.choice-trigger[aria-expanded="true"] {
  border-color: var(--accent-ink, var(--accent));
  background: color-mix(in srgb, var(--accent) 7%, var(--field));
}
.choice-trigger .choice-open {
  transform: rotate(180deg);
}
.choice-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 5px;
  width: max-content;
  max-width: calc(100vw - 20px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field);
  color: var(--ink);
  box-shadow: 0 8px 30px var(--shadow-deep, #30271e30);
  font:
    12px/1.5 "Segoe UI",
    "Microsoft JhengHei",
    "PingFang TC",
    sans-serif;
}
.choice-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 6px;
  padding: 8px 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.choice-option[aria-selected="true"] {
  color: var(--accent-ink, var(--accent));
  font-weight: 600;
}
.choice-option[data-active="true"] {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .choice-trigger svg {
    transition: none;
  }
}
</style>
