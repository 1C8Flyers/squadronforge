<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const router = useRouter();
const { activeTenant, selectedTenantSlug } = useSession();
type DashboardPayload = {
  lastRun: { startedAt: string } | null;
  memberCount: number;
  activeCount: number;
  nextRunAt?: string;
  nextEvent?: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    uniformOfDay: 'PT' | 'ABU_OCP' | 'BLUES' | null;
  } | null;
};

const dashboard = ref<DashboardPayload | null>(null);

const loadDashboard = async () => {
  if (!selectedTenantSlug.value) return;
  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/dashboard`);
  dashboard.value = data;
};

const runSyncNow = async () => {
  if (!selectedTenantSlug.value) return;
  await api.post(`/tenant/${selectedTenantSlug.value}/sync-now`);
};

const lastSyncLabel = computed(() => {
  const date = dashboard.value?.lastRun?.startedAt;
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
});

const nextRunLabel = computed(() => {
  const date = dashboard.value?.nextRunAt;
  if (!date) return 'n/a';
  return new Date(date).toLocaleString();
});

const nextEventStartLabel = computed(() => {
  const date = dashboard.value?.nextEvent?.startsAt;
  if (!date) return 'No upcoming events';
  return new Date(date).toLocaleString();
});

const nextEventUniformLabel = computed(() => {
  const value = dashboard.value?.nextEvent?.uniformOfDay;
  if (!value) return 'UOD: Not set';
  if (value === 'ABU_OCP') return 'UOD: ABU/OCP';
  return `UOD: ${value}`;
});

watch(selectedTenantSlug, () => {
  loadDashboard();
});

onMounted(loadDashboard);
</script>

<template>
  <PageHeader title="Dashboard" :subtitle="activeTenant?.name ?? 'No tenant selected'" />

  <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
    <UiCard>
      <p class="text-sm text-slate-500">Last sync</p>
      <p class="mt-2 text-xl font-semibold">{{ lastSyncLabel }}</p>
    </UiCard>
    <UiCard>
      <p class="text-sm text-slate-500">Next run</p>
      <p class="mt-2 text-xl font-semibold">{{ nextRunLabel }}</p>
    </UiCard>
    <UiCard>
      <p class="text-sm text-slate-500">Members</p>
      <p class="mt-2 text-xl font-semibold">{{ dashboard?.memberCount ?? 0 }}</p>
    </UiCard>
    <UiCard>
      <p class="text-sm text-slate-500">Active</p>
      <p class="mt-2 text-xl font-semibold">{{ dashboard?.activeCount ?? 0 }}</p>
    </UiCard>
    <UiCard>
      <p class="text-sm text-slate-500">Next event</p>
      <p class="mt-2 text-base font-semibold">{{ dashboard?.nextEvent?.title ?? 'No upcoming events' }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ nextEventStartLabel }}</p>
      <p class="mt-1 text-xs text-slate-500">{{ nextEventUniformLabel }}</p>
    </UiCard>
  </section>

  <section class="mt-6 card">
    <h3 class="text-lg font-semibold">Quick actions</h3>
    <div class="mt-4 flex flex-wrap gap-3">
      <UiButton @click="runSyncNow">Sync now</UiButton>
      <UiButton variant="secondary" @click="router.push('/members')">Open Members</UiButton>
      <UiButton variant="ghost" @click="router.push('/settings?tab=sync-log')">View Sync Log</UiButton>
    </div>
  </section>
</template>
