<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
const paths: Record<string, string[]> = {
  image: ["M3 3h18v18H3z", "m3 16 5-5 4 4 3-3 6 6", "M15 7h.01"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 17v4h16v-4"],
  restore: ["M3 11a9 9 0 1 1 3 8", "M3 4v7h7", "M12 7v5l3 2"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"],
  book: [
    "M12 7v15",
    "M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v17h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z",
  ],
  search: ["m21 21-5-5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  upload: [
    "M12 16V3",
    "m7 8 5-5 5 5",
    "M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  ],
  left: ["m14 6-6 6 6 6"],
  right: ["m10 6 6 6-6 6"],
  first: ["M5 5v14", "m17 1-6 6 6 6"],
  last: ["M19 5v14", "m7 1 6 6-6 6"],
  close: ["m6 6 12 12", "M6 18 18 6"],
  check: ["m5 12 4 4L19 6"],
  shield: ["M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z", "m8 12 3 3 5-6"],
  file: ["M14 2H5v20h14V7z", "M14 2v6h5", "M8 12h8", "M8 16h6"],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  help: [
    "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3",
    "M12 17h.01",
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  ],
};
</script>
<template>
  <svg
    :width="size || 18"
    :height="size || 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[name] || paths.book" :key="i" :d="d" />
  </svg>
</template>
