<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiTable from '@/components/ui/UiTable.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

type DutyPosition = {
  id: string;
  capid: string;
  dutyName: string;
  dutyCode: string | null;
  startDate: string | null;
  endDate: string | null;
};

const { selectedTenantSlug } = useSession();
const capid = ref('');
const dutyCode = ref('');
const items = ref<DutyPosition[]>([]);
const page = ref(1);
const pageSize = ref('50');
const total = ref(0);

const loadDutyPositions = async () => {
  if (!selectedTenantSlug.value) return;
  const params: Record<string, string> = {};
  if (capid.value.trim()) params.capid = capid.value.trim();
  if (dutyCode.value.trim()) params.dutyCode = dutyCode.value.trim();
  params.page = String(page.value);
  params.pageSize = pageSize.value;

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/duty-positions`, { params });
  items.value = data.items;
  total.value = data.total;
};

watch([selectedTenantSlug, capid, dutyCode], () => {
  page.value = 1;
  loadDutyPositions();
});
watch([page, pageSize], loadDutyPositions);
onMounted(loadDutyPositions);
</script>

<template>
  <PageHeader title="Duty Positions" subtitle="Optional CAPWATCH duty assignments by member" />

  <div class="mb-4 grid gap-3 md:grid-cols-3">
    <UiInput v-model="capid" placeholder="Filter by CAPID" />
    <UiInput v-model="dutyCode" placeholder="Filter by duty code" />
    <UiButton @click="loadDutyPositions">Refresh</UiButton>
  </div>

  <div class="grid gap-3 md:hidden">
    <div v-for="row in items" :key="`dp-${row.id}`" class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-base font-semibold">{{ row.dutyName }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">CAPID {{ row.capid }}</p>
        </div>
        <span class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{{ row.dutyCode ?? '—' }}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Start</p>
          <p>{{ row.startDate ? new Date(row.startDate).toLocaleDateString() : '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">End</p>
          <p>{{ row.endDate ? new Date(row.endDate).toLocaleDateString() : '—' }}</p>
        </div>
      </div>
    </div>
  </div>

  <UiTable class="hidden md:block">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
      <tr>
        <th class="px-4 py-3">CAPID</th>
        <th class="px-4 py-3">Duty Name</th>
        <th class="px-4 py-3">Duty Code</th>
        <th class="px-4 py-3">Start</th>
        <th class="px-4 py-3">End</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in items" :key="row.id" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3 font-medium">{{ row.capid }}</td>
        <td class="px-4 py-3">{{ row.dutyName }}</td>
        <td class="px-4 py-3">{{ row.dutyCode ?? '—' }}</td>
        <td class="px-4 py-3">{{ row.startDate ? new Date(row.startDate).toLocaleDateString() : '—' }}</td>
        <td class="px-4 py-3">{{ row.endDate ? new Date(row.endDate).toLocaleDateString() : '—' }}</td>
      </tr>
    </tbody>
  </UiTable>

  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} duty positions</p>
    <div class="flex items-center gap-2">
      <UiSelect v-model="pageSize" :options="[{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]" />
      <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
      <span class="px-2">Page {{ page }}</span>
      <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
    </div>
  </div>
</template>
