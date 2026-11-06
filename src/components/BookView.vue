<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import PageLeaf from "./PageLeaf.vue";
import AppIcon from "./AppIcon.vue";
import type { PaperPage, SearchHit, Annotation } from "../core/model";
const props = defineProps<{
  pages: PaperPage[];
  index: number;
  single: boolean;
  title: string;
  hits: SearchHit[];
  activeHit?: SearchHit;
  located?: number;
  disabled?: boolean;
  annotations?: Annotation[];
}>();
const emit = defineEmits<{
  change: [index: number];
  turning: [value: boolean];
  jump: [page: number];
  enlarge: [page: number];
}>();
const turn = ref<{
  from: number;
  to: number;
  direction: "next" | "previous";
  short: boolean;
}>();
let timer: ReturnType<typeof setTimeout> | undefined;
const left = computed(() =>
  turn.value
    ? turn.value.short || turn.value.direction === "previous" || props.single
      ? turn.value.to
      : turn.value.from
    : props.index,
);
const right = computed(() =>
  turn.value
    ? turn.value.short || turn.value.direction === "next"
      ? turn.value.to + 1
      : turn.value.from + 1
    : props.index + 1,
);
const front = computed(() =>
  !turn.value
    ? undefined
    : props.pages[
        turn.value.from +
          (turn.value.direction === "next" && !props.single ? 1 : 0)
      ],
);
const back = computed(() =>
  !turn.value
    ? undefined
    : props.pages[
        turn.value.to +
          (turn.value.direction === "previous" && !props.single ? 1 : 0)
      ],
);
function go(target: number, short = false) {
  if (
    turn.value ||
    props.disabled ||
    target === props.index ||
    target < 0 ||
    target >= props.pages.length
  )
    return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    emit("change", target);
    return;
  }
  turn.value = {
    from: props.index,
    to: target,
    direction: target > props.index ? "next" : "previous",
    short: short || Math.abs(target - props.index) > (props.single ? 1 : 2),
  };
  emit("turning", true);
  timer = setTimeout(
    () => {
      emit("change", target);
      turn.value = undefined;
      emit("turning", false);
    },
    turn.value.short ? 180 : 560,
  );
}
function move(direction: number) {
  go(props.index + direction * (props.single ? 1 : 2));
}
defineExpose({ go, move });
let touch:
  | { x: number; y: number; time: number; target: EventTarget | null }
  | undefined;
function touchStart(e: TouchEvent) {
  const target = e.target as HTMLElement;
  if (
    target.closest("a,button,input,mark") ||
    e.touches.length !== 1 ||
    window.getSelection()?.toString()
  )
    return;
  const p = e.touches[0]!;
  touch = { x: p.clientX, y: p.clientY, time: Date.now(), target: e.target };
}
function touchEnd(e: TouchEvent) {
  if (!touch) return;
  const p = e.changedTouches[0]!;
  const dx = p.clientX - touch.x;
  const dy = p.clientY - touch.y;
  if (
    props.single &&
    Math.abs(dx) > 65 &&
    Math.abs(dx) > Math.abs(dy) * 1.8 &&
    Date.now() - touch.time < 650 &&
    !window.getSelection()?.toString()
  )
    move(dx < 0 ? 1 : -1);
  touch = undefined;
}
let wheelTimer: ReturnType<typeof setTimeout> | undefined;
let wheelDistance = 0;
let wheelLocked = false;
let lastWheelTurn = -Infinity;
function wheel(e: WheelEvent) {
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    window.getSelection()?.toString() ||
    (e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')
  )
    return;
  const scale =
    e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
  const dx = e.deltaX * scale,
    dy = e.deltaY * scale;
  if (Math.abs(dx) < 0.5 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  // Consume horizontal history navigation, including at the first/last spread.
  e.preventDefault();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    wheelDistance = 0;
    wheelLocked = false;
  }, 240);
  if (
    wheelLocked ||
    props.disabled ||
    turn.value ||
    performance.now() - lastWheelTurn < 700
  )
    return;
  wheelDistance =
    Math.sign(wheelDistance) !== Math.sign(dx) ? dx : wheelDistance + dx;
  if (Math.abs(wheelDistance) < 80) return;
  wheelLocked = true;
  lastWheelTurn = performance.now();
  move(wheelDistance > 0 ? 1 : -1);
}
onBeforeUnmount(() => {
  clearTimeout(timer);
  clearTimeout(wheelTimer);
});
</script>
<template>
  <div
    class="book-shell"
    :class="{ single, turning: !!turn, 'short-turn': turn?.short }"
    @touchstart.passive="touchStart"
    @touchend.passive="touchEnd"
    @touchcancel="touch = undefined"
    @wheel="wheel"
  >
    <div class="book-cover"></div>
    <div class="book-pages">
      <PageLeaf
        @jump="emit('jump', $event)"
        @enlarge="emit('enlarge', $event)"
        :page="pages[left]"
        :annotations="annotations"
        :title="title"
        :hits="hits"
        :active-hit="activeHit"
        :highlight="located === left"
        side="left-paper"
      />
      <PageLeaf
        v-if="!single"
        @jump="emit('jump', $event)"
        @enlarge="emit('enlarge', $event)"
        :page="pages[right]"
        :annotations="annotations"
        :title="title"
        :hits="hits"
        :active-hit="activeHit"
        :highlight="located === right"
        side="right-paper"
      />
      <div v-if="!single" class="book-gutter" aria-hidden="true"></div>
      <div
        v-if="turn && !turn.short"
        class="turn-sheet"
        :class="turn.direction"
        aria-hidden="true"
      >
        <div class="sheet-face sheet-front">
          <PageLeaf
            :page="front"
            :annotations="annotations"
            :title="title"
            :hits="hits"
            :active-hit="activeHit"
          />
        </div>
        <div class="sheet-face sheet-back">
          <PageLeaf
            :page="back"
            :annotations="annotations"
            :title="title"
            :hits="hits"
            :active-hit="activeHit"
          />
        </div>
      </div>
      <button
        class="page-edge edge-left"
        aria-label="上一頁"
        :disabled="index === 0 || !!turn || disabled"
        @click="move(-1)"
      >
        <AppIcon name="left" :size="18" />
      </button>
      <button
        class="page-edge edge-right"
        aria-label="下一頁"
        :disabled="
          index + (single ? 1 : 2) >= pages.length || !!turn || disabled
        "
        @click="move(1)"
      >
        <AppIcon name="right" :size="18" />
      </button>
    </div>
  </div>
</template>
