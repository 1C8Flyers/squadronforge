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
      'bg-[#002c98] text-white hover:bg-[#0b3a86]': variant === 'primary',
      'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50': variant === 'secondary',
      'hover:bg-slate-100 text-slate-700': variant === 'ghost',
      'bg-rose-600 text-white hover:bg-rose-500': variant === 'danger'
    }"
  >
    <slot />
  </button>
</template>
