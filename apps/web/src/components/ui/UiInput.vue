<script setup lang="ts">
defineProps<{ modelValue: string; type?: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <input
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :value="modelValue"
    class="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
