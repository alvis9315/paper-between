<script lang="ts">
let dismissActiveHint: (() => void) | undefined;
</script>
<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
  type Component,
} from "vue";
import {
  autoUpdate,
  computePosition,
  flip,
  hide as hideReference,
  offset,
  shift,
} from "@floating-ui/dom";
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  compact?: boolean;
  small?: boolean;
  label: string;
  icon: Component;
  disabled?: boolean;
  danger?: boolean;
}>();
const emit = defineEmits<{ click: [event: MouseEvent] }>();
const id = `action-hint-${useId()}`;
const button = ref<HTMLButtonElement>(),
  hint = ref<HTMLElement>();
const visible = ref(false),
  positioned = ref(false);
const coordinates = ref({ left: "0px", top: "0px" });
let openTimer: ReturnType<typeof setTimeout> | undefined,
  closeTimer: ReturnType<typeof setTimeout> | undefined;
let cleanup: (() => void) | undefined;
function hide() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  visible.value = false;
  positioned.value = false;
  cleanup?.();
  cleanup = undefined;
  if (dismissActiveHint === hide) dismissActiveHint = undefined;
  document.removeEventListener("keydown", escape, true);
}
function show() {
  if (props.disabled) return;
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  if (visible.value) return;
  dismissActiveHint?.();
  dismissActiveHint = hide;
  visible.value = true;
  document.addEventListener("keydown", escape, true);
}
function escape(event: KeyboardEvent) {
  if (event.key === "Escape" && visible.value) {
    event.stopPropagation();
    hide();
  }
}
function enter(event: PointerEvent) {
  if (event.pointerType !== "mouse" || props.disabled) return;
  clearTimeout(closeTimer);
  clearTimeout(openTimer);
  openTimer = setTimeout(show, 240);
}
function leave() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  if (button.value?.matches(":focus-visible")) return;
  closeTimer = setTimeout(hide, 100);
}
function keep() {
  clearTimeout(closeTimer);
}
function focus() {
  if (button.value?.matches(":focus-visible")) show();
}
function click(event: MouseEvent) {
  hide();
  if (!props.disabled) emit("click", event);
}
async function update() {
  const anchor = button.value,
    popup = hint.value;
  if (!anchor || !popup) return;
  const { x, y, middlewareData } = await computePosition(anchor, popup, {
    placement: "top",
    strategy: "fixed",
    middleware: [
      offset(9),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      hideReference(),
    ],
  });
  if (!visible.value || hint.value !== popup || !anchor.isConnected) return;
  if (middlewareData.hide?.referenceHidden) {
    hide();
    return;
  }
  coordinates.value = { left: `${x}px`, top: `${y}px` };
  positioned.value = true;
}
watch(visible, async (open) => {
  cleanup?.();
  cleanup = undefined;
  if (!open) return;
  await nextTick();
  if (!visible.value || !button.value || !hint.value) return;
  cleanup = autoUpdate(button.value, hint.value, () => void update());
});
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) hide();
  },
);
onBeforeUnmount(hide);
</script>
<template>
  <span class="icon-action">
    <button
      ref="button"
      v-bind="$attrs"
      class="icon-action-button"
      :class="{ 'danger-action': danger, compact, small }"
      type="button"
      :disabled="disabled"
      :aria-label="label"
      :aria-describedby="visible ? id : undefined"
      @pointerenter="enter"
      @pointerleave="leave"
      @focus="focus"
      @blur="hide"
      @click="click"
    >
      <component
        :is="icon"
        :size="19"
        :stroke-width="1.7"
        aria-hidden="true"
        focusable="false"
      />
      <span class="touch-action-label" aria-hidden="true">{{ label }}</span>
    </button>
    <Teleport to="body">
      <Transition
        name="action-hint"
        @before-leave="(el) => el.setAttribute('aria-hidden', 'true')"
      >
        <span
          v-if="visible"
          :id="id"
          ref="hint"
          class="action-hint"
          :class="{ 'danger-hint': danger, 'is-positioned': positioned }"
          :style="coordinates"
          role="tooltip"
          :aria-hidden="!positioned"
          @pointerenter="keep"
          @pointerleave="leave"
          >{{ label }}</span
        >
      </Transition>
    </Teleport>
  </span>
</template>
<style scoped>
.icon-action {
  display: inline-flex;
  flex-shrink: 0;
}
.icon-action-button {
  width: 42px;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 9px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: var(--text-secondary, #8d7765);
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}
.icon-action-button:not(:disabled):is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  color: var(--accent-ink, var(--accent));
  border-color: color-mix(in srgb, var(--accent) 18%, transparent);
}
.icon-action-button.danger-action:not(:disabled):is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
}
.icon-action-button:focus-visible {
  outline: 2px solid var(--accent-ink, var(--accent));
  outline-offset: 3px;
}
.touch-action-label {
  display: none;
}
.action-hint {
  position: fixed;
  z-index: 220;
  width: max-content;
  max-width: calc(100vw - 16px);
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--field) 94%, transparent);
  color: var(--ink);
  box-shadow:
    0 8px 24px var(--shadow-soft, #3927151c),
    0 2px 5px var(--shadow-soft, #3927150a);
  backdrop-filter: blur(12px);
  font:
    500 12px/1.5 "Segoe UI",
    "Microsoft JhengHei",
    "PingFang TC",
    sans-serif;
  letter-spacing: 0.04em;
  white-space: nowrap;
  opacity: 0;
}
.action-hint.is-positioned {
  opacity: 1;
}
.danger-hint {
  color: var(--danger);
}
.action-hint-enter-active,
.action-hint-leave-active {
  transition:
    opacity 0.12s,
    transform 0.12s;
}
.action-hint-enter-from,
.action-hint-leave-to {
  opacity: 0 !important;
  transform: translateY(3px);
}
@media (hover: none), (pointer: coarse) {
  .icon-action-button {
    width: 60px;
    min-height: 52px;
    flex-direction: column;
    padding: 6px 3px;
    border-radius: 9px;
  }
  .touch-action-label {
    display: block;
    font-size: 10px;
    line-height: 1.4;
    white-space: nowrap;
  }
}
.icon-action-button.compact {
  width: 40px;
  min-height: 40px;
  flex-direction: row;
  padding: 8px;
}
.compact .touch-action-label {
  display: none;
}
@media (max-width: 480px) {
  .icon-action-button.compact {
    width: 42px;
    min-height: 36px;
    padding: 6px;
  }
}
.icon-action-button.small {
  width: 30px;
  min-height: 28px;
  padding: 4px;
  border-radius: 6px;
}
@media (prefers-reduced-motion: reduce) {
  .action-hint-enter-active,
  .action-hint-leave-active,
  .icon-action-button {
    transition: none;
  }
  .action-hint-enter-from,
  .action-hint-leave-to {
    transform: none;
  }
}
</style>
