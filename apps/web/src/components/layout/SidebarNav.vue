<script setup lang="ts">
import { Home, Users, BriefcaseBusiness, RefreshCcw, Settings, Shield, X } from 'lucide-vue-next';

defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();

const navItems = [
  { label: 'Dashboard', to: '/', icon: Home },
  { label: 'Members', to: '/members', icon: Users },
  { label: 'Duty Positions', to: '/duty-positions', icon: BriefcaseBusiness },
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
      class="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-yellow-400 bg-[#06265b] p-4 transition-transform lg:static lg:z-auto lg:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="mb-8 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-yellow-300">SquadronForge</p>
          <h1 class="text-lg font-bold text-white">Control Center</h1>
        </div>
        <button class="rounded-lg p-2 text-slate-100 hover:bg-slate-700 lg:hidden" @click="$emit('close')">
          <X class="size-5" />
        </button>
      </div>

      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-[#0b3a86] hover:text-white"
          active-class="bg-[#0b3a86] text-white"
          @click="$emit('close')"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>
