<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const { selectedTenantSlug } = useSession();
type SyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'failed' | 'running';
  membersUpserted: number;
  membersActive: number;
  checksum: string | null;
  errorMessage: string | null;
  fileListJson: Record<string, unknown> | null;
};

const runs = ref<SyncRun[]>([]);
const selectedRunId = ref<string>('');

const selectedRun = computed(() => runs.value.find((run) => run.id === selectedRunId.value) ?? runs.value[0] ?? null);

const selectedDuration = computed(() => {
  if (!selectedRun.value?.finishedAt) return 'In progress';
  const ms = new Date(selectedRun.value.finishedAt).getTime() - new Date(selectedRun.value.startedAt).getTime();
  if (ms < 0) return 'n/a';
  return `${Math.round(ms / 1000)}s`;
});

const loadRuns = async () => {
  if (!selectedTenantSlug.value) return;
  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/sync-runs`);
  runs.value = data;
  if (!selectedRunId.value && runs.value.length > 0) {
    selectedRunId.value = runs.value[0].id;
  }
  if (selectedRunId.value && !runs.value.some((run) => run.id === selectedRunId.value) && runs.value.length > 0) {
    selectedRunId.value = runs.value[0].id;
  }
};

watch(selectedTenantSlug, loadRuns);
onMounted(loadRuns);
</script>

<template>
  <PageHeader title="Sync Runs" subtitle="Recent CAPWATCH ingestion history" />
  <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
    <div>
      <div class="grid gap-3 md:hidden">
        <button
          v-for="run in runs"
          :key="`mobile-${run.id}`"
          class="card text-left"
          @click="selectedRunId = run.id"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold">{{ new Date(run.startedAt).toLocaleString() }}</p>
            <UiBadge :tone="run.status === 'success' ? 'success' : 'warn'">{{ run.status }}</UiBadge>
          </div>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Upserted: {{ run.membersUpserted }}</p>
        </button>
      </div>

      <div class="table-shell hidden overflow-hidden md:block">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
          <tr><th class="px-4 py-3">Started</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Upserted</th></tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id" class="border-t border-slate-200 dark:border-slate-800">
            <td class="px-4 py-3">
              <button class="text-left hover:underline" @click="selectedRunId = run.id">{{ new Date(run.startedAt).toLocaleString() }}</button>
            </td>
            <td class="px-4 py-3">
              <UiBadge :tone="run.status === 'success' ? 'success' : 'warn'">{{ run.status }}</UiBadge>
            </td>
            <td class="px-4 py-3">{{ run.membersUpserted }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <div class="card">
      <h3 class="text-lg font-semibold">Run details</h3>
      <div v-if="selectedRun" class="mt-3 space-y-2 text-sm">
        <p><span class="font-medium">Started:</span> {{ new Date(selectedRun.startedAt).toLocaleString() }}</p>
        <p><span class="font-medium">Finished:</span> {{ selectedRun.finishedAt ? new Date(selectedRun.finishedAt).toLocaleString() : 'Running' }}</p>
        <p><span class="font-medium">Duration:</span> {{ selectedDuration }}</p>
        <p><span class="font-medium">Active Members:</span> {{ selectedRun.membersActive }}</p>
        <p><span class="font-medium">Checksum:</span> {{ selectedRun.checksum ?? 'n/a' }}</p>
        <div v-if="selectedRun.errorMessage" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {{ selectedRun.errorMessage }}
        </div>
        <div>
          <p class="mb-1 font-medium">Files</p>
          <pre class="max-h-64 overflow-auto rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-800">{{ JSON.stringify(selectedRun.fileListJson, null, 2) }}</pre>
        </div>
      </div>
      <p v-else class="mt-3 text-sm text-slate-500 dark:text-slate-400">Select a run to inspect files, timings, and errors.</p>
    </div>
  </div>
</template>
