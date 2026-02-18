<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiTable from '@/components/ui/UiTable.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

type AudienceRule = {
  id: string;
  memberType: 'CADET' | 'SENIOR' | 'UNKNOWN' | null;
  unitCharter: string | null;
};

type EventListItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: 'tenant' | 'audience';
  isCancelled: boolean;
  cancelReason: string | null;
  counts: { yes: number; no: number; maybe: number; total: number };
  myRsvp: 'yes' | 'no' | 'maybe' | null;
  audienceRules: AudienceRule[];
};

type EventDetail = EventListItem & {
  rsvps: Array<{ id: string; status: 'yes' | 'no' | 'maybe'; note: string | null; respondedAt: string; user?: { email: string } | null }>;
};

const { selectedTenantSlug } = useSession();

const query = ref('');
const status = ref<'active' | 'cancelled' | 'all'>('active');
const memberType = ref<'all' | 'CADET' | 'SENIOR' | 'UNKNOWN'>('all');
const page = ref(1);
const pageSize = ref('25');
const sortBy = ref<'startsAt' | 'title' | 'updatedAt' | 'createdAt'>('startsAt');
const sortDir = ref<'asc' | 'desc'>('asc');
const loading = ref(false);
const saving = ref(false);
const actionMessage = ref('');
const items = ref<EventListItem[]>([]);
const total = ref(0);
const selectedEventId = ref('');
const selectedEvent = ref<EventDetail | null>(null);

const formTitle = ref('');
const formDescription = ref('');
const formLocation = ref('');
const formStartsAt = ref('');
const formEndsAt = ref('');
const formVisibility = ref<'tenant' | 'audience'>('tenant');
const formAudienceMemberType = ref<'all' | 'CADET' | 'SENIOR' | 'UNKNOWN'>('all');

const selectedTotal = computed(() => selectedEvent.value?.counts.total ?? 0);

const toDatetimeLocal = (value: string): string => {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const fromDatetimeLocal = (value: string): string => new Date(value).toISOString();

const formatDateTime = (value: string): string => {
  const d = new Date(value);
  return d.toLocaleString();
};

const errorMessage = (error: unknown): string => {
  const maybe = error as { response?: { data?: { error?: string } } };
  return maybe.response?.data?.error ?? 'Request failed';
};

const resetForm = () => {
  formTitle.value = '';
  formDescription.value = '';
  formLocation.value = '';
  const now = new Date();
  const plusHour = new Date(now.getTime() + 60 * 60 * 1000);
  formStartsAt.value = toDatetimeLocal(now.toISOString());
  formEndsAt.value = toDatetimeLocal(plusHour.toISOString());
  formVisibility.value = 'tenant';
  formAudienceMemberType.value = 'all';
};

const populateFormFromEvent = (event: EventDetail) => {
  formTitle.value = event.title;
  formDescription.value = event.description ?? '';
  formLocation.value = event.location ?? '';
  formStartsAt.value = toDatetimeLocal(event.startsAt);
  formEndsAt.value = toDatetimeLocal(event.endsAt);
  formVisibility.value = event.visibility;
  const firstRuleType = event.audienceRules[0]?.memberType ?? null;
  formAudienceMemberType.value = firstRuleType ?? 'all';
};

const loadEvents = async () => {
  if (!selectedTenantSlug.value) {
    items.value = [];
    total.value = 0;
    return;
  }

  loading.value = true;
  actionMessage.value = '';
  try {
    const params: Record<string, string> = {
      page: String(page.value),
      pageSize: pageSize.value,
      status: status.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value
    };

    if (query.value.trim()) params.q = query.value.trim();
    if (memberType.value !== 'all') params.memberType = memberType.value;

    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/events`, { params });
    items.value = data.items;
    total.value = data.total;

    if (!selectedEventId.value && items.value.length > 0) {
      selectedEventId.value = items.value[0].id;
    }

    if (selectedEventId.value && !items.value.some((item) => item.id === selectedEventId.value)) {
      selectedEventId.value = items.value[0]?.id ?? '';
    }
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
};

const loadEventDetail = async () => {
  if (!selectedTenantSlug.value || !selectedEventId.value) {
    selectedEvent.value = null;
    return;
  }

  try {
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/events/${selectedEventId.value}`);
    selectedEvent.value = data;
  } catch (error) {
    actionMessage.value = errorMessage(error);
  }
};

