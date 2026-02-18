<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    variant: 'primary',
    type: 'button'
  }
);
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition"
    :class="{
      'bg-indigo-600 text-white hover:bg-indigo-500': variant === 'primary',
      'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800': variant === 'secondary',
      'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800': variant === 'ghost',
      'bg-rose-600 text-white hover:bg-rose-500': variant === 'danger'
    }"
  >
    <slot />
  </button>
</template>
