<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight text-white">{{ title }}</h2>
      <p v-if="subtitle" class="text-sm text-slate-200">{{ subtitle }}</p>
    </div>
    <slot />
  </div>
</template>
