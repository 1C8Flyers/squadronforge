<script setup lang="ts">
defineProps<{ open: boolean; title: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" @click.self="$emit('close')">
    <div class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">{{ title }}</h3>
        <button class="text-sm text-slate-500" @click="$emit('close')">Close</button>
      </div>
      <slot />
    </div>
  </div>
</template>
