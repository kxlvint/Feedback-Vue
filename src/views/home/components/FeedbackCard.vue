<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRequest } from 'vue-hooks-plus';
import { setUpvote, type Feedback } from '../../../lib/feedback';
import { CATEGORY_STYLES, type Category } from '../../../lib/constants';
import { formatExact, fromNow } from '../../../lib/date';
import { avatarFor } from '../../../lib/identity';
import IconArrowUp from '~icons/heroicons/arrow-up-16-solid';
import { useVotesStore } from '../../../stores/votes';

const props = defineProps<{ item: Feedback }>();

const votes = useVotesStore();

// Local copy of the count so this card can move it optimistically. `data` from the
// wall's useRequest is Readonly, so the list cannot be written into in place.
const upvotes = ref(props.item.upvotes);

// Resync when the wall refetches (after a submit, or a filter change reusing this
// component instance), otherwise the local copy would shadow fresher server data.
watch(
  () => props.item.upvotes,
  (value) => {
    upvotes.value = value;
  },
);

const voted = computed(() => votes.hasVoted(props.item.id));

// Rows predating the display_name column have none, so fall back rather than
// inventing a name for them.
const authorName = computed(() => props.item.display_name);

// Keyed on the name, so the same author renders the same character every time.
const avatar = computed(() => avatarFor(props.item.display_name));

const { loading: loading_setUpvote, run: run_setUpvote } = useRequest(setUpvote, {
  manual: true,

  // The server count is authoritative and may differ from our guess if someone
  // else voted in the meantime, so reconcile rather than trusting the optimism.
  onSuccess: (serverCount) => {
    upvotes.value = serverCount;
  },

  // Revert. The params tuple tells us which direction was attempted, so the undo
  // is just the inverse delta — no need to stash the previous values in a closure.
  onError: (_error, [id, attempted]) => {
    votes.setVoted(id, !attempted);
    upvotes.value = attempted ? Math.max(upvotes.value - 1, 0) : upvotes.value + 1;
  },
});

function toggleVote() {
  const next = !voted.value;

  // Apply immediately, then fire the request. onError puts it back.
  votes.setVoted(props.item.id, next);
  upvotes.value = next ? upvotes.value + 1 : Math.max(upvotes.value - 1, 0);

  run_setUpvote(props.item.id, next);
}
</script>

<template>
  <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-2">
        <img
          :src="avatar"
          :alt="`Avatar for ${authorName}`"
          class="size-7 shrink-0 rounded-full bg-slate-100"
          width="28"
          height="28"
        />
        <span class="truncate text-sm font-medium text-slate-700">
          {{ authorName }}
        </span>
        <span
          class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          :class="CATEGORY_STYLES[item.category as Category]"
        >
          {{ item.category }}
        </span>
      </div>
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

    <div class="mt-4">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        :class="
          voted
            ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        "
        :disabled="loading_setUpvote"
        :aria-pressed="voted"
        :aria-label="voted ? 'Remove your upvote' : 'Upvote this feedback'"
        @click="toggleVote"
      >
        <IconArrowUp class="size-3.5" aria-hidden="true" />
        <span class="tabular-nums">{{ upvotes }}</span>
      </button>
    </div>
  </article>
</template>
