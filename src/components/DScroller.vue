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
    endText: 'No more data',
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

watch([inViewport, () => props.items], ([inViewportNewVal, itemsNewVal]) => {
  if (inViewportNewVal && !props.isEnd) {
    emit('loadMore');
  }
  // Emptying the list (a filter change, say) leaves the scroller holding measured
  // heights for rows that no longer exist. Remounting it throws that cache away so
  // the next set of rows is measured from scratch.
  if (!itemsNewVal?.length) {
    showDS.value = false;
    nextTick(() => {
      showDS.value = true;
    });
  }
});
</script>

<style>
/* Not scoped on purpose: the class belongs to vue-virtual-scroller. The wrapper clips
   by default, which would cut the cards' shadows off. */
.vue-recycle-scroller__item-wrapper {
  overflow: visible !important;
}
</style>
