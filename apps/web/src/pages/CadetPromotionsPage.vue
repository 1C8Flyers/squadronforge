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
import { formatRankDisplay } from '@/utils/rank-display';

type CadetPromotion = {
  id: string;
  capid: string;
  memberName: string | null;
  rank: string | null;
  achievementName: string | null;
  datePromotionEligible: string | null;
  lastPtDate: string | null;
  inactive: boolean;
  ready: boolean;
  readyStatus: string | null;
  leadershipTestCompleted: boolean;
  leadershipModuleCompleted: boolean;
  aeTestCompleted: boolean | null;
  aeModuleCompleted: boolean | null;
  chiefSpeechEssayCompleted: boolean;
  sdaCompleted: boolean;
  ptStatus: string | null;
  leadStatus: string | null;
  aeStatus: string | null;
  drillStatus: string | null;
  cdStatus: string | null;
  sdaStatus: string | null;
  comments: string | null;
  missingKeys?: string[];
  needs?: string[];
  explain?: string[];
};

const { selectedTenantSlug } = useSession();
const query = ref('');
const ready = ref('all');
const inactive = ref('all');
const items = ref<CadetPromotion[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref('50');
const readyCount = ref(0);
const inactiveCount = ref(0);
const sortBy = ref<'memberName' | 'rank' | 'capid' | 'achievementName' | 'datePromotionEligible' | 'lastPtDate' | 'ready' | 'inactive'>('memberName');
const sortDir = ref<'asc' | 'desc'>('asc');
const expandedNeedId = ref<string | null>(null);

const loadCadetPromotions = async () => {
  if (!selectedTenantSlug.value) return;
  const params: Record<string, string> = {
    page: String(page.value),
    pageSize: pageSize.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value
  };

  if (query.value.trim()) params.search = query.value.trim();
  if (ready.value !== 'all') params.ready = ready.value;
  if (inactive.value !== 'all') params.inactive = inactive.value;

  const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/cadet-promotions`, { params });
  items.value = data.items;
  total.value = data.total;
  readyCount.value = data.summary?.readyCount ?? 0;
  inactiveCount.value = data.summary?.inactiveCount ?? 0;
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

const rowStatusText = (row: CadetPromotion): string => {
  if (row.inactive) return 'Inactive';
  if (row.ready) return 'Ready';
  return 'Pending';
};

const rowStatusTone = (row: CadetPromotion): 'neutral' | 'success' | 'warn' => {
  if (row.inactive) return 'warn';
  if (row.ready) return 'success';
  return 'neutral';
};

const readyDisplay = (row: CadetPromotion): string => {
  const raw = row.readyStatus?.trim();
  if (raw && raw.length > 0) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
    }
    return raw;
  }
  return row.ready ? 'Yes' : 'No';
};

const readyTone = (row: CadetPromotion): 'neutral' | 'success' => {
  const value = readyDisplay(row).toLowerCase();
  if (value === 'yes') return 'success';
  if (value === 'no') return 'neutral';
  return 'success';
};

const normalizeStatus = (value: string | null | undefined): string => (value ?? '').trim();

const statusDone = (value: string | null | undefined): boolean => {
  const v = normalizeStatus(value).toUpperCase();
  return v.length > 0 && v !== 'WC';
};

const isSdaRequired = (row: CadetPromotion): boolean => normalizeStatus(row.sdaStatus).toUpperCase() !== 'N/A';

const checkProgress = (row: CadetPromotion): { done: number; total: number } => {
  const required = [row.ptStatus, row.leadStatus, row.aeStatus, row.drillStatus, row.cdStatus];
  if (isSdaRequired(row)) {
    required.push(row.sdaStatus);
  }

  const done = required.filter((status) => statusDone(status)).length;
  return { done, total: required.length };
};

const needsList = (row: CadetPromotion): string[] => row.needs ?? [];

const completedList = (row: CadetPromotion): string[] => {
  const completed: string[] = [];

  if (statusDone(row.ptStatus)) {
    completed.push('PT complete');
  }

  const lead = normalizeStatus(row.leadStatus).toUpperCase();
  if (lead === '★') {
    completed.push('Leadership complete');
  } else if (lead === 'X') {
    if (row.leadershipTestCompleted) completed.push('Leadership test complete');
    if (row.leadershipModuleCompleted) completed.push('Leadership interactive module complete');
  }

  const ae = normalizeStatus(row.aeStatus).toUpperCase();
  if (ae === '★') {
    completed.push('Aerospace complete');
  } else if (ae === 'X') {
    if (row.aeTestCompleted === true) completed.push('Aerospace AE test complete');
    if (row.aeModuleCompleted === true) completed.push('Aerospace interactive module complete');
  }

  if (statusDone(row.drillStatus)) {
    completed.push('Drill complete');
  }

  const cd = normalizeStatus(row.cdStatus).toUpperCase();
  if (cd && cd !== 'WC') {
    completed.push('Character Development complete');
  }

  if (!isSdaRequired(row)) {
    completed.push('SDA not required');
  } else if (statusDone(row.sdaStatus)) {
    completed.push('SDA complete');
  }

  return completed;
};

const toggleNeeds = (id: string) => {
  expandedNeedId.value = expandedNeedId.value === id ? null : id;
};

const pendingCount = computed(() => Math.max(0, total.value - readyCount.value - inactiveCount.value));

watch([selectedTenantSlug, query, ready, inactive], () => {
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
    <div v-for="row in items" :key="row.id" class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-base font-semibold">{{ row.memberName ?? 'Unknown cadet' }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatRankDisplay(row.rank) }} • CAPID {{ row.capid }}</p>
        </div>
        <UiBadge :tone="rowStatusTone(row)">{{ rowStatusText(row) }}</UiBadge>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Achievement</p>
          <p>{{ row.achievementName ?? '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Eligible</p>
          <p>{{ formatDate(row.datePromotionEligible) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Last PT</p>
          <p>{{ formatDate(row.lastPtDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Comments</p>
          <p>{{ row.comments ?? '—' }}</p>
        </div>
        <div class="col-span-2">
          <p class="text-xs text-slate-500 dark:text-slate-400">What I need</p>
          <ul class="mt-1 list-disc pl-5 text-xs">
            <li v-if="needsList(row).length === 0">No blockers found</li>
            <li v-for="need in needsList(row)" :key="`${row.id}-${need}`">{{ need }}</li>
          </ul>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Explain</p>
          <ul class="mt-1 list-disc pl-5 text-xs text-slate-500 dark:text-slate-400">
            <li v-if="(row.explain ?? []).length === 0">No explanation available</li>
            <li v-for="note in row.explain ?? []" :key="`${row.id}-explain-${note}`">{{ note }}</li>
          </ul>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Already complete</p>
          <ul class="mt-1 list-disc pl-5 text-xs text-emerald-700 dark:text-emerald-300">
            <li v-if="completedList(row).length === 0">No completed items yet</li>
            <li v-for="done in completedList(row)" :key="`${row.id}-done-${done}`">{{ done }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <UiTable class="hidden md:block">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
      <tr>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('memberName')">Name{{ sortLabel('memberName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('rank')">Rank{{ sortLabel('rank') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('capid')">CAPID{{ sortLabel('capid') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('achievementName')">Achievement{{ sortLabel('achievementName') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('datePromotionEligible')">Eligible{{ sortLabel('datePromotionEligible') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('lastPtDate')">Last PT{{ sortLabel('lastPtDate') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('ready')">Ready{{ sortLabel('ready') }}</button></th>
        <th class="px-4 py-3"><button class="hover:underline" @click="toggleSort('inactive')">Inactive{{ sortLabel('inactive') }}</button></th>
        <th class="px-4 py-3">Checks</th>
        <th class="px-4 py-3">What I Need</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="row in items" :key="row.id">
        <tr class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td class="px-4 py-3">{{ row.memberName ?? 'Unknown cadet' }}</td>
        <td class="px-4 py-3">{{ formatRankDisplay(row.rank) }}</td>
        <td class="px-4 py-3 font-medium">{{ row.capid }}</td>
        <td class="px-4 py-3">{{ row.achievementName ?? '—' }}</td>
        <td class="px-4 py-3">{{ formatDate(row.datePromotionEligible) }}</td>
        <td class="px-4 py-3">{{ formatDate(row.lastPtDate) }}</td>
        <td class="px-4 py-3"><UiBadge :tone="readyTone(row)">{{ readyDisplay(row) }}</UiBadge></td>
        <td class="px-4 py-3"><UiBadge :tone="row.inactive ? 'warn' : 'neutral'">{{ row.inactive ? 'Yes' : 'No' }}</UiBadge></td>
        <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          <span class="font-semibold">{{ checkProgress(row).done }}/{{ checkProgress(row).total }}</span>
          complete
        </td>
        <td class="px-4 py-3">
          <UiButton variant="secondary" class="px-3 py-1 text-xs" @click="toggleNeeds(row.id)">
            {{ expandedNeedId === row.id ? 'Hide' : 'What I need' }}
          </UiButton>
        </td>
        </tr>
        <tr v-if="expandedNeedId === row.id" class="bg-slate-50/70 dark:bg-slate-900/60">
          <td colspan="10" class="px-4 py-3">
            <div class="card p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">What I need</p>
              <ul class="mt-2 list-disc pl-5 text-sm">
                <li v-if="needsList(row).length === 0">No blockers found</li>
                <li v-for="need in needsList(row)" :key="`${row.id}-${need}`">{{ need }}</li>
              </ul>
              <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Explain</p>
              <ul class="mt-2 list-disc pl-5 text-sm text-slate-500 dark:text-slate-400">
                <li v-if="(row.explain ?? []).length === 0">No explanation available</li>
                <li v-for="note in row.explain ?? []" :key="`${row.id}-explain-${note}`">{{ note }}</li>
              </ul>
              <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Completed</p>
              <ul class="mt-2 list-disc pl-5 text-sm text-emerald-700 dark:text-emerald-300">
                <li v-if="completedList(row).length === 0">No completed items yet</li>
                <li v-for="done in completedList(row)" :key="`${row.id}-done-${done}`">{{ done }}</li>
              </ul>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </UiTable>

  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} cadets</p>
    <div class="flex items-center gap-2">
      <UiSelect v-model="pageSize" :options="[{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]" />
      <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
      <span class="px-2">Page {{ page }}</span>
      <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
    </div>
  </div>
</template>
