<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRequest } from 'vue-hooks-plus'
import { submitFeedback } from '../lib/feedback'
import { CATEGORIES, MAX_CONTENT_LENGTH, type Category } from '../lib/constants'

const emit = defineEmits<{ submitted: [] }>()

const content = ref('')
const category = ref<Category>('Other')

const remaining = computed(() => MAX_CONTENT_LENGTH - content.value.length)

// The database constraint is on the TRIMMED length, and submitFeedback trims before
// inserting — so whitespace-only input would fail in Postgres rather than here.
// Checking trim() client-side keeps that error out of the UI entirely.
const canSubmit = computed(() => content.value.trim().length > 0)

const { loading, error, run } = useRequest(submitFeedback, {
  manual: true,
  onSuccess: () => {
    content.value = ''
    category.value = 'Other'
    emit('submitted')
  },
})

function onSubmit() {
  if (!canSubmit.value || loading.value) return
  run({ content: content.value, category: category.value })
}
</script>

<template>
  <form
    class="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    @submit.prevent="onSubmit"
  >
    <label for="content" class="block text-sm font-medium text-slate-700">
      Share anonymous feedback
    </label>

    <textarea
      id="content"
      v-model="content"
      :maxlength="MAX_CONTENT_LENGTH"
      rows="4"
      placeholder="What's working, what isn't?"
      class="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    />

    <!-- maxlength alone silently stops typing, which reads as broken when someone
         pastes a long paragraph. The counter makes the limit visible. -->
    <div class="mt-1 flex items-center justify-between text-xs">
      <span
        :class="remaining === 0 ? 'font-medium text-amber-600' : 'text-slate-400'"
        aria-live="polite"
      >
        {{ remaining }} characters left
      </span>
    </div>

    <div class="mt-3 flex items-center gap-3">
      <label for="submit-category" class="text-sm font-medium text-slate-700">
        Category
      </label>
      <select
        id="submit-category"
        v-model="category"
        class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>

      <button
        type="submit"
        class="ml-auto inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSubmit || loading"
      >
        <span
          v-if="loading"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
        {{ loading ? 'Sending…' : 'Submit' }}
      </button>
    </div>

    <p v-if="error" class="mt-3 text-sm text-red-700">
      Couldn't submit: {{ error.message }}
    </p>

    <p class="mt-3 text-xs text-slate-400">
      No name, email, or account is recorded with your feedback.
    </p>
  </form>
</template>
