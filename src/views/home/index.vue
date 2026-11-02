<script setup lang="ts">
import { nextTick, onUnmounted, reactive, ref } from 'vue';
import { useRequest } from 'vue-hooks-plus';
import { fetchFeedback, type Feedback } from '../../lib/feedback';
import { CATEGORIES, type Category, CATEGORY_STYLES } from '../../lib/constants';
import DScroller from '../../components/DScroller.vue';
import SubmitForm from '../../components/SubmitForm.vue';
import FeedbackCard from './components/FeedbackCard.vue';
import { supabase } from '../../lib/supabase';

const searchParams = reactive({
  pageIndex: 1,
  pageSize: 10,
  categories: [] as Category[],
});

const dataList = ref<Feedback[]>([]);
const pendingRows = ref<Feedback[]>([]);
const listRef = ref<HTMLElement | null>(null);
const total = ref(0);
const isEnd = ref(false);

const { loading: loading_fetchFeedback, error: error_fetchFeedback } = useRequest(
  () => fetchFeedback(searchParams),
  {
    refreshDeps: [searchParams],
    onSuccess: (data) => {
      const loaded = new Set(dataList.value.map((r) => r.id));
      const fresh = data.rows.filter((r) => !loaded.has(r.id));
      dataList.value = dataList.value.concat(fresh);
      fresh.forEach((r) => loaded.add(r.id));
      if (pendingRows.value.length) {
        pendingRows.value = pendingRows.value.filter((r) => !loaded.has(r.id));
      }
      isEnd.value =
        searchParams.pageIndex * searchParams.pageSize >= data.total ||
        data.rows.length < searchParams.pageSize;
      total.value = data.total;
    },
  },
);

function addNewRow(row: Feedback) {
  pendingRows.value = pendingRows.value.filter((r) => r.id !== row.id);
  if (dataList.value.some((r) => r.id === row.id)) return;
  dataList.value = [row, ...dataList.value];
  total.value += 1;
}

function loadMore() {
  if (!dataList.value.length) return;
  if (loading_fetchFeedback.value || isEnd.value) return;
  searchParams.pageIndex++;
}

function resetSearch() {
  dataList.value = [];
  total.value = 0;
  isEnd.value = false;
  pendingRows.value = [];
  searchParams.pageIndex = 1;
}

function toggleCategory(value: Category) {
  const i = searchParams.categories.indexOf(value);
  if (i === -1) {
    searchParams.categories.push(value);
  } else {
    searchParams.categories.splice(i, 1);
  }
  resetSearch();
}

function clearCategories() {
  searchParams.categories = [];
  resetSearch();
}

function onInsert(row: Feedback) {
  if (searchParams.categories.length && !searchParams.categories.includes(row.category as Category))
    return;
  if (dataList.value.some((r) => r.id === row.id)) return;
  if (pendingRows.value.some((r) => r.id === row.id)) return;
  pendingRows.value.push(row);
}
const channel = supabase
  .channel('feedback-wall')
  .on<Feedback>(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'feedback' },
    (payload) => onInsert(payload.new),
  )
  .subscribe();

onUnmounted(() => supabase.removeChannel(channel));

async function showPending() {
  dataList.value = [...pendingRows.value, ...dataList.value];
  total.value += pendingRows.value.length;
  pendingRows.value = [];

  await nextTick();
  listRef.value?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
</script>
<template>
  <main class="mx-auto max-w-2xl px-4 py-10">
    <header class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Team Feedback Loop</h1>
      <p class="mt-1 text-sm text-slate-500">
        Anonymous feedback from the team. No names are collected.
      </p>
    </header>

    <!-- A new row goes to the top of the wall, so refetch rather than splicing it
         into the local list: the server ordering stays the single source of truth. -->
    <SubmitForm @submitted="addNewRow" />

    <div class="mb-6 flex items-center gap-3">
      <span class="text-sm font-medium text-slate-700">Filter</span>
      <div role="group" aria-label="Filter by category" class="flex flex-wrap gap-2">
        <!-- "All" is a reset, not a fifth category: picking all four by hand returns
             the same rows from a different state, so it clears instead. -->
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          :class="
            searchParams.categories.length === 0
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          "
          :aria-pressed="searchParams.categories.length === 0"
          @click="clearCategories()"
        >
          All
        </button>
        <!-- aria-pressed carries the selected state: these are toggles, and the
             colour alone says nothing to a screen reader. Selected pills reuse the
             same tints FeedbackCard puts on its badge. -->
        <button
          v-for="c in CATEGORIES"
          :key="c"
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          :class="
            searchParams.categories.includes(c)
              ? ['border-transparent', CATEGORY_STYLES[c]]
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          "
          :aria-pressed="searchParams.categories.includes(c)"
          @click="toggleCategory(c)"
        >
          {{ c }}
        </button>
      </div>
      <span
        v-if="loading_fetchFeedback"
        class="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500"
        aria-label="Loading feedback"
      />
      <!-- "x of N" rather than a bare total: the list grows as you scroll, so the
           total alone would not say how much is on screen. -->
      <span v-else-if="total" class="ml-auto text-sm text-slate-400">
        {{ dataList.length }} of {{ total }}
      </span>
    </div>

    <div
      v-if="error_fetchFeedback"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p class="font-medium">Oops.. Something went wrong.</p>
      <p class="mt-1 text-red-700">{{ error_fetchFeedback.message }}</p>
      <button
        type="button"
        class="mt-2 font-medium text-red-900 underline hover:no-underline"
        @click="resetSearch()"
      >
        Try again
      </button>
    </div>
    <div class="sticky top-4 z-20 flex h-0 items-start justify-center" aria-live="polite">
      <button
        v-if="pendingRows.length"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white shadow-lg ring-1 ring-slate-900/5 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        @click="showPending()"
      >
        <svg class="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M10 17a.75.75 0 0 1-.75-.75V5.61L5.3 9.7a.75.75 0 0 1-1.1-1.02l5.25-5.5a.75.75 0 0 1 1.1 0l5.25 5.5a.75.75 0 1 1-1.1 1.02L10.75 5.61V16.25A.75.75 0 0 1 10 17Z"
            clip-rule="evenodd"
          />
        </svg>
        Show {{ pendingRows.length }} new
      </button>
    </div>
    <div v-show="dataList.length > 0" ref="listRef" class="scroll-mt-4">
      <DScroller
        :items="dataList"
        :loading="loading_fetchFeedback"
        :is-end="isEnd"
        end-text="That's everything."
        @load-more="loadMore"
      >
        <template #default="{ item }">
          <div class="pb-3">
            <FeedbackCard :item="item" />
          </div>
        </template>
      </DScroller>
    </div>

    <p
      v-if="!loading_fetchFeedback && !dataList.length && !error_fetchFeedback"
      class="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500"
    >
      No feedback yet{{
        searchParams.categories.length ? ` in ${searchParams.categories.join(', ')}` : ''
      }}.
    </p>
  </main>
</template>
