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

type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
type UniformOfDay = 'PT' | 'ABU_OCP' | 'BLUES';

type EventListItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  uniformOfDay: UniformOfDay | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: 'tenant' | 'audience';
  isCancelled: boolean;
  cancelReason: string | null;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceUntil?: string | null;
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
const notifying = ref(false);
const actionMessage = ref('');
const items = ref<EventListItem[]>([]);
const total = ref(0);
const selectedEventId = ref('');
const selectedEvent = ref<EventDetail | null>(null);
const showNewEventForm = ref(false);
const showEditForm = ref(false);
const notifyType = ref<'publish' | 'update' | 'reminder'>('reminder');
const notifyScheduledAt = ref('');
const notifyEmail = ref(true);
const notifyPush = ref(true);

const newTitle = ref('');
const newDescription = ref('');
const newLocation = ref('');
const newUniformOfDay = ref<UniformOfDay | ''>('');
const newStartsAt = ref('');
const newEndsAt = ref('');
const newVisibility = ref<'tenant' | 'audience'>('tenant');
const newAudienceMemberType = ref<'all' | 'CADET' | 'SENIOR' | 'UNKNOWN'>('all');
const newRecurrenceFrequency = ref<RecurrenceFrequency>('none');
const newRecurrenceInterval = ref('1');
const newRecurrenceOccurrences = ref('10');
const newRecurrenceUntil = ref('');

const editTitle = ref('');
const editDescription = ref('');
const editLocation = ref('');
const editUniformOfDay = ref<UniformOfDay | ''>('');
const editStartsAt = ref('');
const editEndsAt = ref('');
const editVisibility = ref<'tenant' | 'audience'>('tenant');
const editAudienceMemberType = ref<'all' | 'CADET' | 'SENIOR' | 'UNKNOWN'>('all');
const editRecurrenceFrequency = ref<RecurrenceFrequency>('none');
const editRecurrenceInterval = ref('1');
const editRecurrenceUntil = ref('');

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

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

const formatUniformOfDay = (value: UniformOfDay | null | undefined): string => {
  if (!value) return 'Not set';
  if (value === 'ABU_OCP') return 'ABU/OCP';
  return value;
};

const formatRecurrence = (event: EventDetail): string => {
  const frequency = event.recurrenceFrequency ?? 'none';
  if (frequency === 'none') return 'Does not repeat';
  const interval = event.recurrenceInterval ?? 1;
  const base = `Repeats every ${interval} ${frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}${interval > 1 ? 's' : ''}`;
  if (!event.recurrenceUntil) return base;
  return `${base} until ${new Date(event.recurrenceUntil).toLocaleDateString()}`;
};

const errorMessage = (error: unknown): string => {
  const maybe = error as { response?: { data?: { error?: string } } };
  return maybe.response?.data?.error ?? 'Request failed';
};

const resetNewForm = () => {
  newTitle.value = '';
  newDescription.value = '';
  newLocation.value = '';
  newUniformOfDay.value = '';
  const now = new Date();
  const plusHour = new Date(now.getTime() + 60 * 60 * 1000);
  newStartsAt.value = toDatetimeLocal(now.toISOString());
  newEndsAt.value = toDatetimeLocal(plusHour.toISOString());
  newVisibility.value = 'tenant';
  newAudienceMemberType.value = 'all';
  newRecurrenceFrequency.value = 'none';
  newRecurrenceInterval.value = '1';
  newRecurrenceOccurrences.value = '10';
  newRecurrenceUntil.value = '';
};

const populateEditFormFromEvent = (event: EventDetail) => {
  editTitle.value = event.title;
  editDescription.value = event.description ?? '';
  editLocation.value = event.location ?? '';
  editUniformOfDay.value = event.uniformOfDay ?? '';
  editStartsAt.value = toDatetimeLocal(event.startsAt);
  editEndsAt.value = toDatetimeLocal(event.endsAt);
  editVisibility.value = event.visibility;
  const firstRuleType = event.audienceRules[0]?.memberType ?? null;
  editAudienceMemberType.value = firstRuleType ?? 'all';
  editRecurrenceFrequency.value = event.recurrenceFrequency ?? 'none';
  editRecurrenceInterval.value = String(event.recurrenceInterval ?? 1);
  editRecurrenceUntil.value = event.recurrenceUntil ? toDatetimeLocal(event.recurrenceUntil) : '';
};