const createEvent = async () => {
  if (!selectedTenantSlug.value) return;
  saving.value = true;
  actionMessage.value = '';
  try {
    const audienceRules =
      formVisibility.value === 'audience' && formAudienceMemberType.value !== 'all'
        ? [{ memberType: formAudienceMemberType.value }]
        : [];

    await api.post(`/tenant/${selectedTenantSlug.value}/events`, {
      title: formTitle.value,
      description: formDescription.value || undefined,
      location: formLocation.value || undefined,
      startsAt: fromDatetimeLocal(formStartsAt.value),
      endsAt: fromDatetimeLocal(formEndsAt.value),
      visibility: formVisibility.value,
      allDay: false,
      audienceRules
    });
    actionMessage.value = 'Event created.';
    await loadEvents();
    if (items.value.length > 0) {
      selectedEventId.value = items.value[0].id;
      await loadEventDetail();
    }
    resetForm();
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
};

const saveSelectedEvent = async () => {
  if (!selectedTenantSlug.value || !selectedEvent.value) return;
  saving.value = true;
  actionMessage.value = '';
  try {
    const audienceRules =
      formVisibility.value === 'audience' && formAudienceMemberType.value !== 'all'
        ? [{ memberType: formAudienceMemberType.value }]
        : [];

    await api.patch(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}`, {
      title: formTitle.value,
      description: formDescription.value || null,
      location: formLocation.value || null,
      startsAt: fromDatetimeLocal(formStartsAt.value),
      endsAt: fromDatetimeLocal(formEndsAt.value),
      visibility: formVisibility.value,
      audienceRules
    });
    actionMessage.value = 'Event updated.';
    await loadEvents();
    await loadEventDetail();
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
};

const cancelSelectedEvent = async () => {
  if (!selectedTenantSlug.value || !selectedEvent.value) return;
  saving.value = true;
  actionMessage.value = '';
  try {
    await api.delete(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}`);
    actionMessage.value = 'Event cancelled.';
    await loadEvents();
    await loadEventDetail();
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
};

const rsvp = async (statusValue: 'yes' | 'no' | 'maybe') => {
  if (!selectedTenantSlug.value || !selectedEvent.value) return;
  actionMessage.value = '';
  try {
    await api.put(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}/rsvp`, {
      status: statusValue
    });
    actionMessage.value = `RSVP saved: ${statusValue.toUpperCase()}`;
    await loadEvents();
    await loadEventDetail();
  } catch (error) {
    actionMessage.value = errorMessage(error);
  }
};

watch([selectedTenantSlug, query, status, memberType, sortBy, sortDir], () => {
  page.value = 1;
  loadEvents();
});

watch([page, pageSize], loadEvents);

watch(selectedEventId, async () => {
  await loadEventDetail();
  if (selectedEvent.value) {
    populateFormFromEvent(selectedEvent.value);
  }
});

onMounted(async () => {
  resetForm();
  await loadEvents();
  await loadEventDetail();
  if (selectedEvent.value) {
    populateFormFromEvent(selectedEvent.value);
  }
});
</script>

<template>
  <PageHeader title="Events" subtitle="Tenant event calendar, RSVPs, and attendance" />

  <div class="mb-4 grid gap-3 md:grid-cols-6">
    <UiInput v-model="query" placeholder="Search title, location, description" />
    <UiSelect v-model="status" :options="[{ label: 'Active', value: 'active' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'All', value: 'all' }]" />
    <UiSelect v-model="memberType" :options="[{ label: 'All audiences', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]" />
    <UiSelect v-model="sortBy" :options="[{ label: 'Start time', value: 'startsAt' }, { label: 'Title', value: 'title' }, { label: 'Updated', value: 'updatedAt' }, { label: 'Created', value: 'createdAt' }]" />
    <UiSelect v-model="sortDir" :options="[{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]" />
    <UiButton :disabled="loading" @click="loadEvents">{{ loading ? 'Loading...' : 'Refresh' }}</UiButton>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
    <div>
      <UiTable class="hidden md:block">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
          <tr>
            <th class="px-4 py-3">Title</th>
            <th class="px-4 py-3">Starts</th>
            <th class="px-4 py-3">Location</th>
            <th class="px-4 py-3">RSVP</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="cursor-pointer border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
            :class="selectedEventId === item.id ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''"
            @click="selectedEventId = item.id"
          >
            <td class="px-4 py-3">
              <p class="font-medium">{{ item.title }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.isCancelled ? 'Cancelled' : 'Active' }} · {{ item.visibility }}</p>
            </td>
            <td class="px-4 py-3">{{ formatDateTime(item.startsAt) }}</td>
            <td class="px-4 py-3">{{ item.location ?? '—' }}</td>
            <td class="px-4 py-3">Y {{ item.counts.yes }} / M {{ item.counts.maybe }} / N {{ item.counts.no }}</td>
          </tr>
          <tr v-if="items.length === 0" class="border-t border-slate-200 dark:border-slate-800">
            <td colspan="4" class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No events found.</td>
          </tr>
        </tbody>
      </UiTable>

      <div class="grid gap-3 md:hidden">
        <button
          v-for="item in items"
          :key="`mobile-${item.id}`"
          class="card text-left"
          :class="selectedEventId === item.id ? 'ring-2 ring-indigo-400' : ''"
          @click="selectedEventId = item.id"
        >
          <p class="font-semibold">{{ item.title }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatDateTime(item.startsAt) }}</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ item.location ?? 'No location' }}</p>
          <p class="mt-2 text-xs">Y {{ item.counts.yes }} / M {{ item.counts.maybe }} / N {{ item.counts.no }}</p>
        </button>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p class="text-slate-500 dark:text-slate-400">Showing {{ items.length }} of {{ total }} events</p>
        <div class="flex items-center gap-2">
          <UiSelect v-model="pageSize" :options="[{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]" />
          <UiButton variant="secondary" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">Previous</UiButton>
          <span>Page {{ page }}</span>
          <UiButton variant="secondary" :disabled="page * Number(pageSize) >= total" @click="page = page + 1">Next</UiButton>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <section class="card">
        <h3 class="text-lg font-semibold">My RSVP</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400" v-if="selectedEvent">Current: {{ selectedEvent.myRsvp ?? 'No response yet' }}</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400" v-else>Select an event.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <UiButton :disabled="!selectedEvent || selectedEvent.isCancelled" @click="rsvp('yes')">Yes</UiButton>
          <UiButton variant="secondary" :disabled="!selectedEvent || selectedEvent.isCancelled" @click="rsvp('maybe')">Maybe</UiButton>
          <UiButton variant="danger" :disabled="!selectedEvent || selectedEvent.isCancelled" @click="rsvp('no')">No</UiButton>
        </div>
        <div v-if="selectedEvent" class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Yes {{ selectedEvent.counts.yes }}</div>
          <div class="rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Maybe {{ selectedEvent.counts.maybe }}</div>
          <div class="rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">No {{ selectedEvent.counts.no }}</div>
        </div>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400" v-if="selectedEvent">Total responses: {{ selectedTotal }}</p>
      </section>

      <section class="card">
        <h3 class="text-lg font-semibold">Event form</h3>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Create new events, or edit the selected event.</p>
        <form class="mt-3 grid gap-2" @submit.prevent="createEvent">
          <UiInput v-model="formTitle" placeholder="Event title" />
          <UiInput v-model="formDescription" placeholder="Description" />
          <UiInput v-model="formLocation" placeholder="Location" />
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Starts</label>
          <UiInput v-model="formStartsAt" type="datetime-local" />
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ends</label>
          <UiInput v-model="formEndsAt" type="datetime-local" />
          <UiSelect v-model="formVisibility" :options="[{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]" />
          <UiSelect
            v-if="formVisibility === 'audience'"
            v-model="formAudienceMemberType"
            :options="[{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]"
          />

          <div class="mt-2 flex flex-wrap gap-2">
            <UiButton type="submit" :disabled="saving || !formTitle || !formStartsAt || !formEndsAt">{{ saving ? 'Saving...' : 'Create event' }}</UiButton>
            <UiButton variant="secondary" type="button" :disabled="saving || !selectedEvent" @click="saveSelectedEvent">Update selected</UiButton>
            <UiButton variant="danger" type="button" :disabled="saving || !selectedEvent || selectedEvent.isCancelled" @click="cancelSelectedEvent">Cancel selected</UiButton>
          </div>
        </form>
      </section>

      <section class="card" v-if="selectedEvent">
        <h3 class="text-lg font-semibold">Selected event details</h3>
        <p class="mt-2 text-sm"><span class="font-medium">Title:</span> {{ selectedEvent.title }}</p>
        <p class="text-sm"><span class="font-medium">Starts:</span> {{ formatDateTime(selectedEvent.startsAt) }}</p>
        <p class="text-sm"><span class="font-medium">Ends:</span> {{ formatDateTime(selectedEvent.endsAt) }}</p>
        <p class="text-sm"><span class="font-medium">Location:</span> {{ selectedEvent.location ?? '—' }}</p>
        <p class="text-sm"><span class="font-medium">Audience:</span> {{ selectedEvent.visibility }}</p>
      </section>

      <p v-if="actionMessage" class="text-sm text-slate-500 dark:text-slate-400">{{ actionMessage }}</p>
    </div>
  </div>
</template>
