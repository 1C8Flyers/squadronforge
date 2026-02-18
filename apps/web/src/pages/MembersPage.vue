<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiModal from '@/components/ui/UiModal.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
import { formatRankDisplay } from '@/utils/rank-display';

const query = ref('');
const status = ref('all');
const type = ref('all');
const { selectedTenantSlug } = useSession();

const members = ref<Array<{ capid: string; firstName: string; lastName: string; grade?: string | null; memberType: string; status: string; unitCharter?: string }>>([]);
const page = ref(1);
const pageSize = ref('25');
const total = ref(0);
const sortBy = ref<'capid' | 'grade' | 'lastName' | 'memberType' | 'status' | 'unitCharter'>('lastName');
const sortDir = ref<'asc' | 'desc'>('asc');
const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref('');
const selectedMemberCapid = ref('');
const memberDetail = ref<{
  member: {
    capid: string;
    firstName: string;
    lastName: string;
    grade?: string | null;
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
  params.sortBy = sortBy.value;
  params.sortDir = sortDir.value;
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

const parentGuardianContacts = computed(() => memberDetail.value?.contacts.filter((c) => isParentGuardianType(c.type)) ?? []);
const nonParentContacts = computed(() => memberDetail.value?.contacts.filter((c) => !isParentGuardianType(c.type)) ?? []);

const formatAddress = (address: {
  addr1?: string | null;
  addr2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) => [address.addr1, address.addr2, address.city, address.state, address.zip].filter(Boolean).join(', ') || 'n/a';

const toggleSort = (column: 'capid' | 'grade' | 'lastName' | 'memberType' | 'status' | 'unitCharter') => {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = column;
    sortDir.value = 'asc';
  }
  page.value = 1;
  loadMembers();
};

const sortLabel = (column: 'capid' | 'grade' | 'lastName' | 'memberType' | 'status' | 'unitCharter'): string => {
  if (sortBy.value !== column) return '';
  return sortDir.value === 'asc' ? ' ▲' : ' ▼';
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
          <button class="text-left text-base font-semibold hover:underline" @click="loadMemberDetail(row.capid)">
            {{ row.lastName }}, {{ row.firstName }}
          </button>
          <p class="text-xs text-slate-500 dark:text-slate-400">CAPID {{ row.capid }}</p>
        </div>
        <UiBadge :tone="row.status === 'ACTIVE' ? 'success' : 'warn'">{{ row.status }}</UiBadge>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Rank</p>
          <p>{{ formatRankDisplay(row.grade) }}</p>
        </div>
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
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('capid')">CAPID{{ sortLabel('capid') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('grade')">Rank{{ sortLabel('grade') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('lastName')">Name{{ sortLabel('lastName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('memberType')">Type{{ sortLabel('memberType') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('status')">Status{{ sortLabel('status') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('unitCharter')">Unit{{ sortLabel('unitCharter') }}</button></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in members" :key="row.capid" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3 font-medium">{{ row.capid }}</td>
        <td class="px-4 py-3">{{ formatRankDisplay(row.grade) }}</td>
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
      <section class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold">{{ memberDetail.member.grade ? `${formatRankDisplay(memberDetail.member.grade)} ` : '' }}{{ memberDetail.member.lastName }}, {{ memberDetail.member.firstName }}</p>
            <p class="text-slate-500 dark:text-slate-400">CAPID {{ memberDetail.member.capid }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UiBadge :tone="memberDetail.member.status === 'ACTIVE' ? 'success' : 'warn'">{{ memberDetail.member.status }}</UiBadge>
            <span class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{{ memberDetail.member.memberType }}</span>
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="mb-2 text-sm font-semibold">Parent / Guardian</p>
          <ul class="space-y-2">
            <li v-for="contact in parentGuardianContacts" :key="`pg-${contact.type}-${contact.contact}`" class="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ contact.type }}</p>
              <p class="font-medium">{{ contact.contact }}</p>
              <p v-if="contact.contactName" class="text-xs text-slate-500 dark:text-slate-400">{{ contact.contactName }}</p>
            </li>
            <li v-if="parentGuardianContacts.length === 0" class="text-slate-500 dark:text-slate-400">No parent/guardian contact records.</li>
          </ul>
        </div>

        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="mb-2 text-sm font-semibold">Addresses</p>
          <ul class="space-y-2">
            <li v-for="address in memberDetail.addresses" :key="`addr-${address.type}-${address.addr1}-${address.zip}`" class="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ address.type }}<span v-if="address.priority"> • {{ address.priority }}</span></p>
              <p>{{ formatAddress(address) }}</p>
            </li>
            <li v-if="memberDetail.addresses.length === 0" class="text-slate-500 dark:text-slate-400">No address records.</li>
          </ul>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-2 text-sm font-semibold">Other contacts</p>
        <ul class="space-y-2">
          <li v-for="contact in nonParentContacts" :key="`contact-${contact.type}-${contact.contact}`" class="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ contact.type }}<span v-if="contact.priority"> • {{ contact.priority }}</span></p>
            <p>{{ contact.contact }}</p>
            <p v-if="contact.contactName" class="text-xs text-slate-500 dark:text-slate-400">{{ contact.contactName }}</p>
          </li>
          <li v-if="nonParentContacts.length === 0" class="text-slate-500 dark:text-slate-400">No additional contact records.</li>
        </ul>
      </section>

      <section class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-2 text-sm font-semibold">Duty assignments</p>
        <ul class="space-y-1">
          <li v-for="duty in memberDetail.duties" :key="`duty-${duty.dutyName}-${duty.dutyCode ?? ''}`" class="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
            <span>{{ duty.dutyName }}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ duty.dutyCode ?? '—' }}</span>
          </li>
          <li v-if="memberDetail.duties.length === 0" class="text-slate-500 dark:text-slate-400">No duty assignments.</li>
        </ul>
      </section>
    </div>
  </UiModal>
</template>
