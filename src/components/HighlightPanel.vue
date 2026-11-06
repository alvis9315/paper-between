<script setup lang="ts">
import { computed, ref } from "vue";
import type { Annotation, BookRecord } from "../core/model";
import { categories } from "../core/annotations";
const props = defineProps<{
  books: BookRecord[];
  activeId?: string;
  selected?: string;
}>();
const emit = defineEmits<{
  close: [];
  locate: [bookId: string, annotation: Annotation];
  update: [bookId: string, annotation: Annotation];
  remove: [bookId: string, id: string];
  undo: [];
}>();
const scope = ref("current"),
  category = ref(""),
  query = ref("");
const limit = ref(80);
const entries = computed(() =>
  props.books
    .filter(
      (b) =>
        !b.deletedAt &&
        (scope.value === "all" || b.document.id === props.activeId),
    )
    .flatMap((b) =>
      (b.document.annotations || []).map((a) => ({
        book: b.document,
        annotation: a,
      })),
    )
    .filter(
      ({ annotation: a }) =>
        (!category.value || a.category === category.value) &&
        (!query.value ||
          [...a.targets.map((t) => t.exact), a.comment, ...a.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.value.toLocaleLowerCase())),
    )
    .sort((a, b) => b.annotation.createdAt - a.annotation.createdAt),
);
function edit(bookId: string, a: Annotation, field: string, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit("update", bookId, {
    ...a,
    [field]:
      field === "tags"
        ? value
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12)
        : value,
    updatedAt: Date.now(),
  });
}
</script>
<template>
  <section class="highlight-panel" aria-label="重點筆記">
    <div class="highlight-heading">
      <div>
        <h2>收好的重點</h2>
        <p>選取紙頁上的文字，再選一種分類。</p>
      </div>
      <button class="icon-button" aria-label="關閉重點" @click="emit('close')">
        ×
      </button>
    </div>
    <div class="highlight-filters">
      <select v-model="scope" aria-label="重點範圍">
        <option value="current">這本筆記</option>
        <option value="all">全部筆記</option>
      </select>
      <select v-model="category" aria-label="重點分類">
        <option value="">全部分類</option>
        <option v-for="(label, key) in categories" :key="key" :value="key">
          {{ label }}
        </option>
      </select>
      <input
        v-model="query"
        aria-label="搜尋重點"
        placeholder="搜尋摘錄、標籤或心得"
      />
    </div>
    <p class="highlight-summary">
      {{ entries.length }} 筆重點
      <button @click="emit('undo')">復原上次刪除</button>
    </p>
    <p v-if="!entries.length" class="no-results">
      這裡還沒有符合的重點。試著在紙頁上選取一段文字。
    </p>
    <div class="highlight-cards">
      <article
        v-for="{ book, annotation: a } in entries.slice(0, limit)"
        :key="a.id"
        class="highlight-card"
        :class="{ selected: selected === a.id }"
      >
        <small
          >{{ book.title }} ·
          {{
            a.status === "linked" ? "已連結原文" : "原文已變動，請重新標記"
          }}</small
        >
        <blockquote :class="`quote-${a.category}`">
          {{ a.targets.map((t) => t.exact).join(" … ") }}
        </blockquote>
        <label
          >分類<select
            :value="a.category"
            @change="edit(book.id, a, 'category', $event)"
          >
            <option v-for="(label, key) in categories" :value="key" :key="key">
              {{ label }}
            </option>
          </select></label
        >
        <label
          >標籤<input
            :value="a.tags.join('，')"
            maxlength="480"
            placeholder="例如：考試、網路（以逗號分隔）"
            @change="edit(book.id, a, 'tags', $event)"
        /></label>
        <label
          >心得<textarea
            :value="a.comment"
            maxlength="4000"
            rows="2"
            placeholder="記下自己的理解…"
            @change="edit(book.id, a, 'comment', $event)"
          ></textarea>
        </label>
        <div class="highlight-card-actions">
          <button
            :disabled="a.status !== 'linked'"
            @click="emit('locate', book.id, a)"
          >
            回到原文</button
          ><button @click="emit('remove', book.id, a.id)">刪除重點</button>
        </div>
      </article>
    </div>
    <button
      v-if="entries.length > limit"
      class="more-results"
      @click="limit += 80"
    >
      顯示更多重點
    </button>
  </section>
</template>
