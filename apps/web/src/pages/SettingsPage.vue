<script setup lang="ts">
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { onMounted, ref, watch } from 'vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const membershipFilename = ref('');
const dutyPositionFilename = ref('');
const { selectedTenantSlug } = useSession();

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
  const fileMappingJson: Record<string, string> = {};
  if (membershipFilename.value.trim()) {
    fileMappingJson.membership = membershipFilename.value.trim();
  }
  if (dutyPositionFilename.value.trim()) {
    fileMappingJson.dutyPosition = dutyPositionFilename.value.trim();
  }

  await api.patch(`/tenant/${selectedTenantSlug.value}/settings`, {
    orgid: Number(orgid.value),
    unitOnly: unitOnly.value === '1',
    timezone: timezone.value,
    syncScheduleCron: cron.value,
    fileMappingJson
  });
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
    </div>
    <div>
      <label class="mb-1 block text-sm">Membership filename override</label>
      <UiInput v-model="membershipFilename" placeholder="e.g., MbrContact.txt" />
    </div>
    <div>
      <label class="mb-1 block text-sm">Duty-position filename override</label>
      <UiInput v-model="dutyPositionFilename" placeholder="e.g., DutyPosition.txt" />
    </div>
    <div class="md:col-span-2"><UiButton type="submit">Save settings</UiButton></div>
  </form>
</template>
