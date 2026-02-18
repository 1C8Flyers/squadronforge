<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
import { computePromotion, type CadetPromotionItem } from '@/lib/promotionLogic';

type CadetPromotion = CadetPromotionItem;
type ReadyFilter = 'all' | 'true' | 'false';
type InactiveFilter = 'all' | 'true' | 'false';

const { selectedTenantSlug } = useSession();
const query = ref('');
const ready = ref<ReadyFilter>('all');
const inactive = ref<InactiveFilter>('all');
const items = ref<CadetPromotion[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref('50');
const sortBy = ref<'memberName' | 'rank' | 'capid' | 'achievementName' | 'datePromotionEligible' | 'lastPtDate' | 'ready' | 'inactive'>('memberName');
const sortDir = ref<'asc' | 'desc'>('asc');

const loadCadetPromotions = async () => {
  if (!selectedTenantSlug.value) return;
  const params: Record<string, string> = {
    page: String(page.value),
    pageSize: pageSize.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value
  };

  if (query.value.trim()) params.search = query.value.trim();
  if (inactive.value !== 'all') params.inactive = inactive.value;

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/cadet-promotions`, { params });
  items.value = data.items;
  total.value = data.total;
};

const toggleSort = (column: 'memberName' | 'rank' | 'capid' | 'achievementName' | 'datePromotionEligible' | 'lastPtDate' | 'ready' | 'inactive') => {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = column;
    sortDir.value = 'asc';
  }
  page.value = 1;
  loadCadetPromotions();
};

const sortLabel = (column: 'memberName' | 'rank' | 'capid' | 'achievementName' | 'datePromotionEligible' | 'lastPtDate' | 'ready' | 'inactive') => {
  if (sortBy.value !== column) return '';
  return sortDir.value === 'asc' ? ' ▲' : ' ▼';
};

const formatDate = (value: string | null): string => (value ? new Date(value).toLocaleDateString() : '—');

const normalizeStatus = (value: string | null | undefined): string => {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : '—';
};

const computedRows = computed(() =>
  items.value.map((row) => {
    const computed = computePromotion(row);
    return {
      row,
      computed
    };
  })
);

const visibleRows = computed(() => {
  const search = query.value.trim().toLowerCase();
  return computedRows.value.filter(({ row, computed }) => {
    const matchesSearch =
      !search ||
      (row.memberName ?? '').toLowerCase().includes(search) ||
      row.capid.toLowerCase().includes(search) ||
      (row.rank ?? '').toLowerCase().includes(search) ||
      (row.achievementName ?? '').toLowerCase().includes(search);

    const matchesReady = ready.value === 'all' || String(computed.readyComputed) === ready.value;
    const matchesInactive = inactive.value === 'all' || String(row.inactive) === inactive.value;
    return matchesSearch && matchesReady && matchesInactive;
  });
});

const readyCount = computed(() => visibleRows.value.filter(({ computed }) => computed.readyComputed).length);
const inactiveCount = computed(() => visibleRows.value.filter(({ row }) => row.inactive).length);
const pendingCount = computed(() => Math.max(0, visibleRows.value.length - readyCount.value - inactiveCount.value));

const rowStatusText = (row: CadetPromotion): string => {
  if (row.inactive) return 'Inactive';
  if (computePromotion(row).readyComputed) return 'Ready';
  return 'Pending';
};

const rowStatusTone = (row: CadetPromotion): 'neutral' | 'success' | 'warn' => {
  if (row.inactive) return 'warn';
  if (computePromotion(row).readyComputed) return 'success';
  return 'neutral';
};

const readyDisplay = (row: CadetPromotion): string => {
  return computePromotion(row).readyComputed ? 'Yes' : 'No';
};

const readyTone = (row: CadetPromotion): 'neutral' | 'success' | 'warn' => {
  if (row.inactive) return 'neutral';
  return computePromotion(row).readyComputed ? 'success' : 'warn';
};

watch([selectedTenantSlug], () => {
  page.value = 1;
  loadCadetPromotions();
});
watch([page, pageSize], loadCadetPromotions);
onMounted(loadCadetPromotions);
</script>

<template>
  <PageHeader title="Cadet Promotions" subtitle="Track achievement readiness and promotion blockers" />

  <div class="mb-4 grid gap-3 md:grid-cols-4">
    <UiInput v-model="query" placeholder="Search name, CAPID, rank, achievement" />
    <UiSelect
      v-model="ready"
      :options="[
        { label: 'Ready + Not Ready', value: 'all' },
        { label: 'Ready only', value: 'true' },
        { label: 'Not ready only', value: 'false' }
      ]"
    />
    <UiSelect
      v-model="inactive"
      :options="[
        { label: 'Active + Inactive', value: 'all' },
        { label: 'Active only', value: 'false' },
        { label: 'Inactive only', value: 'true' }
      ]"
    />
    <UiButton @click="loadCadetPromotions">Refresh</UiButton>
  </div>

  <div class="mb-4 grid gap-3 sm:grid-cols-3">
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ready</p>
      <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ readyCount }}</p>
    </div>
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending</p>
      <p class="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ pendingCount }}</p>
    </div>
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inactive</p>
      <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ inactiveCount }}</p>
    </div>
  </div>

  <div class="grid gap-3 md:hidden">
    <div v-for="entry in visibleRows" :key="entry.row.id" class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-base font-semibold">{{ entry.row.memberName ?? 'Unknown cadet' }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ entry.row.rank ?? '—' }} • CAPID {{ entry.row.capid }}</p>
        </div>
        <UiBadge :tone="rowStatusTone(entry.row)">{{ rowStatusText(entry.row) }}</UiBadge>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Achievement</p>
          <p>{{ entry.row.achievementName ?? '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Eligible</p>
          <p>{{ formatDate(entry.row.datePromotionEligible) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Last PT</p>
          <p>{{ formatDate(entry.row.lastPtDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Needs</p>
          <ul class="list-disc pl-4 text-xs">
            <li v-if="entry.computed.missingDetails.length === 0">None</li>
            <li v-for="need in entry.computed.missingDetails" :key="need">{{ need }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <UiTable class="table-shell hidden md:block">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
      <tr>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('memberName')">Member{{ sortLabel('memberName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('capid')">CAPID{{ sortLabel('capid') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('rank')">Rank{{ sortLabel('rank') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('achievementName')">Achievement{{ sortLabel('achievementName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('datePromotionEligible')">Eligible{{ sortLabel('datePromotionEligible') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('lastPtDate')">Last PT{{ sortLabel('lastPtDate') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('ready')">Ready{{ sortLabel('ready') }}</button></th>
        <th class="px-4 py-3">Needs</th>
        <th class="px-4 py-3">PT</th>
        <th class="px-4 py-3">Lead</th>
        <th class="px-4 py-3">AE</th>
        <th class="px-4 py-3">Drill</th>
        <th class="px-4 py-3">CD</th>
        <th class="px-4 py-3">SDA</th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('inactive')">Inactive{{ sortLabel('inactive') }}</button></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in visibleRows" :key="entry.row.id" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3">{{ entry.row.memberName ?? 'Unknown cadet' }}</td>
        <td class="px-4 py-3 font-medium">{{ entry.row.capid }}</td>
        <td class="px-4 py-3">{{ entry.row.rank ?? '—' }}</td>
        <td class="px-4 py-3">{{ entry.row.achievementName ?? '—' }}</td>
        <td class="px-4 py-3">{{ formatDate(entry.row.datePromotionEligible) }}</td>
        <td class="px-4 py-3">{{ formatDate(entry.row.lastPtDate) }}</td>
        <td class="px-4 py-3"><UiBadge :tone="readyTone(entry.row)">{{ readyDisplay(entry.row) }}</UiBadge></td>
        <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          <ul class="list-disc pl-4">
            <li v-if="entry.computed.missingDetails.length === 0">None</li>
            <li v-for="need in entry.computed.missingDetails" :key="`${entry.row.id}-${need}`">{{ need }}</li>
          </ul>
        </td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.ptStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.ptStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.leadStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.leadStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.aeStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.aeStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.drillStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.drillStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.cdStatus) === 'WC' ? 'warn' : normalizeStatus(entry.row.cdStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.cdStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="normalizeStatus(entry.row.sdaStatus) === '—' ? 'warn' : 'neutral'">{{ normalizeStatus(entry.row.sdaStatus) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="entry.row.inactive ? 'warn' : 'neutral'">{{ entry.row.inactive ? 'Yes' : 'No' }}</UiBadge></td>
      </tr>
    </tbody>
  </UiTable>

  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">Showing {{ visibleRows.length }} of {{ items.length }} on this page ({{ total }} total)</p>
    <div class="flex items-center gap-2">
      <UiSelect v-model="pageSize" :options="[{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]" />
      <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
      <span class="px-2">Page {{ page }}</span>
      <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
    </div>
  </div>
</template>
