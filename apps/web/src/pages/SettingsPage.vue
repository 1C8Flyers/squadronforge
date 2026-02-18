<script setup lang="ts">
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const membershipFilename = ref('');
const dutyPositionFilename = ref('');
const saving = ref(false);
const runningSync = ref(false);
const actionMessage = ref('');
const latestRun = ref<{
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'failed' | 'running';
  membersUpserted: number;
  membersActive: number;
  errorMessage: string | null;
  fileListJson: Record<string, unknown> | null;
} | null>(null);
const queuedAt = ref<number | null>(null);
let pollHandle: ReturnType<typeof setInterval> | null = null;
const { selectedTenantSlug } = useSession();

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
    await loadLatestRun();
  }, 3000);
};

const loadLatestRun = async () => {
  if (!selectedTenantSlug.value) {
    latestRun.value = null;
    return;
  }

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/sync-runs`);
  const runs = data as Array<typeof latestRun.value extends infer T ? T : never>;
  if (queuedAt.value) {
    const queuedRun = runs.find((run) => new Date((run as any).startedAt).getTime() >= queuedAt.value! - 1000);
    latestRun.value = (queuedRun as any) ?? (runs[0] as any) ?? null;
  } else {
    latestRun.value = (runs[0] as any) ?? null;
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
    actionMessage.value = 'CAPWATCH pull queued. Check Sync Runs for progress.';
    await loadLatestRun();
    startPolling();
  } finally {
    runningSync.value = false;
  }
};

watch(selectedTenantSlug, async () => {
  stopPolling();
  queuedAt.value = null;
  await loadSettings();
  await loadLatestRun();
  if (latestRun.value?.status === 'running') {
    startPolling();
  }
});

watch(shouldPoll, (value) => {
  if (value) startPolling();
  else stopPolling();
});

onMounted(async () => {
  await loadSettings();
  await loadLatestRun();
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
