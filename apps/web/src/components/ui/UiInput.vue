<script setup lang="ts">
defineProps<{ modelValue: string; type?: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <input
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :value="modelValue"
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-[#2f7dde] transition focus:ring-2"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
