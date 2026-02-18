<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const query = ref('');
const status = ref('all');
const type = ref('all');
const { selectedTenantSlug } = useSession();

const members = ref<Array<{ capid: string; firstName: string; lastName: string; memberType: string; status: string; unitCharter?: string }>>([]);
const page = ref(1);
const pageSize = ref('25');
const total = ref(0);

const loadMembers = async () => {
  if (!selectedTenantSlug.value) return;
  const params: Record<string, string> = {};
  if (query.value) params.search = query.value;
  if (status.value !== 'all') params.status = status.value;
  if (type.value !== 'all') params.memberType = type.value;
  params.page = String(page.value);
  params.pageSize = pageSize.value;

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/members`, { params });
  members.value = data.items;
  total.value = data.total;
};

const exportCsv = async () => {
  if (!selectedTenantSlug.value) return;
  const params: Record<string, string> = {};
  if (query.value) params.search = query.value;
  if (status.value !== 'all') params.status = status.value;
  if (type.value !== 'all') params.memberType = type.value;

  const response = await api.get(`/tenant/${selectedTenantSlug.value}/members/export.csv`, {
    params,
    responseType: 'blob'
  });

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${selectedTenantSlug.value}-members.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

watch([query, status, type, selectedTenantSlug], () => {
  page.value = 1;
  loadMembers();
});
watch([page, pageSize], loadMembers);
onMounted(loadMembers);
</script>

<template>
  <PageHeader title="Members" subtitle="Search, filter, and export membership data">
    <UiButton @click="exportCsv">Export CSV</UiButton>
  </PageHeader>

  <div class="mb-4 grid gap-3 md:grid-cols-3">
    <UiInput v-model="query" placeholder="Search name, CAPID, email" />
    <UiSelect v-model="status" :options="[{ label: 'All statuses', value: 'all' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]" />
    <UiSelect v-model="type" :options="[{ label: 'All types', value: 'all' }, { label: 'Cadet', value: 'CADET' }, { label: 'Senior', value: 'SENIOR' }]" />
  </div>

  <div class="grid gap-3 md:hidden">
    <div v-for="row in members" :key="`m-${row.capid}`" class="card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-base font-semibold">{{ row.lastName }}, {{ row.firstName }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">CAPID {{ row.capid }}</p>
        </div>
        <UiBadge :tone="row.status === 'ACTIVE' ? 'success' : 'warn'">{{ row.status }}</UiBadge>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Type</p>
          <p>{{ row.memberType }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Unit</p>
          <p>{{ row.unitCharter ?? '—' }}</p>
        </div>
      </div>
    </div>
  </div>

  <UiTable class="hidden md:block">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
      <tr>
        <th class="px-4 py-3">CAPID</th><th class="px-4 py-3">Name</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Unit</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in members" :key="row.capid" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3 font-medium">{{ row.capid }}</td>
        <td class="px-4 py-3">{{ row.lastName }}, {{ row.firstName }}</td>
        <td class="px-4 py-3">{{ row.memberType }}</td>
        <td class="px-4 py-3"><UiBadge tone="success">{{ row.status }}</UiBadge></td>
        <td class="px-4 py-3">{{ row.unitCharter }}</td>
      </tr>
    </tbody>
  </UiTable>

  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">Showing {{ members.length }} of {{ total }} members</p>
    <div class="flex items-center gap-2">
      <UiSelect v-model="pageSize" :options="[{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]" />
      <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
      <span class="px-2">Page {{ page }}</span>
      <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
    </div>
  </div>
</template>
