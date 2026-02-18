<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
import { formatRankDisplay } from '@/utils/rank-display';

type PromotionNeedsRow = {
  id: string;
  capid: string;
  memberName: string | null;
  rank: string | null;
  achievementName: string | null;
  ready: boolean;
  inactive: boolean;
  needs?: string[];
};

const { selectedTenantSlug } = useSession();

const reportType = ref('next-promotion-needs');
const query = ref('');
const includeReady = ref('false');
const page = ref(1);
const pageSize = ref('100');
const total = ref(0);
const items = ref<PromotionNeedsRow[]>([]);
const sortBy = ref<'memberName' | 'rank' | 'capid' | 'achievementName'>('memberName');
const sortDir = ref<'asc' | 'desc'>('asc');

const loadReport = async () => {
  if (!selectedTenantSlug.value) return;

  const params: Record<string, string> = {
    page: String(page.value),
    pageSize: pageSize.value,
    inactive: 'false',
    sortBy: sortBy.value,
    sortDir: sortDir.value
  };

  if (query.value.trim()) params.search = query.value.trim();
  if (includeReady.value === 'false') params.ready = 'false';

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/cadet-promotions`, { params });
  items.value = data.items;
  total.value = data.total;
};

const toggleSort = (column: 'memberName' | 'rank' | 'capid' | 'achievementName') => {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = column;
    sortDir.value = 'asc';
  }
  page.value = 1;
  loadReport();
};

const sortLabel = (column: 'memberName' | 'rank' | 'capid' | 'achievementName') => {
  if (sortBy.value !== column) return '';
  return sortDir.value === 'asc' ? ' ▲' : ' ▼';
};

const needsFor = (row: PromotionNeedsRow): string[] => row.needs ?? [];

const readyCount = computed(() => items.value.filter((row) => row.ready).length);

watch([selectedTenantSlug, query, includeReady, reportType], () => {
  page.value = 1;
  loadReport();
});
watch([page, pageSize], loadReport);
onMounted(loadReport);
</script>

<template>
  <PageHeader title="Reports" subtitle="Operational reporting for cadets and staff" />

  <div class="mb-4 grid gap-3 md:grid-cols-4">
    <UiSelect v-model="reportType" :options="[{ label: 'Cadet next promotion needs', value: 'next-promotion-needs' }]" />
    <UiInput v-model="query" placeholder="Search name, CAPID, rank, achievement" />
    <UiSelect v-model="includeReady" :options="[{ label: 'Show not-ready only', value: 'false' }, { label: 'Show all active cadets', value: 'true' } ]" />
    <UiButton @click="loadReport">Refresh</UiButton>
  </div>

  <div class="mb-4 grid gap-3 sm:grid-cols-3">
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cadets in report</p>
      <p class="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ total }}</p>
    </div>
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ready in current page</p>
      <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ readyCount }}</p>
    </div>
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Not ready in current page</p>
      <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ Math.max(0, items.length - readyCount) }}</p>
    </div>
  </div>

  <div class="grid gap-3 md:hidden">
    <div v-for="row in items" :key="row.id" class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-base font-semibold">{{ row.memberName ?? 'Unknown cadet' }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatRankDisplay(row.rank) }} • CAPID {{ row.capid }}</p>
        </div>
        <span class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
          {{ row.ready ? 'Ready' : 'Needs items' }}
        </span>
      </div>
      <div class="mt-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">Next Achievement</p>
        <p class="text-sm">{{ row.achievementName ?? '—' }}</p>
      </div>
      <div class="mt-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">Needs</p>
        <ul class="mt-1 list-disc pl-5 text-sm">
          <li v-if="needsFor(row).length === 0">No blockers found</li>
          <li v-for="need in needsFor(row)" :key="`${row.id}-${need}`">{{ need }}</li>
        </ul>
      </div>
    </div>
  </div>

  <UiTable class="hidden md:block">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
      <tr>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('memberName')">Name{{ sortLabel('memberName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('rank')">Rank{{ sortLabel('rank') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('capid')">CAPID{{ sortLabel('capid') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('achievementName')">Next Achievement{{ sortLabel('achievementName') }}</button></th>
        <th class="px-4 py-3">Needs for Next Promotion</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in items" :key="row.id" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3">{{ row.memberName ?? 'Unknown cadet' }}</td>
        <td class="px-4 py-3">{{ formatRankDisplay(row.rank) }}</td>
        <td class="px-4 py-3 font-medium">{{ row.capid }}</td>
        <td class="px-4 py-3">{{ row.achievementName ?? '—' }}</td>
        <td class="px-4 py-3">
          <ul class="list-disc pl-5 text-sm">
            <li v-if="needsFor(row).length === 0">No blockers found</li>
            <li v-for="need in needsFor(row)" :key="`${row.id}-${need}`">{{ need }}</li>
          </ul>
        </td>
      </tr>
    </tbody>
  </UiTable>

  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} cadets</p>
    <div class="flex items-center gap-2">
      <UiSelect v-model="pageSize" :options="[{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' } ]" />
      <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
      <span class="px-2">Page {{ page }}</span>
      <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
    </div>
  </div>
</template>
