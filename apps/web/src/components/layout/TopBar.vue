<script setup lang="ts">
import { LogOut, Menu, Moon, Sun } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { useSession } from '@/state/session';

const emit = defineEmits<{ 'toggle-sidebar': [] }>();
const dark = ref(false);
const { me, tenants, selectedTenantSlug, setTenantSlug, hydrateSession, logout } = useSession();

const applyTheme = (value: boolean) => {
  dark.value = value;
  document.documentElement.classList.toggle('dark', value);
  localStorage.setItem('sf_dark_mode', JSON.stringify(value));
};

onMounted(() => {
  const stored = localStorage.getItem('sf_dark_mode');
  applyTheme(stored ? JSON.parse(stored) : false);
  hydrateSession();
});

const signOut = async () => {
  await logout();
  window.location.href = '/login';
};
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
    <div class="mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8">
      <button class="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" @click="emit('toggle-sidebar')">
        <Menu class="size-5" />
      </button>

      <div class="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <select
          :value="selectedTenantSlug"
          class="max-w-[11rem] rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 sm:max-w-none sm:px-3 sm:text-sm"
          @change="setTenantSlug(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.slug">{{ tenant.name }}</option>
        </select>

        <button class="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" @click="applyTheme(!dark)">
          <Sun v-if="dark" class="size-5" />
          <Moon v-else class="size-5" />
        </button>

        <div class="hidden items-center gap-2 md:flex">
          <div class="max-w-[18rem] truncate rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">{{ me?.email ?? 'User' }}</div>
          <button class="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" @click="signOut">
            Logout
          </button>
        </div>

        <button class="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 md:hidden" @click="signOut" aria-label="Logout">
          <LogOut class="size-4" />
        </button>
      </div>
    </div>
  </header>
</template>
