<script setup lang="ts">
defineProps<{ modelValue: string; type?: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <input
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :value="modelValue"
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
