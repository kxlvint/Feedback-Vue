<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRequest } from 'vue-hooks-plus'
import { fetchFeedback } from '../../lib/feedback'
import { CATEGORIES, CATEGORY_STYLES, type Category } from '../../lib/constants'
import { formatExact, fromNow } from '../../lib/date'

const params = reactive({
  pageIndex: 1,
  pageSize: 10,
  category: null as Category | null,
})

const { data, loading, error, refresh } = useRequest(() => fetchFeedback(params), {
  refreshDeps: [params],
})

// `data` is undefined until the first response lands.
const feedback = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)

// Changing the filter invalidates the current page number, so reset it in the same
// tick as the filter change.
function setCategory(value: Category | null) {
  params.category = value
  params.pageIndex = 1
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-10">
    <header class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Team Feedback Loop
      </h1>
      <p class="mt-1 text-sm text-slate-500">
        Anonymous feedback from the team. No names are collected.
      </p>
    </header>

    <div class="mb-6 flex items-center gap-3">
      <label for="category" class="text-sm font-medium text-slate-700">Filter</label>
      <select
        id="category"
        :value="params.category"
        class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        @change="setCategory(($event.target as HTMLSelectElement).value as Category || null)"
      >
        <option value="">All categories</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>

      <span v-if="loading" class="text-sm text-slate-400">Loading…</span>
      <span v-else-if="total" class="ml-auto text-sm text-slate-400">
        {{ total }} total
      </span>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p class="font-medium">Couldn't load feedback.</p>
      <p class="mt-1 text-red-700">{{ error.message }}</p>
      <button
        type="button"
        class="mt-2 font-medium text-red-900 underline hover:no-underline"
        @click="refresh()"
      >
        Try again
      </button>
    </div>

    <!-- Only show the empty state once a request has completed, or it flashes on
         first paint. -->
    <p
      v-else-if="!loading && total === 0"
      class="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500"
    >
      No feedback yet{{ params.category ? ` in ${params.category}` : '' }}.
    </p>

    <!-- Plain list for now — this is what the virtual scroller replaces. -->
    <ul v-else class="space-y-3">
      <li
        v-for="item in feedback"
        :key="item.id"
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="CATEGORY_STYLES[item.category as Category]"
          >
            {{ item.category }}
          </span>
          <time
            :datetime="item.created_at"
            :title="formatExact(item.created_at)"
            class="shrink-0 text-xs text-slate-400"
          >
            {{ fromNow(item.created_at) }}
          </time>
        </div>

        <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {{ item.content }}
        </p>

        <!-- Upvote button goes here. See stores/votes.ts and upvoteFeedback(). -->
        <p class="mt-3 text-xs text-slate-500">{{ item.upvotes }} upvotes</p>
      </li>
    </ul>
  </main>
</template>
