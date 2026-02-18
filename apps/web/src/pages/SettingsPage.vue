<script setup lang="ts">
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { computed, onMounted, ref, watch } from 'vue';
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
const { selectedTenantSlug } = useSession();

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
  actionMessage.value = '';
  try {
    await api.post(`/tenant/${selectedTenantSlug.value}/sync-now`);
    actionMessage.value = 'CAPWATCH pull queued. Check Sync Runs for progress.';
  } finally {
    runningSync.value = false;
  }
};

watch(selectedTenantSlug, loadSettings);
onMounted(loadSettings);
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
</template>
