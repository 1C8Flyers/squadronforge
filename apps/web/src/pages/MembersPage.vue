<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiModal from '@/components/ui/UiModal.vue';
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
const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref('');
const selectedMemberCapid = ref('');
const memberDetail = ref<{
  member: {
    capid: string;
    firstName: string;
    lastName: string;
    memberType: string;
    status: string;
    email?: string | null;
    unitCharter?: string | null;
    expirationDate?: string | null;
  };
  contacts: Array<{
    type: string;
    priority?: string | null;
    contact: string;
    contactName?: string | null;
    doNotContact: boolean;
  }>;
  addresses: Array<{
    type: string;
    priority?: string | null;
    addr1?: string | null;
    addr2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  }>;
  duties: Array<{
    dutyName: string;
    dutyCode?: string | null;
  }>;
} | null>(null);

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

const loadMemberDetail = async (capid: string) => {
  if (!selectedTenantSlug.value) return;
  detailsLoading.value = true;
  detailsError.value = '';
  selectedMemberCapid.value = capid;
  try {
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/members/${capid}`);
    memberDetail.value = data;
    detailsOpen.value = true;
  } catch (error: any) {
    memberDetail.value = null;
    detailsError.value = error?.response?.data?.error ?? 'Unable to load member details';
    detailsOpen.value = true;
  } finally {
    detailsLoading.value = false;
  }
};

const isParentGuardianType = (typeValue: string): boolean => /parent|guardian/i.test(typeValue);

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
          <button class="text-left text-base font-semibold hover:underline" @click="loadMemberDetail(row.capid)">
            {{ row.lastName }}, {{ row.firstName }}
          </button>
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
      <div class="mt-3">
        <UiButton variant="secondary" @click="loadMemberDetail(row.capid)">View details</UiButton>
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
        <td class="px-4 py-3">
          <button class="text-left hover:underline" @click="loadMemberDetail(row.capid)">{{ row.lastName }}, {{ row.firstName }}</button>
        </td>
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

  <UiModal :open="detailsOpen" title="Member details" @close="detailsOpen = false">
    <div v-if="detailsLoading" class="text-sm text-slate-500 dark:text-slate-400">Loading details...</div>
    <div v-else-if="detailsError" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
      {{ detailsError }}
    </div>
    <div v-else-if="memberDetail" class="space-y-4 text-sm">
      <div>
        <p class="text-base font-semibold">{{ memberDetail.member.lastName }}, {{ memberDetail.member.firstName }}</p>
        <p class="text-slate-500 dark:text-slate-400">CAPID {{ memberDetail.member.capid }} • {{ memberDetail.member.memberType }} • {{ memberDetail.member.status }}</p>
      </div>

      <div>
        <p class="mb-1 font-medium">Parent/Guardian contacts</p>
        <ul class="space-y-1">
          <li v-for="contact in memberDetail.contacts.filter((c) => isParentGuardianType(c.type))" :key="`pg-${contact.type}-${contact.contact}`" class="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
            <span class="font-medium">{{ contact.type }}</span>: {{ contact.contact }}
            <span v-if="contact.contactName" class="text-slate-500"> ({{ contact.contactName }})</span>
          </li>
          <li v-if="memberDetail.contacts.filter((c) => isParentGuardianType(c.type)).length === 0" class="text-slate-500 dark:text-slate-400">No parent/guardian contact records.</li>
        </ul>
      </div>

      <div>
        <p class="mb-1 font-medium">All contacts</p>
        <ul class="space-y-1">
          <li v-for="contact in memberDetail.contacts" :key="`contact-${contact.type}-${contact.contact}`" class="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
            <span class="font-medium">{{ contact.type }}</span>
            <span v-if="contact.priority"> ({{ contact.priority }})</span>
            : {{ contact.contact }}
            <span v-if="contact.contactName" class="text-slate-500"> — {{ contact.contactName }}</span>
          </li>
          <li v-if="memberDetail.contacts.length === 0" class="text-slate-500 dark:text-slate-400">No contact records.</li>
        </ul>
      </div>

      <div>
        <p class="mb-1 font-medium">Addresses</p>
        <ul class="space-y-1">
          <li v-for="address in memberDetail.addresses" :key="`addr-${address.type}-${address.addr1}-${address.zip}`" class="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
            <span class="font-medium">{{ address.type }}</span>
            <span v-if="address.priority"> ({{ address.priority }})</span>
            <span>
              — {{ [address.addr1, address.addr2, address.city, address.state, address.zip].filter(Boolean).join(', ') || 'n/a' }}
            </span>
          </li>
          <li v-if="memberDetail.addresses.length === 0" class="text-slate-500 dark:text-slate-400">No address records.</li>
        </ul>
      </div>
    </div>
  </UiModal>
</template>
