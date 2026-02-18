<script setup lang="ts">
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib';
import { useSession } from '@/state/session';

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

const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const membershipFilename = ref('');
const dutyPositionFilename = ref('');
const saving = ref(false);
const runningSync = ref(false);
const actionMessage = ref('');
const syncRuns = ref<SyncRun[]>([]);
const selectedRunId = ref('');
const activeTab = ref<'settings' | 'sync-log'>('settings');
const queuedAt = ref<number | null>(null);
let pollHandle: ReturnType<typeof setInterval> | null = null;
const { selectedTenantSlug } = useSession();
const route = useRoute();
const router = useRouter();

const latestRun = computed<SyncRun | null>(() => syncRuns.value[0] ?? null);
const selectedRun = computed<SyncRun | null>(() => syncRuns.value.find((run) => run.id === selectedRunId.value) ?? latestRun.value);

const selectedDuration = computed(() => {
  if (!selectedRun.value?.finishedAt) return 'In progress';
  const ms = new Date(selectedRun.value.finishedAt).getTime() - new Date(selectedRun.value.startedAt).getTime();
  if (ms < 0) return 'n/a';
  return `${Math.round(ms / 1000)}s`;
});

const latestRunStage = computed(() => {
  const raw = latestRun.value?.fileListJson?.stage;
  return typeof raw === 'string' ? raw : latestRun.value?.status ?? 'idle';
});

const stageLabel = computed(() => {
  const stage = latestRunStage.value;
  const labels: Record<string, string> = {
    queued: 'Queued',
    downloading: 'Downloading CAPWATCH ZIP',
    extracting: 'Extracting ZIP',
    parsing: 'Parsing files',
    importing: 'Importing members',
    running: 'Running',
    success: 'Completed',
    failed: 'Failed'
  };
  return labels[stage] ?? 'Running';
});

const progressPercent = computed(() => {
  const stage = latestRunStage.value;
  const map: Record<string, number> = {
    queued: 10,
    downloading: 25,
    extracting: 45,
    parsing: 65,
    importing: 85,
    running: 60,
    success: 100,
    failed: 100
  };
  return map[stage] ?? 0;
});

const progressBarClass = computed(() => {
  if (latestRun.value?.status === 'failed') return 'bg-rose-500';
  if (latestRun.value?.status === 'success') return 'bg-emerald-500';
  return 'bg-indigo-500';
});

const latestRunStartedLabel = computed(() => {
  const date = latestRun.value?.startedAt;
  return date ? new Date(date).toLocaleString() : 'n/a';
});

const shouldPoll = computed(() => latestRun.value?.status === 'running' || runningSync.value);

const activeTabFromRoute = (): 'settings' | 'sync-log' => (route.query.tab === 'sync-log' ? 'sync-log' : 'settings');

