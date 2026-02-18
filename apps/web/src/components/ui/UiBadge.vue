<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'success' | 'warn' | 'neutral' }>(), { tone: 'neutral' });
</script>

<template>
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
    :class="{
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300': tone === 'success',
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300': tone === 'warn',
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100': tone === 'neutral'
    }"
  >
    <slot />
  </span>
</template>
