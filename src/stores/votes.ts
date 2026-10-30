import { defineStore } from 'pinia'
import { ref } from 'vue'

// Remembers which feedback this visitor has upvoted — and nothing else.
//
// Request state (loading / error / data) deliberately does NOT live here: that is
// per-call, per-component lifecycle state, and useRequest already models it. The
// store holds only what has to be shared between components and outlive a single
// request.
//
// There is no login, so "1 vote per user" can only mean "1 vote per visitor". This
// is in memory, so it is scoped to the page session and a reload clears it.
export const useVotesStore = defineStore('votes', () => {
  const votedIds = ref(new Set<string>())

  function hasVoted(id: string): boolean {
    return votedIds.value.has(id)
  }

  function markVoted(id: string): void {
    votedIds.value = new Set(votedIds.value).add(id)
  }

  return { votedIds, hasVoted, markVoted }
})
