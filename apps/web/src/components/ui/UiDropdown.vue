<script setup lang="ts">
import { ref } from 'vue';

const open = ref(false);
</script>

<template>
  <div class="relative inline-block text-left">
    <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" @click="open = !open">
      <slot name="trigger">Menu</slot>
    </button>
    <div
      v-if="open"
      class="absolute right-0 z-10 mt-2 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <slot />
    </div>
  </div>
</template>
