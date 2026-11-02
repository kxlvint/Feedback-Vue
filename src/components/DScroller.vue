<template>
  <!-- DynamicScroller measures each row rather than assuming a fixed height, so rows
       whose height depends on their content still position correctly. -->
  <DynamicScroller v-if="showDS" :items="items" :min-item-size="minSize" page-mode>
    <template #default="{ item, index, active }">
      <!-- `active` is the scroller telling the row whether it is currently rendered;
           forwarding it is what lets the item measure and cache its own height. -->
      <DynamicScrollerItem :item="item" :active="active" :index="index">
        <slot :item="item" :index="index" :active="active" />
      </DynamicScrollerItem>
    </template>

    <!-- The sentinel sits in the `after` slot, which renders at the bottom of the
         scroll content — so it only enters the viewport once the list is scrolled to
         the end. That is the signal to ask for another page. -->
    <template #after>
      <div ref="domRef" class="py-5 text-center text-sm text-slate-400">
        <span
          v-if="loading && !isEnd"
          class="inline-block size-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500"
          aria-hidden="true"
        />
        <span v-else-if="isEnd" aria-live="polite">{{ endText }}</span>
      </div>
    </template>
  </DynamicScroller>
</template>

<script setup lang="ts" generic="TItem extends { id: string | number }">
import { computed, nextTick, ref, watch } from 'vue';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { useInViewport } from 'vue-hooks-plus';

const DEFAULT_MIN_ITEM_SIZE = 150;

// keyField is left at its default of 'id', which is why TItem has to carry one.
const props = withDefaults(
  defineProps<{
    items: TItem[];
    minItemSize?: number;
    loading?: boolean;
    isEnd?: boolean;
    endText?: string;
  }>(),
  {
    minItemSize: DEFAULT_MIN_ITEM_SIZE,
    loading: false,
    isEnd: false,
    endText: 'Nothing more to load',
  },
);

// DynamicScroller's minItemSize is required, and withDefaults' narrowing is not
// visible to every checker inside a `generic` SFC — WebStorm still reads the prop as
// number | undefined. Resolving the fallback here makes the binding a plain number
// for all of them, without repeating the literal.
const minSize = computed(() => props.minItemSize ?? DEFAULT_MIN_ITEM_SIZE);

const emit = defineEmits<{ loadMore: [] }>();

const domRef = ref<HTMLElement | null>(null);
const showDS = ref(true);
const [inViewport] = useInViewport(domRef);

function requestMore() {
  if (!props.isEnd) emit('loadMore');
}

/**
 * Fresh measurement of the sentinel, for the moments when `inViewport` is known to be
 * out of date. Assumes page-mode, i.e. the window is the scroll container.
 */
function sentinelInViewport() {
  const el = domRef.value;
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

// The observer reports a transition into view — the ordinary "scrolled to the bottom".
watch(inViewport, (visible) => {
  if (visible) requestMore();
});

watch(
  () => props.items,
  async (items) => {
    // Emptying the list (a filter change, say) leaves the scroller holding measured
    // heights for rows that no longer exist. Remounting it throws that cache away so
    // the next set of rows is measured from scratch.
    if (!items?.length) {
      showDS.value = false;
      await nextTick();
      showDS.value = true;
      return;
    }

    // A page that does not fill the viewport leaves the sentinel visible, and the
    // observer will not fire again — the intersection ratio never crosses 0 — so the
    // chain would stall. Hence this top-up check.
    //
    // It must MEASURE rather than read inViewport: that ref is only ever written from
    // the IntersectionObserver callback, which the browser has not run at this point,
    // so it still reports the state from before the list grew. Reading it here is what
    // fired the next page the instant the previous one landed.
    await nextTick();
    if (sentinelInViewport()) requestMore();
  },
);
</script>

<style>
/* Not scoped on purpose: the class belongs to vue-virtual-scroller. The wrapper clips
   by default, which would cut the cards' shadows off. */
.vue-recycle-scroller__item-wrapper {
  overflow: visible !important;
}
</style>
