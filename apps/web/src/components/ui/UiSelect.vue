<script setup lang="ts">
defineProps<{ modelValue: string; options: Array<{ label: string; value: string }> }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <select
    :value="modelValue"
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
  </select>
</template>