const cronHumanized = computed(() => {
  const value = cron.value.trim();
  const parts = value.split(/\s+/);
  if (parts.length !== 5) {
    return 'Enter a 5-part cron expression (minute hour day month weekday).';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === '0' && /^\*\/\d+$/.test(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const interval = hour.split('/')[1];
    return `Every ${interval} hours at minute 00.`;
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}.`;
  }

  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute.';
  }

  return 'Custom schedule. Runs in the tenant timezone.';
});

const stopPolling = () => {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
};

const startPolling = () => {
  if (pollHandle) return;
  pollHandle = setInterval(async () => {
    await loadSyncRuns();
  }, 3000);
};

const loadSyncRuns = async () => {
  if (!selectedTenantSlug.value) {
    syncRuns.value = [];
    return;
  }

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/sync-runs`);
  const runs = data as SyncRun[];
  syncRuns.value = runs;

  if (!selectedRunId.value && runs.length > 0) {
    selectedRunId.value = runs[0].id;
  }

  if (selectedRunId.value && !runs.some((run) => run.id === selectedRunId.value) && runs.length > 0) {
    selectedRunId.value = runs[0].id;
  }

  if (queuedAt.value) {
    const queuedRun = runs.find((run) => new Date(run.startedAt).getTime() >= queuedAt.value! - 1000);
    if (queuedRun) {
      selectedRunId.value = queuedRun.id;
    }
  }

  if (latestRun.value?.status !== 'running') {
    runningSync.value = false;
    if (!shouldPoll.value) {
      stopPolling();
    }
  }
};

const loadSettings = async () => {
  if (!selectedTenantSlug.value) return;
  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/settings`);
  orgid.value = String(data.orgid);
  unitOnly.value = data.unitOnly ? '1' : '0';
  timezone.value = data.timezone;
  cron.value = data.syncScheduleCron;
  const fileMapping = (data.fileMappingJson ?? {}) as Record<string, string>;
  membershipFilename.value = fileMapping.membership ?? '';
  dutyPositionFilename.value = fileMapping.dutyPosition ?? '';
};

const saveSettings = async () => {
  if (!selectedTenantSlug.value) return;
  saving.value = true;
  actionMessage.value = '';
  const fileMappingJson: Record<string, string> = {};
  if (membershipFilename.value.trim()) {
    fileMappingJson.membership = membershipFilename.value.trim();
  }
  if (dutyPositionFilename.value.trim()) {
    fileMappingJson.dutyPosition = dutyPositionFilename.value.trim();
  }

  try {
    await api.patch(`/tenant/${selectedTenantSlug.value}/settings`, {
      orgid: Number(orgid.value),
      unitOnly: unitOnly.value === '1',
      timezone: timezone.value,
      syncScheduleCron: cron.value,
      fileMappingJson
    });
    actionMessage.value = 'Settings saved.';
  } finally {
    saving.value = false;
  }
};

const pullNow = async () => {
  if (!selectedTenantSlug.value) return;
  runningSync.value = true;
  queuedAt.value = Date.now();
  actionMessage.value = '';
  try {
    await api.post(`/tenant/${selectedTenantSlug.value}/sync-now`);
    actionMessage.value = 'CAPWATCH pull queued. Check Sync Log for progress.';
    await loadSyncRuns();
    startPolling();
  } finally {
    runningSync.value = false;
  }
};

watch(selectedTenantSlug, async () => {
  stopPolling();
  queuedAt.value = null;
  await loadSettings();
  await loadSyncRuns();
  if (latestRun.value?.status === 'running') {
    startPolling();
  }
});

watch(
  () => route.query.tab,
  () => {
    activeTab.value = activeTabFromRoute();
  }
);

watch(activeTab, (tab) => {
  const nextQuery = { ...route.query };
  if (tab === 'sync-log') {
    nextQuery.tab = 'sync-log';
  } else {
    delete nextQuery.tab;
  }

  router.replace({ query: nextQuery });
});

watch(shouldPoll, (value) => {
  if (value) startPolling();
  else stopPolling();
});

onMounted(async () => {
  activeTab.value = activeTabFromRoute();
  await loadSettings();
  await loadSyncRuns();
  if (latestRun.value?.status === 'running') {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <PageHeader title="Tenant Settings" subtitle="Sync schedule and file mapping overrides" />
  <div class="mb-4 flex flex-wrap gap-2">
    <UiButton :variant="activeTab === 'settings' ? 'primary' : 'secondary'" @click="activeTab = 'settings'">Settings</UiButton>
    <UiButton :variant="activeTab === 'sync-log' ? 'primary' : 'secondary'" @click="activeTab = 'sync-log'">Sync Log</UiButton>
  </div>

  <template v-if="activeTab === 'settings'">
    <form class="card grid gap-4 md:grid-cols-2" @submit.prevent="saveSettings">
      <div>
        <label class="mb-1 block text-sm">ORGID</label>
        <UiInput v-model="orgid" />
      </div>
      <div>
        <label class="mb-1 block text-sm">Unit Only</label>
        <UiSelect v-model="unitOnly" :options="[{label:'Yes',value:'1'},{label:'No',value:'0'}]" />
      </div>
      <div>
        <label class="mb-1 block text-sm">Timezone</label>
        <UiInput v-model="timezone" />
      </div>
      <div>
        <label class="mb-1 block text-sm">Cron schedule</label>
        <UiInput v-model="cron" />
        <p class="mt-1 text-xs text-slate-500">{{ cronHumanized }}</p>
      </div>
      <div>
        <label class="mb-1 block text-sm">Membership filename override</label>
        <UiInput v-model="membershipFilename" placeholder="e.g., MbrContact.txt" />
      </div>
      <div>
        <label class="mb-1 block text-sm">Duty-position filename override</label>
        <UiInput v-model="dutyPositionFilename" placeholder="e.g., DutyPosition.txt" />
      </div>
      <div class="md:col-span-2 flex flex-wrap items-center gap-3">
        <UiButton type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save settings' }}</UiButton>
        <UiButton variant="secondary" :disabled="runningSync" @click="pullNow">{{ runningSync ? 'Queueing...' : 'Pull now' }}</UiButton>
        <p v-if="actionMessage" class="text-sm text-slate-500">{{ actionMessage }}</p>
      </div>
    </form>

    <section class="card mt-4">
      <h3 class="text-lg font-semibold">Latest CAPWATCH pull</h3>
      <div v-if="latestRun" class="mt-3 space-y-3 text-sm">
        <div class="flex items-center justify-between gap-2">
          <p class="font-medium">{{ stageLabel }}</p>
          <p class="text-slate-500">Started {{ latestRunStartedLabel }}</p>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full transition-all duration-500" :class="progressBarClass" :style="{ width: `${progressPercent}%` }" />
        </div>
        <div class="grid gap-2 text-slate-600 dark:text-slate-300 md:grid-cols-2">
          <p>Imported: {{ latestRun.membersUpserted }}</p>
          <p>Active: {{ latestRun.membersActive }}</p>
        </div>
        <p v-if="latestRun.errorMessage" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {{ latestRun.errorMessage }}
        </p>
      </div>
      <p v-else class="mt-3 text-sm text-slate-500 dark:text-slate-400">No sync runs yet.</p>
    </section>
  </template>

  <template v-else>
    <section class="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div class="grid gap-3 md:hidden">
          <button
            v-for="run in syncRuns"
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
          <div v-if="syncRuns.length === 0" class="card text-sm text-slate-500 dark:text-slate-400">No sync runs yet.</div>
        </div>

        <div class="table-shell hidden overflow-hidden md:block">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr><th class="px-4 py-3">Started</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Upserted</th></tr>
            </thead>
            <tbody>
              <tr v-for="run in syncRuns" :key="run.id" class="border-t border-slate-200 dark:border-slate-800">
                <td class="px-4 py-3">
                  <button class="text-left hover:underline" @click="selectedRunId = run.id">{{ new Date(run.startedAt).toLocaleString() }}</button>
                </td>
                <td class="px-4 py-3">
                  <UiBadge :tone="run.status === 'success' ? 'success' : 'warn'">{{ run.status }}</UiBadge>
                </td>
                <td class="px-4 py-3">{{ run.membersUpserted }}</td>
              </tr>
              <tr v-if="syncRuns.length === 0" class="border-t border-slate-200 dark:border-slate-800">
                <td colspan="3" class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No sync runs yet.</td>
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
    </section>
  </template>
</template>
