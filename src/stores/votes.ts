import { defineStore } from 'pinia'

// Remembers which feedback this visitor has upvoted — and nothing else.
//
// Request state (loading / error / data) deliberately does NOT live here: that is
// per-call lifecycle state, and useRequest already models it. Double-clicks are
// prevented by disabling the button while that request is loading, not by guarding
// in the store.
//
// There is no login, so "1 vote per user" can only mean "1 vote per visitor".
// Persisting to localStorage is the honest version of that: it survives a reload,
// which is what makes the one-vote limit hold up in practice. A visitor who clears
// site data can vote again — unavoidable without identity, and worth stating rather
// than pretending otherwise.
//
// votedIds is a plain string[] specifically so this works: a Set serialises to {}
// under JSON.stringify and the persisted state would silently come back empty.
export const useVotesStore = defineStore('votes', {
  state: () => ({
    votedIds: [] as string[],
  }),

  getters: {
    // A getter that takes an argument has to return a function: getters are cached
    // computeds keyed on nothing, so they cannot depend on a parameter themselves.
    hasVoted: (state) => {
      return (id: string): boolean => state.votedIds.includes(id)
    },
  },

  // `true` uses the defaults: localStorage, keyed by the store id ('votes'), whole
  // state serialised with JSON. The plugin rehydrates on store creation, so the
  // first read of hasVoted() already reflects what was stored.
  persist: {
    storage: localStorage,
  },

  actions: {
    /**
     * Records the visitor's vote state for one item. Call this after the request
     * succeeds, so a failed vote does not leave the UI claiming otherwise.
     */
    setVoted(id: string, voted: boolean) {
      const index = this.votedIds.indexOf(id)

      if (voted && index === -1) {
        this.votedIds.push(id)
      } else if (!voted && index !== -1) {
        this.votedIds.splice(index, 1)
      }
    },
  },
})
