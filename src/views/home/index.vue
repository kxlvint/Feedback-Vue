<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRequest } from 'vue-hooks-plus'
import { fetchFeedback } from '../../lib/feedback'
import { CATEGORIES, type Category } from '../../lib/constants'
import FeedbackCard from '../../components/FeedbackCard.vue'
import SubmitForm from '../../components/SubmitForm.vue'

// Every request parameter in one reactive object. Passing it as a single refreshDeps
// source means watch() tracks it deeply, so mutating any field re-runs the request —
// and adding a new parameter later needs no change to refreshDeps.
//
// Mutating several fields in the same tick batches into one trigger, so there is no
// double-fetch when a filter change also resets the page.
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

    <!-- A new row goes to the top of the wall, so refetch rather than splicing it
         into the local list: the server ordering stays the single source of truth. -->
    <SubmitForm @submitted="refresh()" />

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

      <span
        v-if="loading"
        class="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500"
        aria-label="Loading feedback"
      />
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

    <ul v-else class="space-y-3">
      <FeedbackCard v-for="item in feedback" :key="item.id" :item="item" />
    </ul>
  </main>
</template>
