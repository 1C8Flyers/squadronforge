<script setup lang="ts">
import { Home, Users, BriefcaseBusiness, Award, ChartColumnIncreasing, RefreshCcw, Settings, Shield, X } from 'lucide-vue-next';

defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();

const navItems = [
  { label: 'Dashboard', to: '/', icon: Home },
  { label: 'Members', to: '/members', icon: Users },
  { label: 'Duty Positions', to: '/duty-positions', icon: BriefcaseBusiness },
  { label: 'Cadet Promotions', to: '/cadet-promotions', icon: Award },
  { label: 'Reports', to: '/reports', icon: ChartColumnIncreasing },
  { label: 'Sync Runs', to: '/sync-runs', icon: RefreshCcw },
  { label: 'Settings', to: '/settings', icon: Settings },
  { label: 'Admin', to: '/admin', icon: Shield }
];
</script>

<template>
  <aside>
    <div
      class="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
      :class="open ? 'block' : 'hidden'"
      @click="$emit('close')"
    />

    <div
      class="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="mb-8 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-indigo-500">SquadronForge</p>
          <h1 class="text-lg font-bold">Control Center</h1>
        </div>
        <button class="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" @click="$emit('close')">
          <X class="size-5" />
        </button>
      </div>

      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          @click="$emit('close')"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>