const buildAudienceRules = (visibility: 'tenant' | 'audience', memberTypeValue: 'all' | 'CADET' | 'SENIOR' | 'UNKNOWN') =>
  visibility === 'audience' && memberTypeValue !== 'all' ? [{ memberType: memberTypeValue }] : [];

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
    const audienceRules = buildAudienceRules(newVisibility.value, newAudienceMemberType.value);
    const recurrence = {
      frequency: newRecurrenceFrequency.value,
      interval: Number(newRecurrenceInterval.value || '1'),
      occurrences: newRecurrenceFrequency.value === 'none' ? undefined : Number(newRecurrenceOccurrences.value || '10'),
      until: newRecurrenceUntil.value ? fromDatetimeLocal(newRecurrenceUntil.value) : undefined
    };

    const { data } = await api.post(`/tenant/${selectedTenantSlug.value}/events`, {
      title: newTitle.value,
      description: newDescription.value || undefined,
      location: newLocation.value || undefined,
      uniformOfDay: newUniformOfDay.value || undefined,
      startsAt: fromDatetimeLocal(newStartsAt.value),
      endsAt: fromDatetimeLocal(newEndsAt.value),
      visibility: newVisibility.value,
      allDay: false,
      audienceRules,
      recurrence
    });
    actionMessage.value = data.createdCount && data.createdCount > 1 ? `Created ${data.createdCount} recurring events.` : 'Event created.';
    await loadEvents();
    if (items.value.length > 0) {
      selectedEventId.value = items.value[0].id;
      await loadEventDetail();
    }
    resetNewForm();
    showNewEventForm.value = false;
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
    const audienceRules = buildAudienceRules(editVisibility.value, editAudienceMemberType.value);

    await api.patch(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}`, {
      title: editTitle.value,
      description: editDescription.value || null,
      location: editLocation.value || null,
      uniformOfDay: editUniformOfDay.value || null,
      startsAt: fromDatetimeLocal(editStartsAt.value),
      endsAt: fromDatetimeLocal(editEndsAt.value),
      visibility: editVisibility.value,
      audienceRules,
      recurrence: {
        frequency: editRecurrenceFrequency.value,
        interval: Number(editRecurrenceInterval.value || '1'),
        until: editRecurrenceUntil.value ? fromDatetimeLocal(editRecurrenceUntil.value) : undefined
      }
    });
    actionMessage.value = 'Selected event updated.';
    await loadEvents();
    await loadEventDetail();
    showEditForm.value = false;
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
    actionMessage.value = 'Selected event cancelled.';
    await loadEvents();
    await loadEventDetail();
    showEditForm.value = false;
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

const rsvpForEvent = async (eventId: string, statusValue: 'yes' | 'no' | 'maybe') => {
  if (!selectedTenantSlug.value) return;
  actionMessage.value = '';
  try {
    await api.put(`/tenant/${selectedTenantSlug.value}/events/${eventId}/rsvp`, {
      status: statusValue
    });
    actionMessage.value = `RSVP saved: ${statusValue.toUpperCase()}`;
    await loadEvents();
    if (selectedEventId.value === eventId) {
      await loadEventDetail();
    }
  } catch (error) {
    actionMessage.value = errorMessage(error);
  }
};

const sendNotificationForSelectedEvent = async () => {
  if (!selectedTenantSlug.value || !selectedEvent.value) return;
  const channels = [notifyEmail.value ? 'email' : null, notifyPush.value ? 'push' : null].filter((value): value is 'email' | 'push' => Boolean(value));
  if (channels.length === 0) {
    actionMessage.value = 'Select at least one channel (email or push).';
    return;
  }

  notifying.value = true;
  actionMessage.value = '';
  try {
    await api.post(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}/notify`, {
      type: notifyType.value,
      channels,
      scheduledAt: notifyScheduledAt.value ? fromDatetimeLocal(notifyScheduledAt.value) : undefined
    });
    actionMessage.value = notifyScheduledAt.value ? 'Notification scheduled.' : 'Notification queued for immediate delivery.';
    notifyScheduledAt.value = '';
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    notifying.value = false;
  }
};

