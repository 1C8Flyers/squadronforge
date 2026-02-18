<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import SidebarNav from '@/components/layout/SidebarNav.vue';
import TopBar from '@/components/layout/TopBar.vue';

const route = useRoute();
const sidebarOpen = ref(false);
const isAuthPage = computed(() => route.path === '/login');
</script>

<template>
  <div v-if="isAuthPage" class="min-h-dvh">
    <RouterView />
  </div>
  <div v-else class="flex min-h-dvh bg-slate-100 dark:bg-slate-950">
    <SidebarNav :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="min-w-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]">
      <TopBar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <RouterView />
      </main>
    </div>
  </div>
</template>
