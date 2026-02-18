<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'danger' }>(), { tone: 'info' });
</script>

<template>
  <div
    class="rounded-lg border px-4 py-3 text-sm"
    :class="{
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300': tone === 'info',
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300': tone === 'danger'
    }"
  >
    <slot />
  </div>
</template>