watch([selectedTenantSlug, query, status, memberType, sortBy, sortDir], () => {
  page.value = 1;
  loadEvents();
});

watch([page, pageSize], loadEvents);

watch(selectedEventId, async () => {
  await loadEventDetail();
  showEditForm.value = false;
  if (selectedEvent.value) {
    populateEditFormFromEvent(selectedEvent.value);
  }
});

onMounted(async () => {
  resetNewForm();
  await loadEvents();
  await loadEventDetail();
  if (selectedEvent.value) {
    populateEditFormFromEvent(selectedEvent.value);
  }
});

const startNewEvent = () => {
  resetNewForm();
  showNewEventForm.value = true;
};

const startEditingEvent = (eventId: string) => {
  selectedEventId.value = eventId;
  showEditForm.value = true;
};
</script>

<template>
  <PageHeader title="Events" subtitle="Event-centric details, RSVPs, and recurring event creation" />

  <div class="mb-4 grid gap-3 md:grid-cols-7">
    <UiInput v-model="query" placeholder="Search title, location, description" />
    <UiSelect v-model="status" :options="[{ label: 'Active', value: 'active' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'All', value: 'all' }]" />
    <UiSelect v-model="memberType" :options="[{ label: 'All audiences', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]" />
    <UiSelect v-model="sortBy" :options="[{ label: 'Start time', value: 'startsAt' }, { label: 'Title', value: 'title' }, { label: 'Updated', value: 'updatedAt' }, { label: 'Created', value: 'createdAt' }]" />
    <UiSelect v-model="sortDir" :options="[{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]" />
    <UiButton :disabled="loading" @click="loadEvents">{{ loading ? 'Loading...' : 'Refresh' }}</UiButton>
    <UiButton @click="startNewEvent">New event</UiButton>
  </div>

  <section v-if="showNewEventForm" class="card mb-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-lg font-semibold">New event</h3>
      <UiButton variant="secondary" @click="showNewEventForm = false">Close</UiButton>
    </div>
    <form class="mt-3 grid gap-2 md:grid-cols-2" @submit.prevent="createEvent">
      <UiInput v-model="newTitle" placeholder="Event title" />
      <UiInput v-model="newLocation" placeholder="Location (manual entry supported)" />
      <UiSelect
        v-model="newUniformOfDay"
        :options="[
          { label: 'Uniform of the Day (optional)', value: '' },
          { label: 'PT', value: 'PT' },
          { label: 'ABU/OCP', value: 'ABU_OCP' },
          { label: 'Blues', value: 'BLUES' }
        ]"
      />
      <div class="md:col-span-2">
        <UiInput v-model="newDescription" placeholder="Description" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Starts</label>
        <UiInput v-model="newStartsAt" type="datetime-local" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ends</label>
        <UiInput v-model="newEndsAt" type="datetime-local" />
      </div>
      <UiSelect v-model="newVisibility" :options="[{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]" />
      <UiSelect
        v-if="newVisibility === 'audience'"
        v-model="newAudienceMemberType"
        :options="[{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]"
      />

      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Repeat</label>
        <UiSelect v-model="newRecurrenceFrequency" :options="[{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Interval</label>
        <UiInput v-model="newRecurrenceInterval" type="number" placeholder="1 = every week/day/month" />
      </div>

      <div v-if="newRecurrenceFrequency !== 'none'">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Occurrences</label>
        <UiInput v-model="newRecurrenceOccurrences" type="number" placeholder="How many events to create (e.g. 10)" />
      </div>
      <div v-if="newRecurrenceFrequency !== 'none'">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Until (optional)</label>
        <UiInput v-model="newRecurrenceUntil" type="datetime-local" placeholder="Stop date for recurrence" />
      </div>

      <p v-if="newRecurrenceFrequency !== 'none'" class="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">
        Example: Weekly + Interval 1 + Occurrences 10 creates 10 weekly events.
      </p>

      <div class="md:col-span-2 flex flex-wrap gap-2">
        <UiButton type="submit" :disabled="saving || !newTitle || !newStartsAt || !newEndsAt">{{ saving ? 'Saving...' : 'Create event' }}</UiButton>
      </div>
    </form>
  </section>

  <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
    <div>
      <UiTable class="hidden md:block">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
          <tr>
            <th class="px-4 py-3">Title</th>
            <th class="px-4 py-3">UOD</th>
            <th class="px-4 py-3">Starts</th>
            <th class="px-4 py-3">Recurrence</th>
            <th class="px-4 py-3">RSVP</th>
            <th class="px-4 py-3">Actions</th>
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
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.location ?? 'No location' }}</p>
            </td>
            <td class="px-4 py-3">{{ formatUniformOfDay(item.uniformOfDay) }}</td>
            <td class="px-4 py-3">{{ formatDateTime(item.startsAt) }}</td>
            <td class="px-4 py-3 text-xs">
              {{ item.recurrenceFrequency && item.recurrenceFrequency !== 'none' ? `${item.recurrenceFrequency} x${item.recurrenceInterval ?? 1}` : 'None' }}
            </td>
            <td class="px-4 py-3">Y {{ item.counts.yes }} / M {{ item.counts.maybe }} / N {{ item.counts.no }}</td>
            <td class="px-4 py-3">
              <UiButton variant="secondary" @click.stop="startEditingEvent(item.id)">Edit</UiButton>
            </td>
          </tr>
          <tr v-if="items.length === 0" class="border-t border-slate-200 dark:border-slate-800">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No events found.</td>
          </tr>
        </tbody>
      </UiTable>

      <div class="grid gap-3 md:hidden">
        <div v-for="item in items" :key="`mobile-${item.id}`" class="card" :class="selectedEventId === item.id ? 'ring-2 ring-indigo-400' : ''">
          <button class="w-full text-left" @click="selectedEventId = item.id">
            <p class="font-semibold">{{ item.title }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatDateTime(item.startsAt) }}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ item.location ?? 'No location' }}</p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">UOD: {{ formatUniformOfDay(item.uniformOfDay) }}</p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Current RSVP: {{ item.myRsvp ?? 'No response' }}</p>
          </button>

          <div class="mt-3 flex flex-wrap gap-2">
            <UiButton :disabled="item.isCancelled" @click="rsvpForEvent(item.id, 'yes')">Yes</UiButton>
            <UiButton variant="secondary" :disabled="item.isCancelled" @click="rsvpForEvent(item.id, 'maybe')">Maybe</UiButton>
            <UiButton variant="danger" :disabled="item.isCancelled" @click="rsvpForEvent(item.id, 'no')">No</UiButton>
            <UiButton variant="secondary" @click="startEditingEvent(item.id)">Edit</UiButton>
          </div>
        </div>
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

    <div class="hidden space-y-4 lg:block">
      <section v-if="selectedEvent" class="card">
        <h3 class="text-lg font-semibold">{{ selectedEvent.title }}</h3>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ selectedEvent.isCancelled ? 'Cancelled event' : 'Active event' }}</p>
        <div class="mt-3 space-y-1 text-sm">
          <p><span class="font-medium">Starts:</span> {{ formatDateTime(selectedEvent.startsAt) }}</p>
          <p><span class="font-medium">Ends:</span> {{ formatDateTime(selectedEvent.endsAt) }}</p>
          <p><span class="font-medium">Location:</span> {{ selectedEvent.location ?? '—' }}</p>
          <p><span class="font-medium">Uniform:</span> {{ formatUniformOfDay(selectedEvent.uniformOfDay) }}</p>
          <p><span class="font-medium">Audience:</span> {{ selectedEvent.visibility }}</p>
          <p><span class="font-medium">Recurrence:</span> {{ formatRecurrence(selectedEvent) }}</p>
        </div>

        <div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h4 class="text-base font-semibold">My RSVP</h4>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Current: {{ selectedEvent.myRsvp ?? 'No response yet' }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UiButton :disabled="selectedEvent.isCancelled" @click="rsvp('yes')">Yes</UiButton>
            <UiButton variant="secondary" :disabled="selectedEvent.isCancelled" @click="rsvp('maybe')">Maybe</UiButton>
            <UiButton variant="danger" :disabled="selectedEvent.isCancelled" @click="rsvp('no')">No</UiButton>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Yes {{ selectedEvent.counts.yes }}</div>
            <div class="rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Maybe {{ selectedEvent.counts.maybe }}</div>
            <div class="rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">No {{ selectedEvent.counts.no }}</div>
          </div>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Total responses: {{ selectedTotal }}</p>
        </div>

        <div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h4 class="text-base font-semibold">Notifications</h4>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Schedule email/push notifications with signed RSVP links.</p>
          <div class="mt-3 grid gap-2">
            <UiSelect
              v-model="notifyType"
              :options="[
                { label: 'Publish', value: 'publish' },
                { label: 'Update', value: 'update' },
                { label: 'Reminder', value: 'reminder' }
              ]"
            />
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule at (optional)</label>
              <UiInput v-model="notifyScheduledAt" type="datetime-local" />
            </div>
            <div class="flex flex-wrap gap-4 text-sm">
              <label class="inline-flex items-center gap-2">
                <input v-model="notifyEmail" type="checkbox" />
                <span>Email</span>
              </label>
              <label class="inline-flex items-center gap-2">
                <input v-model="notifyPush" type="checkbox" />
                <span>Push</span>
              </label>
            </div>
            <div>
              <UiButton :disabled="notifying" @click="sendNotificationForSelectedEvent">{{ notifying ? 'Sending…' : 'Send/Schedule notification' }}</UiButton>
            </div>
          </div>
        </div>

        <div v-if="showEditForm" class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h4 class="text-base font-semibold">Edit selected event</h4>
          <form class="mt-3 grid gap-2" @submit.prevent="saveSelectedEvent">
            <UiInput v-model="editTitle" placeholder="Event title" />
            <UiInput v-model="editDescription" placeholder="Description" />
            <UiInput v-model="editLocation" placeholder="Location" />
            <UiSelect
              v-model="editUniformOfDay"
              :options="[
                { label: 'Uniform of the Day (optional)', value: '' },
                { label: 'PT', value: 'PT' },
                { label: 'ABU/OCP', value: 'ABU_OCP' },
                { label: 'Blues', value: 'BLUES' }
              ]"
            />
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Starts</label>
            <UiInput v-model="editStartsAt" type="datetime-local" />
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ends</label>
            <UiInput v-model="editEndsAt" type="datetime-local" />
            <UiSelect v-model="editVisibility" :options="[{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]" />
            <UiSelect
              v-if="editVisibility === 'audience'"
              v-model="editAudienceMemberType"
              :options="[{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]"
            />
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Repeat</label>
              <UiSelect v-model="editRecurrenceFrequency" :options="[{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Interval</label>
              <UiInput v-model="editRecurrenceInterval" type="number" placeholder="1 = every week/day/month" />
            </div>
            <div v-if="editRecurrenceFrequency !== 'none'">
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Until (optional)</label>
              <UiInput v-model="editRecurrenceUntil" type="datetime-local" placeholder="Stop date for recurrence" />
            </div>

            <div class="mt-2 flex flex-wrap gap-2">
              <UiButton type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Update selected' }}</UiButton>
              <UiButton variant="secondary" type="button" :disabled="saving" @click="showEditForm = false">Close</UiButton>
              <UiButton variant="danger" type="button" :disabled="saving || selectedEvent.isCancelled" @click="cancelSelectedEvent">Cancel selected</UiButton>
            </div>
          </form>
        </div>
      </section>

      <section v-else class="card">
        <h3 class="text-lg font-semibold">Select an event</h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose an event from the list to view RSVP and edit it in place.</p>
      </section>

      <p v-if="actionMessage" class="text-sm text-slate-500 dark:text-slate-400">{{ actionMessage }}</p>
    </div>
  </div>
</template>
