<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { CATEGORIES, type Category } from '../lib/constants';
import IconChevronDown from '~icons/heroicons/chevron-down-20-solid';

// The committed value, not the typed text. Null means "nothing chosen yet", so the
// parent can keep requiring an explicit choice.
const model = defineModel<Category | null>({ required: true });

const props = defineProps<{ id: string; placeholder?: string }>();

// `query` is display state: what is in the box right now, valid or not. It only
// becomes a Category by going through select(), so the model can never hold a
// half-typed string.
const query = ref(model.value ?? '');
const open = ref(false);
const activeIndex = ref(0);
const root = ref<HTMLElement>();

const listboxId = computed(() => `${props.id}-listbox`);
const optionId = (i: number) => `${props.id}-option-${i}`;

// startsWith rather than includes: "cul" should find Culture, but "al" should not
// offer Technical — prefix matching is what makes the first hit predictable enough
// to commit on Enter.
const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [...CATEGORIES];
  return CATEGORIES.filter((c) => c.toLowerCase().startsWith(q));
});

// An external reset (the parent clears the form after a successful submit) has to
// clear the typed text too, or the box would still read "Culture" with no value
// behind it.
watch(model, (value) => {
  query.value = value ?? '';
});

function select(category: Category) {
  model.value = category;
  query.value = category;
  open.value = false;
  activeIndex.value = 0;
}

/** Drops back to whatever is committed — used by Escape and by an unresolvable blur. */
function revert() {
  query.value = model.value ?? '';
  open.value = false;
  activeIndex.value = 0;
}

function onInput() {
  open.value = true;
  activeIndex.value = 0;
  // Typing invalidates the previous choice: leaving it committed would let someone
  // submit "Culture" while the box reads "tech".
  model.value = null;
}

function move(delta: number) {
  if (!open.value) {
    open.value = true;
    return;
  }
  const count = matches.value.length;
  if (count === 0) return;
  activeIndex.value = (activeIndex.value + delta + count) % count;
}

/**
 * Resolves the typed text on Enter, Tab, and blur. An exact name wins; otherwise a
 * prefix that narrows to exactly one category is taken as that category — this is
 * what turns "cul" into Culture. Anything ambiguous or unknown reverts instead of
 * guessing.
 */
function commit() {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    model.value = null;
    revert();
    return;
  }
  const exact = CATEGORIES.find((c) => c.toLowerCase() === q);
  const only = matches.value.length === 1 ? matches.value[0] : undefined;
  const resolved = exact ?? only;
  if (resolved) select(resolved);
  else revert();
}

function onEnter() {
  // When the list is open the highlighted row wins, so Down-Down-Enter does what it
  // looks like; otherwise fall back to resolving the text.
  const active = open.value ? matches.value[activeIndex.value] : undefined;
  if (active) select(active);
  else commit();
}

async function onBlur() {
  // Let a click on an option land first: options use mousedown.prevent, but focus can
  // also leave by other means, and this keeps the ordering explicit.
  await nextTick();
  if (root.value?.contains(document.activeElement)) return;
  commit();
}
</script>

<template>
  <div ref="root" class="relative" @focusout="onBlur">
    <input
      :id="id"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-controls="listboxId"
      :aria-expanded="open"
      :aria-activedescendant="open && matches.length ? optionId(activeIndex) : undefined"
      :placeholder="placeholder"
      class="w-44 rounded-md border border-slate-300 bg-white py-1.5 pl-3 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      @input="onInput"
      @focus="open = true"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc.prevent="revert()"
      @keydown.tab="commit()"
    />

    <!-- Decorative: the input already announces itself as a combobox, and the arrow
         must not steal the click that focuses the field. -->
    <IconChevronDown
      class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      aria-hidden="true"
    />

    <ul
      v-if="open && matches.length"
      :id="listboxId"
      role="listbox"
      class="absolute z-10 mt-1 max-h-56 w-44 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      <li
        v-for="(c, i) in matches"
        :id="optionId(i)"
        :key="c"
        role="option"
        :aria-selected="model === c"
        class="cursor-pointer px-3 py-1.5"
        :class="i === activeIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-600'"
        @mousedown.prevent="select(c)"
        @mousemove="activeIndex = i"
      >
        {{ c }}
      </li>
    </ul>

    <!-- aria-live so a screen reader hears that typing narrowed to nothing; sighted
         users get the same from the list simply not being there. -->
    <p
      v-else-if="open && query.trim()"
      class="absolute z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 shadow-lg"
      aria-live="polite"
    >
      No match
    </p>
  </div>
</template>
