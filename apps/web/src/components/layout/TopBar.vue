<script setup lang="ts">
import { Menu } from 'lucide-vue-next';
import { onMounted } from 'vue';
import { useSession } from '@/state/session';

const emit = defineEmits<{ 'toggle-sidebar': [] }>();
const { me, tenants, selectedTenantSlug, setTenantSlug, hydrateSession, logout } = useSession();

onMounted(() => {
  hydrateSession();
});

const signOut = async () => {
  await logout();
  window.location.href = '/login';
};
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-yellow-400 bg-slate-100/95 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button class="rounded-lg p-2 text-slate-700 hover:bg-white lg:hidden" @click="emit('toggle-sidebar')">
        <Menu class="size-5" />
      </button>

      <div class="ml-auto flex items-center gap-3">
        <select
          :value="selectedTenantSlug"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          @change="setTenantSlug(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.slug">{{ tenant.name }}</option>
        </select>

        <div class="flex items-center gap-2">
          <div class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">{{ me?.email ?? 'User' }}</div>
          <button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" @click="signOut">
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
