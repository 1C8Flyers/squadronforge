import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiModal from '@/components/ui/UiModal.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiTable from '@/components/ui/UiTable.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const { selectedTenantSlug } = useSession();
const query = ref('');
const status = ref('active');
const memberType = ref('all');
const page = ref(1);
const pageSize = ref('25');
const sortBy = ref('startsAt');
const sortDir = ref('asc');
const loading = ref(false);
const saving = ref(false);
const notifying = ref(false);
const actionMessage = ref('');
const items = ref([]);
const total = ref(0);
const selectedEventId = ref('');
const selectedEvent = ref(null);
const showNewEventForm = ref(false);
const showEditForm = ref(false);
const notifyType = ref('reminder');
const notifyScheduledAt = ref('');
const notifyEmail = ref(true);
const notifyPush = ref(true);
const newTitle = ref('');
const newDescription = ref('');
const newLocation = ref('');
const newUniformOfDay = ref('');
const newStartsAt = ref('');
const newEndsAt = ref('');
const newVisibility = ref('tenant');
const newAudienceMemberType = ref('all');
const newAudienceCapids = ref('');
const newExternalRecipients = ref([]);
const newRecurrenceFrequency = ref('none');
const newRecurrenceInterval = ref('1');
const newRecurrenceOccurrences = ref('10');
const newRecurrenceUntil = ref('');
const editTitle = ref('');
const editDescription = ref('');
const editLocation = ref('');
const editUniformOfDay = ref('');
const editStartsAt = ref('');
const editEndsAt = ref('');
const editVisibility = ref('tenant');
const editAudienceMemberType = ref('all');
const editAudienceCapids = ref('');
const editExternalRecipients = ref([]);
const editRecurrenceFrequency = ref('none');
const editRecurrenceInterval = ref('1');
const editRecurrenceUntil = ref('');
const selectedTotal = computed(() => selectedEvent.value?.counts.total ?? 0);
const toDatetimeLocal = (value) => {
    const d = new Date(value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
};
const fromDatetimeLocal = (value) => new Date(value).toISOString();
const formatDateTime = (value) => new Date(value).toLocaleString();
const rsvpResponderLabel = (rsvp) => {
    if (rsvp.user?.email)
        return rsvp.user.email;
    if (rsvp.externalName)
        return rsvp.externalName;
    if (rsvp.externalEmail)
        return rsvp.externalEmail;
    if (rsvp.memberName)
        return rsvp.memberName;
    if (rsvp.capid)
        return `CAPID ${rsvp.capid}`;
    return 'Unknown responder';
};
const parseCapids = (value) => [...new Set(value.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean))].map((capid) => ({ capid }));
const normalizeExternalRecipients = (value) => {
    const unique = new Map();
    for (const recipient of value) {
        const email = recipient.email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email))
            continue;
        unique.set(email, {
            name: recipient.name.trim() || undefined,
            email
        });
    }
    return [...unique.values()];
};
const blankRecipient = () => ({ name: '', email: '' });
const addNewExternalRecipient = () => {
    newExternalRecipients.value.push(blankRecipient());
};
const removeNewExternalRecipient = (index) => {
    newExternalRecipients.value.splice(index, 1);
};
const addEditExternalRecipient = () => {
    editExternalRecipients.value.push(blankRecipient());
};
const removeEditExternalRecipient = (index) => {
    editExternalRecipients.value.splice(index, 1);
};
const formatUniformOfDay = (value) => {
    if (!value)
        return 'Not set';
    if (value === 'ABU_OCP')
        return 'ABU/OCP';
    return value;
};
const formatAudienceRule = (rule) => {
    const memberTypeLabel = rule.memberType === 'CADET'
        ? 'Cadets'
        : rule.memberType === 'SENIOR'
            ? 'Seniors'
            : rule.memberType === 'UNKNOWN'
                ? 'Unknown member type'
                : 'All members';
    if (!rule.unitCharter)
        return memberTypeLabel;
    return `${memberTypeLabel} (${rule.unitCharter})`;
};
const formatAudience = (event) => {
    if (event.visibility === 'tenant')
        return 'All members (tenant-wide)';
    const parts = [];
    if (event.audienceRules.length > 0) {
        parts.push(event.audienceRules.map(formatAudienceRule).join(', '));
    }
    if (event.audienceMembers.length > 0) {
        parts.push(`${event.audienceMembers.length} specific member${event.audienceMembers.length === 1 ? '' : 's'}`);
    }
    if (event.externalRecipients.length > 0) {
        parts.push(`${event.externalRecipients.length} external recipient${event.externalRecipients.length === 1 ? '' : 's'}`);
    }
    if (parts.length === 0)
        return 'Filtered audience';
    return parts.join(' + ');
};
const formatRecurrence = (event) => {
    const frequency = event.recurrenceFrequency ?? 'none';
    if (frequency === 'none')
        return 'Does not repeat';
    const interval = event.recurrenceInterval ?? 1;
    const base = `Repeats every ${interval} ${frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}${interval > 1 ? 's' : ''}`;
    if (!event.recurrenceUntil)
        return base;
    return `${base} until ${new Date(event.recurrenceUntil).toLocaleDateString()}`;
};
const errorMessage = (error) => {
    const maybe = error;
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
    newAudienceCapids.value = '';
    newExternalRecipients.value = [blankRecipient()];
    newRecurrenceFrequency.value = 'none';
    newRecurrenceInterval.value = '1';
    newRecurrenceOccurrences.value = '10';
    newRecurrenceUntil.value = '';
};
const populateEditFormFromEvent = (event) => {
    editTitle.value = event.title;
    editDescription.value = event.description ?? '';
    editLocation.value = event.location ?? '';
    editUniformOfDay.value = event.uniformOfDay ?? '';
    editStartsAt.value = toDatetimeLocal(event.startsAt);
    editEndsAt.value = toDatetimeLocal(event.endsAt);
    editVisibility.value = event.visibility;
    const firstRuleType = event.audienceRules[0]?.memberType ?? null;
    editAudienceMemberType.value = firstRuleType ?? 'all';
    editAudienceCapids.value = event.audienceMembers.map((member) => member.capid).join(', ');
    editExternalRecipients.value =
        event.externalRecipients.length > 0
            ? event.externalRecipients.map((recipient) => ({
                name: recipient.name ?? '',
                email: recipient.email
            }))
            : [blankRecipient()];
    editRecurrenceFrequency.value = event.recurrenceFrequency ?? 'none';
    editRecurrenceInterval.value = String(event.recurrenceInterval ?? 1);
    editRecurrenceUntil.value = event.recurrenceUntil ? toDatetimeLocal(event.recurrenceUntil) : '';
};
const buildAudienceRules = (visibility, memberTypeValue) => visibility === 'audience' && memberTypeValue !== 'all' ? [{ memberType: memberTypeValue }] : [];
const loadEvents = async () => {
    if (!selectedTenantSlug.value) {
        items.value = [];
        total.value = 0;
        return;
    }
    loading.value = true;
    actionMessage.value = '';
    try {
        const params = {
            page: String(page.value),
            pageSize: pageSize.value,
            status: status.value,
            sortBy: sortBy.value,
            sortDir: sortDir.value
        };
        if (query.value.trim())
            params.q = query.value.trim();
        if (memberType.value !== 'all')
            params.memberType = memberType.value;
        const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/events`, { params });
        items.value = data.items;
        total.value = data.total;
        if (!selectedEventId.value && items.value.length > 0) {
            selectedEventId.value = items.value[0].id;
        }
        if (selectedEventId.value && !items.value.some((item) => item.id === selectedEventId.value)) {
            selectedEventId.value = items.value[0]?.id ?? '';
        }
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
    finally {
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
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
};
const createEvent = async () => {
    if (!selectedTenantSlug.value)
        return;
    saving.value = true;
    actionMessage.value = '';
    try {
        const audienceRules = buildAudienceRules(newVisibility.value, newAudienceMemberType.value);
        const audienceMembers = newVisibility.value === 'audience' ? parseCapids(newAudienceCapids.value) : [];
        const externalRecipients = newVisibility.value === 'audience' ? normalizeExternalRecipients(newExternalRecipients.value) : [];
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
            audienceMembers,
            externalRecipients,
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
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
    finally {
        saving.value = false;
    }
};
const saveSelectedEvent = async () => {
    if (!selectedTenantSlug.value || !selectedEvent.value)
        return;
    saving.value = true;
    actionMessage.value = '';
    try {
        const audienceRules = buildAudienceRules(editVisibility.value, editAudienceMemberType.value);
        const audienceMembers = editVisibility.value === 'audience' ? parseCapids(editAudienceCapids.value) : [];
        const externalRecipients = editVisibility.value === 'audience' ? normalizeExternalRecipients(editExternalRecipients.value) : [];
        await api.patch(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}`, {
            title: editTitle.value,
            description: editDescription.value || null,
            location: editLocation.value || null,
            uniformOfDay: editUniformOfDay.value || null,
            startsAt: fromDatetimeLocal(editStartsAt.value),
            endsAt: fromDatetimeLocal(editEndsAt.value),
            visibility: editVisibility.value,
            audienceRules,
            audienceMembers,
            externalRecipients,
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
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
    finally {
        saving.value = false;
    }
};
const cancelSelectedEvent = async () => {
    if (!selectedTenantSlug.value || !selectedEvent.value)
        return;
    saving.value = true;
    actionMessage.value = '';
    try {
        await api.delete(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}`);
        actionMessage.value = 'Selected event cancelled.';
        await loadEvents();
        await loadEventDetail();
        showEditForm.value = false;
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
    finally {
        saving.value = false;
    }
};
const rsvp = async (statusValue) => {
    if (!selectedTenantSlug.value || !selectedEvent.value)
        return;
    actionMessage.value = '';
    try {
        await api.put(`/tenant/${selectedTenantSlug.value}/events/${selectedEvent.value.id}/rsvp`, {
            status: statusValue
        });
        actionMessage.value = `RSVP saved: ${statusValue.toUpperCase()}`;
        await loadEvents();
        await loadEventDetail();
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
};
const rsvpForEvent = async (eventId, statusValue) => {
    if (!selectedTenantSlug.value)
        return;
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
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
};
const sendNotificationForSelectedEvent = async () => {
    if (!selectedTenantSlug.value || !selectedEvent.value)
        return;
    const channels = [notifyEmail.value ? 'email' : null, notifyPush.value ? 'push' : null].filter((value) => Boolean(value));
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
    }
    catch (error) {
        actionMessage.value = errorMessage(error);
    }
    finally {
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
const selectEvent = (eventId) => {
    selectedEventId.value = eventId;
    showEditForm.value = false;
};
const startEditingEvent = (eventId) => {
    selectedEventId.value = eventId;
    if (selectedEvent.value?.id === eventId) {
        populateEditFormFromEvent(selectedEvent.value);
    }
    showEditForm.value = true;
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = PageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: "Events",
    subtitle: "Event-centric details, RSVPs, and recurring event creation",
}));
const __VLS_2 = __VLS_1({
    title: "Events",
    subtitle: "Event-centric details, RSVPs, and recurring event creation",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 grid gap-3 md:grid-cols-7" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-7']} */ ;
const __VLS_5 = UiInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search title, location, description",
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search title, location, description",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = UiSelect;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.status),
    options: ([{ label: 'Active', value: 'active' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'All', value: 'all' }]),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.status),
    options: ([{ label: 'Active', value: 'active' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'All', value: 'all' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = UiSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.memberType),
    options: ([{ label: 'All audiences', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.memberType),
    options: ([{ label: 'All audiences', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_20 = UiSelect;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.sortBy),
    options: ([{ label: 'Start time', value: 'startsAt' }, { label: 'Title', value: 'title' }, { label: 'Updated', value: 'updatedAt' }, { label: 'Created', value: 'createdAt' }]),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.sortBy),
    options: ([{ label: 'Start time', value: 'startsAt' }, { label: 'Title', value: 'title' }, { label: 'Updated', value: 'updatedAt' }, { label: 'Created', value: 'createdAt' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_25 = UiSelect;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    modelValue: (__VLS_ctx.sortDir),
    options: ([{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]),
}));
const __VLS_27 = __VLS_26({
    modelValue: (__VLS_ctx.sortDir),
    options: ([{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const __VLS_30 = UiButton || UiButton;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.loading),
}));
const __VLS_32 = __VLS_31({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_35;
const __VLS_36 = ({ click: {} },
    { onClick: (__VLS_ctx.loadEvents) });
const { default: __VLS_37 } = __VLS_33.slots;
(__VLS_ctx.loading ? 'Loading...' : 'Refresh');
// @ts-ignore
[query, status, memberType, sortBy, sortDir, loading, loading, loadEvents,];
var __VLS_33;
var __VLS_34;
const __VLS_38 = UiButton || UiButton;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
    ...{ 'onClick': {} },
}));
const __VLS_40 = __VLS_39({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
let __VLS_43;
const __VLS_44 = ({ click: {} },
    { onClick: (__VLS_ctx.startNewEvent) });
const { default: __VLS_45 } = __VLS_41.slots;
// @ts-ignore
[startNewEvent,];
var __VLS_41;
var __VLS_42;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 lg:grid-cols-[1.2fr_1fr]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[1.2fr_1fr]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
const __VLS_46 = UiTable || UiTable;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    ...{ class: "hidden md:block" },
}));
const __VLS_48 = __VLS_47({
    ...{ class: "hidden md:block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:block']} */ ;
const { default: __VLS_51 } = __VLS_49.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
    ...{ class: "bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50" },
});
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-slate-800/50']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectEvent(item.id);
                // @ts-ignore
                [items, selectEvent,];
            } },
        key: (item.id),
        ...{ class: "cursor-pointer border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" },
        ...{ class: (__VLS_ctx.selectedEventId === item.id ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (item.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (item.location ?? 'No location');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatUniformOfDay(item.uniformOfDay));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDateTime(item.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (item.recurrenceFrequency && item.recurrenceFrequency !== 'none' ? `${item.recurrenceFrequency} x${item.recurrenceInterval ?? 1}` : 'None');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (item.counts.yes);
    (item.counts.maybe);
    (item.counts.no);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_52 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        ...{ 'onClick': {} },
        variant: "secondary",
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_57;
    const __VLS_58 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.startEditingEvent(item.id);
                // @ts-ignore
                [selectedEventId, formatUniformOfDay, formatDateTime, startEditingEvent,];
            } });
    const { default: __VLS_59 } = __VLS_55.slots;
    // @ts-ignore
    [];
    var __VLS_55;
    var __VLS_56;
    // @ts-ignore
    [];
}
if (__VLS_ctx.items.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ class: "border-t border-slate-200 dark:border-slate-800" },
    });
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "6",
        ...{ class: "px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
// @ts-ignore
[items,];
var __VLS_49;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (`mobile-${item.id}`),
        ...{ class: "card" },
        ...{ class: (__VLS_ctx.selectedEventId === item.id ? 'ring-2 ring-indigo-400' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectEvent(item.id);
                // @ts-ignore
                [items, selectEvent, selectedEventId,];
            } },
        ...{ class: "w-full text-left" },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (item.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.formatDateTime(item.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm text-slate-600 dark:text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
    (item.location ?? 'No location');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.formatUniformOfDay(item.uniformOfDay));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (item.myRsvp ?? 'No response');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const __VLS_60 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        disabled: (item.isCancelled),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        disabled: (item.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.rsvpForEvent(item.id, 'yes');
                // @ts-ignore
                [formatUniformOfDay, formatDateTime, rsvpForEvent,];
            } });
    const { default: __VLS_67 } = __VLS_63.slots;
    // @ts-ignore
    [];
    var __VLS_63;
    var __VLS_64;
    const __VLS_68 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (item.isCancelled),
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (item.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_73;
    const __VLS_74 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.rsvpForEvent(item.id, 'maybe');
                // @ts-ignore
                [rsvpForEvent,];
            } });
    const { default: __VLS_75 } = __VLS_71.slots;
    // @ts-ignore
    [];
    var __VLS_71;
    var __VLS_72;
    const __VLS_76 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
        ...{ 'onClick': {} },
        variant: "danger",
        disabled: (item.isCancelled),
    }));
    const __VLS_78 = __VLS_77({
        ...{ 'onClick': {} },
        variant: "danger",
        disabled: (item.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    let __VLS_81;
    const __VLS_82 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.rsvpForEvent(item.id, 'no');
                // @ts-ignore
                [rsvpForEvent,];
            } });
    const { default: __VLS_83 } = __VLS_79.slots;
    // @ts-ignore
    [];
    var __VLS_79;
    var __VLS_80;
    const __VLS_84 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent1(__VLS_84, new __VLS_84({
        ...{ 'onClick': {} },
        variant: "secondary",
    }));
    const __VLS_86 = __VLS_85({
        ...{ 'onClick': {} },
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    let __VLS_89;
    const __VLS_90 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.startEditingEvent(item.id);
                // @ts-ignore
                [startEditingEvent,];
            } });
    const { default: __VLS_91 } = __VLS_87.slots;
    // @ts-ignore
    [];
    var __VLS_87;
    var __VLS_88;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
(__VLS_ctx.items.length);
(__VLS_ctx.total);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_92 = UiSelect;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent1(__VLS_92, new __VLS_92({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]),
}));
const __VLS_94 = __VLS_93({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
const __VLS_97 = UiButton || UiButton;
// @ts-ignore
const __VLS_98 = __VLS_asFunctionalComponent1(__VLS_97, new __VLS_97({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}));
const __VLS_99 = __VLS_98({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}, ...__VLS_functionalComponentArgsRest(__VLS_98));
let __VLS_102;
const __VLS_103 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = Math.max(1, __VLS_ctx.page - 1);
            // @ts-ignore
            [items, total, pageSize, page, page, page,];
        } });
const { default: __VLS_104 } = __VLS_100.slots;
// @ts-ignore
[];
var __VLS_100;
var __VLS_101;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.page);
const __VLS_105 = UiButton || UiButton;
// @ts-ignore
const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}));
const __VLS_107 = __VLS_106({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_106));
let __VLS_110;
const __VLS_111 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = __VLS_ctx.page + 1;
            // @ts-ignore
            [total, pageSize, page, page, page, page,];
        } });
const { default: __VLS_112 } = __VLS_108.slots;
// @ts-ignore
[];
var __VLS_108;
var __VLS_109;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hidden space-y-4 lg:block" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:block']} */ ;
if (__VLS_ctx.selectedEvent) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.selectedEvent.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.selectedEvent.isCancelled ? 'Cancelled event' : 'Active event');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 space-y-1 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.selectedEvent.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.selectedEvent.endsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.selectedEvent.location ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatUniformOfDay(__VLS_ctx.selectedEvent.uniformOfDay));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatAudience(__VLS_ctx.selectedEvent));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatRecurrence(__VLS_ctx.selectedEvent));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 border-t border-slate-200 pt-4 dark:border-slate-700" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.selectedEvent.myRsvp ?? 'No response yet');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const __VLS_113 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_114 = __VLS_asFunctionalComponent1(__VLS_113, new __VLS_113({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }));
    const __VLS_115 = __VLS_114({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_114));
    let __VLS_118;
    const __VLS_119 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedEvent))
                    return;
                __VLS_ctx.rsvp('yes');
                // @ts-ignore
                [formatUniformOfDay, formatDateTime, formatDateTime, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, formatAudience, formatRecurrence, rsvp,];
            } });
    const { default: __VLS_120 } = __VLS_116.slots;
    // @ts-ignore
    [];
    var __VLS_116;
    var __VLS_117;
    const __VLS_121 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_122 = __VLS_asFunctionalComponent1(__VLS_121, new __VLS_121({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }));
    const __VLS_123 = __VLS_122({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_122));
    let __VLS_126;
    const __VLS_127 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedEvent))
                    return;
                __VLS_ctx.rsvp('maybe');
                // @ts-ignore
                [selectedEvent, rsvp,];
            } });
    const { default: __VLS_128 } = __VLS_124.slots;
    // @ts-ignore
    [];
    var __VLS_124;
    var __VLS_125;
    const __VLS_129 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_130 = __VLS_asFunctionalComponent1(__VLS_129, new __VLS_129({
        ...{ 'onClick': {} },
        variant: "danger",
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }));
    const __VLS_131 = __VLS_130({
        ...{ 'onClick': {} },
        variant: "danger",
        disabled: (__VLS_ctx.selectedEvent.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_130));
    let __VLS_134;
    const __VLS_135 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedEvent))
                    return;
                __VLS_ctx.rsvp('no');
                // @ts-ignore
                [selectedEvent, rsvp,];
            } });
    const { default: __VLS_136 } = __VLS_132.slots;
    // @ts-ignore
    [];
    var __VLS_132;
    var __VLS_133;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid grid-cols-3 gap-2 text-center text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-emerald-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-emerald-900/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
    (__VLS_ctx.selectedEvent.counts.yes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-amber-900/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-amber-300']} */ ;
    (__VLS_ctx.selectedEvent.counts.maybe);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg bg-rose-100 px-2 py-1 font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-rose-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-rose-900/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-rose-300']} */ ;
    (__VLS_ctx.selectedEvent.counts.no);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.selectedTotal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 border-t border-slate-200 pt-4 dark:border-slate-700" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    if (__VLS_ctx.selectedEvent.rsvps.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        for (const [rsvpItem] of __VLS_vFor((__VLS_ctx.selectedEvent.rsvps))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (rsvpItem.id),
                ...{ class: "rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-start justify-between gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-medium" },
            });
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (__VLS_ctx.rsvpResponderLabel(rsvpItem));
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
            (__VLS_ctx.formatDateTime(rsvpItem.respondedAt));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "rounded-full px-2.5 py-1 text-xs font-semibold" },
                ...{ class: ({
                        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300': rsvpItem.status === 'yes',
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300': rsvpItem.status === 'maybe',
                        'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300': rsvpItem.status === 'no'
                    }) },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-emerald-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-emerald-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:bg-emerald-900/30']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-amber-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:bg-amber-900/30']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-amber-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-rose-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-rose-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:bg-rose-900/30']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-rose-300']} */ ;
            (rsvpItem.status.toUpperCase());
            if (rsvpItem.note) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-1 text-xs text-slate-600 dark:text-slate-300" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
                (rsvpItem.note);
            }
            // @ts-ignore
            [formatDateTime, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedTotal, rsvpResponderLabel,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 text-sm text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 border-t border-slate-200 pt-4 dark:border-slate-700" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const __VLS_137 = UiSelect;
    // @ts-ignore
    const __VLS_138 = __VLS_asFunctionalComponent1(__VLS_137, new __VLS_137({
        modelValue: (__VLS_ctx.notifyType),
        options: ([
            { label: 'Publish', value: 'publish' },
            { label: 'Update', value: 'update' },
            { label: 'Reminder', value: 'reminder' }
        ]),
    }));
    const __VLS_139 = __VLS_138({
        modelValue: (__VLS_ctx.notifyType),
        options: ([
            { label: 'Publish', value: 'publish' },
            { label: 'Update', value: 'update' },
            { label: 'Reminder', value: 'reminder' }
        ]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_138));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_142 = UiInput;
    // @ts-ignore
    const __VLS_143 = __VLS_asFunctionalComponent1(__VLS_142, new __VLS_142({
        modelValue: (__VLS_ctx.notifyScheduledAt),
        type: "datetime-local",
    }));
    const __VLS_144 = __VLS_143({
        modelValue: (__VLS_ctx.notifyScheduledAt),
        type: "datetime-local",
    }, ...__VLS_functionalComponentArgsRest(__VLS_143));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-4 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "inline-flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.notifyEmail);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "inline-flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.notifyPush);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    const __VLS_147 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_148 = __VLS_asFunctionalComponent1(__VLS_147, new __VLS_147({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.notifying),
    }));
    const __VLS_149 = __VLS_148({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.notifying),
    }, ...__VLS_functionalComponentArgsRest(__VLS_148));
    let __VLS_152;
    const __VLS_153 = ({ click: {} },
        { onClick: (__VLS_ctx.sendNotificationForSelectedEvent) });
    const { default: __VLS_154 } = __VLS_150.slots;
    (__VLS_ctx.notifying ? 'Sending…' : 'Send/Schedule notification');
    // @ts-ignore
    [notifyType, notifyScheduledAt, notifyEmail, notifyPush, notifying, notifying, sendNotificationForSelectedEvent,];
    var __VLS_150;
    var __VLS_151;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
if (__VLS_ctx.actionMessage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.actionMessage);
}
const __VLS_155 = UiModal || UiModal;
// @ts-ignore
const __VLS_156 = __VLS_asFunctionalComponent1(__VLS_155, new __VLS_155({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.showNewEventForm),
    title: "New event",
}));
const __VLS_157 = __VLS_156({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.showNewEventForm),
    title: "New event",
}, ...__VLS_functionalComponentArgsRest(__VLS_156));
let __VLS_160;
const __VLS_161 = ({ close: {} },
    { onClose: (...[$event]) => {
            __VLS_ctx.showNewEventForm = false;
            // @ts-ignore
            [actionMessage, actionMessage, showNewEventForm, showNewEventForm,];
        } });
const { default: __VLS_162 } = __VLS_158.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.createEvent) },
    ...{ class: "grid gap-2 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
const __VLS_163 = UiInput;
// @ts-ignore
const __VLS_164 = __VLS_asFunctionalComponent1(__VLS_163, new __VLS_163({
    modelValue: (__VLS_ctx.newTitle),
    placeholder: "Event title",
}));
const __VLS_165 = __VLS_164({
    modelValue: (__VLS_ctx.newTitle),
    placeholder: "Event title",
}, ...__VLS_functionalComponentArgsRest(__VLS_164));
const __VLS_168 = UiInput;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent1(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.newLocation),
    placeholder: "Location (manual entry supported)",
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.newLocation),
    placeholder: "Location (manual entry supported)",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
const __VLS_173 = UiSelect;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent1(__VLS_173, new __VLS_173({
    modelValue: (__VLS_ctx.newUniformOfDay),
    options: ([
        { label: 'Uniform of the Day (optional)', value: '' },
        { label: 'PT', value: 'PT' },
        { label: 'ABU/OCP', value: 'ABU_OCP' },
        { label: 'Blues', value: 'BLUES' }
    ]),
}));
const __VLS_175 = __VLS_174({
    modelValue: (__VLS_ctx.newUniformOfDay),
    options: ([
        { label: 'Uniform of the Day (optional)', value: '' },
        { label: 'PT', value: 'PT' },
        { label: 'ABU/OCP', value: 'ABU_OCP' },
        { label: 'Blues', value: 'BLUES' }
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_174));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "md:col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
const __VLS_178 = UiInput;
// @ts-ignore
const __VLS_179 = __VLS_asFunctionalComponent1(__VLS_178, new __VLS_178({
    modelValue: (__VLS_ctx.newDescription),
    placeholder: "Description",
}));
const __VLS_180 = __VLS_179({
    modelValue: (__VLS_ctx.newDescription),
    placeholder: "Description",
}, ...__VLS_functionalComponentArgsRest(__VLS_179));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_183 = UiInput;
// @ts-ignore
const __VLS_184 = __VLS_asFunctionalComponent1(__VLS_183, new __VLS_183({
    modelValue: (__VLS_ctx.newStartsAt),
    type: "datetime-local",
}));
const __VLS_185 = __VLS_184({
    modelValue: (__VLS_ctx.newStartsAt),
    type: "datetime-local",
}, ...__VLS_functionalComponentArgsRest(__VLS_184));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_188 = UiInput;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent1(__VLS_188, new __VLS_188({
    modelValue: (__VLS_ctx.newEndsAt),
    type: "datetime-local",
}));
const __VLS_190 = __VLS_189({
    modelValue: (__VLS_ctx.newEndsAt),
    type: "datetime-local",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
const __VLS_193 = UiSelect;
// @ts-ignore
const __VLS_194 = __VLS_asFunctionalComponent1(__VLS_193, new __VLS_193({
    modelValue: (__VLS_ctx.newVisibility),
    options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
}));
const __VLS_195 = __VLS_194({
    modelValue: (__VLS_ctx.newVisibility),
    options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_194));
if (__VLS_ctx.newVisibility === 'audience') {
    const __VLS_198 = UiSelect;
    // @ts-ignore
    const __VLS_199 = __VLS_asFunctionalComponent1(__VLS_198, new __VLS_198({
        modelValue: (__VLS_ctx.newAudienceMemberType),
        options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
    }));
    const __VLS_200 = __VLS_199({
        modelValue: (__VLS_ctx.newAudienceMemberType),
        options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_199));
}
if (__VLS_ctx.newVisibility === 'audience') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_203 = UiInput;
    // @ts-ignore
    const __VLS_204 = __VLS_asFunctionalComponent1(__VLS_203, new __VLS_203({
        modelValue: (__VLS_ctx.newAudienceCapids),
        placeholder: "Comma or space separated CAPIDs",
    }));
    const __VLS_205 = __VLS_204({
        modelValue: (__VLS_ctx.newAudienceCapids),
        placeholder: "Comma or space separated CAPIDs",
    }, ...__VLS_functionalComponentArgsRest(__VLS_204));
}
if (__VLS_ctx.newVisibility === 'audience') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    for (const [recipient, index] of __VLS_vFor((__VLS_ctx.newExternalRecipients))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`new-recipient-${index}`),
            ...{ class: "grid gap-2 md:grid-cols-[1fr_1fr_auto]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-[1fr_1fr_auto]']} */ ;
        const __VLS_208 = UiInput;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent1(__VLS_208, new __VLS_208({
            modelValue: (recipient.name),
            placeholder: "Name (optional)",
        }));
        const __VLS_210 = __VLS_209({
            modelValue: (recipient.name),
            placeholder: "Name (optional)",
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
        const __VLS_213 = UiInput;
        // @ts-ignore
        const __VLS_214 = __VLS_asFunctionalComponent1(__VLS_213, new __VLS_213({
            modelValue: (recipient.email),
            placeholder: "Email",
        }));
        const __VLS_215 = __VLS_214({
            modelValue: (recipient.email),
            placeholder: "Email",
        }, ...__VLS_functionalComponentArgsRest(__VLS_214));
        const __VLS_218 = UiButton || UiButton;
        // @ts-ignore
        const __VLS_219 = __VLS_asFunctionalComponent1(__VLS_218, new __VLS_218({
            ...{ 'onClick': {} },
            type: "button",
            variant: "secondary",
        }));
        const __VLS_220 = __VLS_219({
            ...{ 'onClick': {} },
            type: "button",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_219));
        let __VLS_223;
        const __VLS_224 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.newVisibility === 'audience'))
                        return;
                    __VLS_ctx.removeNewExternalRecipient(index);
                    // @ts-ignore
                    [createEvent, newTitle, newLocation, newUniformOfDay, newDescription, newStartsAt, newEndsAt, newVisibility, newVisibility, newVisibility, newVisibility, newAudienceMemberType, newAudienceCapids, newExternalRecipients, removeNewExternalRecipient,];
                } });
        const { default: __VLS_225 } = __VLS_221.slots;
        // @ts-ignore
        [];
        var __VLS_221;
        var __VLS_222;
        // @ts-ignore
        [];
    }
    const __VLS_226 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_227 = __VLS_asFunctionalComponent1(__VLS_226, new __VLS_226({
        ...{ 'onClick': {} },
        type: "button",
        variant: "secondary",
    }));
    const __VLS_228 = __VLS_227({
        ...{ 'onClick': {} },
        type: "button",
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_227));
    let __VLS_231;
    const __VLS_232 = ({ click: {} },
        { onClick: (__VLS_ctx.addNewExternalRecipient) });
    const { default: __VLS_233 } = __VLS_229.slots;
    // @ts-ignore
    [addNewExternalRecipient,];
    var __VLS_229;
    var __VLS_230;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_234 = UiSelect;
// @ts-ignore
const __VLS_235 = __VLS_asFunctionalComponent1(__VLS_234, new __VLS_234({
    modelValue: (__VLS_ctx.newRecurrenceFrequency),
    options: ([{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]),
}));
const __VLS_236 = __VLS_235({
    modelValue: (__VLS_ctx.newRecurrenceFrequency),
    options: ([{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_235));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_239 = UiInput;
// @ts-ignore
const __VLS_240 = __VLS_asFunctionalComponent1(__VLS_239, new __VLS_239({
    modelValue: (__VLS_ctx.newRecurrenceInterval),
    type: "number",
    placeholder: "1 = every week/day/month",
}));
const __VLS_241 = __VLS_240({
    modelValue: (__VLS_ctx.newRecurrenceInterval),
    type: "number",
    placeholder: "1 = every week/day/month",
}, ...__VLS_functionalComponentArgsRest(__VLS_240));
if (__VLS_ctx.newRecurrenceFrequency !== 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_244 = UiInput;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent1(__VLS_244, new __VLS_244({
        modelValue: (__VLS_ctx.newRecurrenceOccurrences),
        type: "number",
        placeholder: "How many events to create (e.g. 10)",
    }));
    const __VLS_246 = __VLS_245({
        modelValue: (__VLS_ctx.newRecurrenceOccurrences),
        type: "number",
        placeholder: "How many events to create (e.g. 10)",
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
}
if (__VLS_ctx.newRecurrenceFrequency !== 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_249 = UiInput;
    // @ts-ignore
    const __VLS_250 = __VLS_asFunctionalComponent1(__VLS_249, new __VLS_249({
        modelValue: (__VLS_ctx.newRecurrenceUntil),
        type: "datetime-local",
        placeholder: "Stop date for recurrence",
    }));
    const __VLS_251 = __VLS_250({
        modelValue: (__VLS_ctx.newRecurrenceUntil),
        type: "datetime-local",
        placeholder: "Stop date for recurrence",
    }, ...__VLS_functionalComponentArgsRest(__VLS_250));
}
if (__VLS_ctx.newRecurrenceFrequency !== 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "md:col-span-2 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "md:col-span-2 mt-2 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_254 = UiButton || UiButton;
// @ts-ignore
const __VLS_255 = __VLS_asFunctionalComponent1(__VLS_254, new __VLS_254({
    type: "submit",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.newTitle || !__VLS_ctx.newStartsAt || !__VLS_ctx.newEndsAt),
}));
const __VLS_256 = __VLS_255({
    type: "submit",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.newTitle || !__VLS_ctx.newStartsAt || !__VLS_ctx.newEndsAt),
}, ...__VLS_functionalComponentArgsRest(__VLS_255));
const { default: __VLS_259 } = __VLS_257.slots;
(__VLS_ctx.saving ? 'Saving...' : 'Create event');
// @ts-ignore
[newTitle, newStartsAt, newEndsAt, newRecurrenceFrequency, newRecurrenceFrequency, newRecurrenceFrequency, newRecurrenceFrequency, newRecurrenceInterval, newRecurrenceOccurrences, newRecurrenceUntil, saving, saving,];
var __VLS_257;
// @ts-ignore
[];
var __VLS_158;
var __VLS_159;
const __VLS_260 = UiModal || UiModal;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent1(__VLS_260, new __VLS_260({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.showEditForm),
    title: "Edit selected event",
}));
const __VLS_262 = __VLS_261({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.showEditForm),
    title: "Edit selected event",
}, ...__VLS_functionalComponentArgsRest(__VLS_261));
let __VLS_265;
const __VLS_266 = ({ close: {} },
    { onClose: (...[$event]) => {
            __VLS_ctx.showEditForm = false;
            // @ts-ignore
            [showEditForm, showEditForm,];
        } });
const { default: __VLS_267 } = __VLS_263.slots;
if (__VLS_ctx.selectedEvent) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.saveSelectedEvent) },
        ...{ class: "grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const __VLS_268 = UiInput;
    // @ts-ignore
    const __VLS_269 = __VLS_asFunctionalComponent1(__VLS_268, new __VLS_268({
        modelValue: (__VLS_ctx.editTitle),
        placeholder: "Event title",
    }));
    const __VLS_270 = __VLS_269({
        modelValue: (__VLS_ctx.editTitle),
        placeholder: "Event title",
    }, ...__VLS_functionalComponentArgsRest(__VLS_269));
    const __VLS_273 = UiInput;
    // @ts-ignore
    const __VLS_274 = __VLS_asFunctionalComponent1(__VLS_273, new __VLS_273({
        modelValue: (__VLS_ctx.editDescription),
        placeholder: "Description",
    }));
    const __VLS_275 = __VLS_274({
        modelValue: (__VLS_ctx.editDescription),
        placeholder: "Description",
    }, ...__VLS_functionalComponentArgsRest(__VLS_274));
    const __VLS_278 = UiInput;
    // @ts-ignore
    const __VLS_279 = __VLS_asFunctionalComponent1(__VLS_278, new __VLS_278({
        modelValue: (__VLS_ctx.editLocation),
        placeholder: "Location",
    }));
    const __VLS_280 = __VLS_279({
        modelValue: (__VLS_ctx.editLocation),
        placeholder: "Location",
    }, ...__VLS_functionalComponentArgsRest(__VLS_279));
    const __VLS_283 = UiSelect;
    // @ts-ignore
    const __VLS_284 = __VLS_asFunctionalComponent1(__VLS_283, new __VLS_283({
        modelValue: (__VLS_ctx.editUniformOfDay),
        options: ([
            { label: 'Uniform of the Day (optional)', value: '' },
            { label: 'PT', value: 'PT' },
            { label: 'ABU/OCP', value: 'ABU_OCP' },
            { label: 'Blues', value: 'BLUES' }
        ]),
    }));
    const __VLS_285 = __VLS_284({
        modelValue: (__VLS_ctx.editUniformOfDay),
        options: ([
            { label: 'Uniform of the Day (optional)', value: '' },
            { label: 'PT', value: 'PT' },
            { label: 'ABU/OCP', value: 'ABU_OCP' },
            { label: 'Blues', value: 'BLUES' }
        ]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_284));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_288 = UiInput;
    // @ts-ignore
    const __VLS_289 = __VLS_asFunctionalComponent1(__VLS_288, new __VLS_288({
        modelValue: (__VLS_ctx.editStartsAt),
        type: "datetime-local",
    }));
    const __VLS_290 = __VLS_289({
        modelValue: (__VLS_ctx.editStartsAt),
        type: "datetime-local",
    }, ...__VLS_functionalComponentArgsRest(__VLS_289));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_293 = UiInput;
    // @ts-ignore
    const __VLS_294 = __VLS_asFunctionalComponent1(__VLS_293, new __VLS_293({
        modelValue: (__VLS_ctx.editEndsAt),
        type: "datetime-local",
    }));
    const __VLS_295 = __VLS_294({
        modelValue: (__VLS_ctx.editEndsAt),
        type: "datetime-local",
    }, ...__VLS_functionalComponentArgsRest(__VLS_294));
    const __VLS_298 = UiSelect;
    // @ts-ignore
    const __VLS_299 = __VLS_asFunctionalComponent1(__VLS_298, new __VLS_298({
        modelValue: (__VLS_ctx.editVisibility),
        options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
    }));
    const __VLS_300 = __VLS_299({
        modelValue: (__VLS_ctx.editVisibility),
        options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_299));
    if (__VLS_ctx.editVisibility === 'audience') {
        const __VLS_303 = UiSelect;
        // @ts-ignore
        const __VLS_304 = __VLS_asFunctionalComponent1(__VLS_303, new __VLS_303({
            modelValue: (__VLS_ctx.editAudienceMemberType),
            options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
        }));
        const __VLS_305 = __VLS_304({
            modelValue: (__VLS_ctx.editAudienceMemberType),
            options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_304));
    }
    if (__VLS_ctx.editVisibility === 'audience') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
        const __VLS_308 = UiInput;
        // @ts-ignore
        const __VLS_309 = __VLS_asFunctionalComponent1(__VLS_308, new __VLS_308({
            modelValue: (__VLS_ctx.editAudienceCapids),
            placeholder: "Comma or space separated CAPIDs",
        }));
        const __VLS_310 = __VLS_309({
            modelValue: (__VLS_ctx.editAudienceCapids),
            placeholder: "Comma or space separated CAPIDs",
        }, ...__VLS_functionalComponentArgsRest(__VLS_309));
    }
    if (__VLS_ctx.editVisibility === 'audience') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-2" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        for (const [recipient, index] of __VLS_vFor((__VLS_ctx.editExternalRecipients))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (`edit-recipient-${index}`),
                ...{ class: "grid gap-2 md:grid-cols-[1fr_1fr_auto]" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['md:grid-cols-[1fr_1fr_auto]']} */ ;
            const __VLS_313 = UiInput;
            // @ts-ignore
            const __VLS_314 = __VLS_asFunctionalComponent1(__VLS_313, new __VLS_313({
                modelValue: (recipient.name),
                placeholder: "Name (optional)",
            }));
            const __VLS_315 = __VLS_314({
                modelValue: (recipient.name),
                placeholder: "Name (optional)",
            }, ...__VLS_functionalComponentArgsRest(__VLS_314));
            const __VLS_318 = UiInput;
            // @ts-ignore
            const __VLS_319 = __VLS_asFunctionalComponent1(__VLS_318, new __VLS_318({
                modelValue: (recipient.email),
                placeholder: "Email",
            }));
            const __VLS_320 = __VLS_319({
                modelValue: (recipient.email),
                placeholder: "Email",
            }, ...__VLS_functionalComponentArgsRest(__VLS_319));
            const __VLS_323 = UiButton || UiButton;
            // @ts-ignore
            const __VLS_324 = __VLS_asFunctionalComponent1(__VLS_323, new __VLS_323({
                ...{ 'onClick': {} },
                type: "button",
                variant: "secondary",
            }));
            const __VLS_325 = __VLS_324({
                ...{ 'onClick': {} },
                type: "button",
                variant: "secondary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_324));
            let __VLS_328;
            const __VLS_329 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(__VLS_ctx.selectedEvent))
                            return;
                        if (!(__VLS_ctx.editVisibility === 'audience'))
                            return;
                        __VLS_ctx.removeEditExternalRecipient(index);
                        // @ts-ignore
                        [selectedEvent, saveSelectedEvent, editTitle, editDescription, editLocation, editUniformOfDay, editStartsAt, editEndsAt, editVisibility, editVisibility, editVisibility, editVisibility, editAudienceMemberType, editAudienceCapids, editExternalRecipients, removeEditExternalRecipient,];
                    } });
            const { default: __VLS_330 } = __VLS_326.slots;
            // @ts-ignore
            [];
            var __VLS_326;
            var __VLS_327;
            // @ts-ignore
            [];
        }
        const __VLS_331 = UiButton || UiButton;
        // @ts-ignore
        const __VLS_332 = __VLS_asFunctionalComponent1(__VLS_331, new __VLS_331({
            ...{ 'onClick': {} },
            type: "button",
            variant: "secondary",
        }));
        const __VLS_333 = __VLS_332({
            ...{ 'onClick': {} },
            type: "button",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_332));
        let __VLS_336;
        const __VLS_337 = ({ click: {} },
            { onClick: (__VLS_ctx.addEditExternalRecipient) });
        const { default: __VLS_338 } = __VLS_334.slots;
        // @ts-ignore
        [addEditExternalRecipient,];
        var __VLS_334;
        var __VLS_335;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_339 = UiSelect;
    // @ts-ignore
    const __VLS_340 = __VLS_asFunctionalComponent1(__VLS_339, new __VLS_339({
        modelValue: (__VLS_ctx.editRecurrenceFrequency),
        options: ([{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]),
    }));
    const __VLS_341 = __VLS_340({
        modelValue: (__VLS_ctx.editRecurrenceFrequency),
        options: ([{ label: 'Does not repeat', value: 'none' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_340));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    const __VLS_344 = UiInput;
    // @ts-ignore
    const __VLS_345 = __VLS_asFunctionalComponent1(__VLS_344, new __VLS_344({
        modelValue: (__VLS_ctx.editRecurrenceInterval),
        type: "number",
        placeholder: "1 = every week/day/month",
    }));
    const __VLS_346 = __VLS_345({
        modelValue: (__VLS_ctx.editRecurrenceInterval),
        type: "number",
        placeholder: "1 = every week/day/month",
    }, ...__VLS_functionalComponentArgsRest(__VLS_345));
    if (__VLS_ctx.editRecurrenceFrequency !== 'none') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
        const __VLS_349 = UiInput;
        // @ts-ignore
        const __VLS_350 = __VLS_asFunctionalComponent1(__VLS_349, new __VLS_349({
            modelValue: (__VLS_ctx.editRecurrenceUntil),
            type: "datetime-local",
            placeholder: "Stop date for recurrence",
        }));
        const __VLS_351 = __VLS_350({
            modelValue: (__VLS_ctx.editRecurrenceUntil),
            type: "datetime-local",
            placeholder: "Stop date for recurrence",
        }, ...__VLS_functionalComponentArgsRest(__VLS_350));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const __VLS_354 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_355 = __VLS_asFunctionalComponent1(__VLS_354, new __VLS_354({
        type: "submit",
        disabled: (__VLS_ctx.saving),
    }));
    const __VLS_356 = __VLS_355({
        type: "submit",
        disabled: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_355));
    const { default: __VLS_359 } = __VLS_357.slots;
    (__VLS_ctx.saving ? 'Saving...' : 'Update selected');
    // @ts-ignore
    [saving, saving, editRecurrenceFrequency, editRecurrenceFrequency, editRecurrenceInterval, editRecurrenceUntil,];
    var __VLS_357;
    const __VLS_360 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_361 = __VLS_asFunctionalComponent1(__VLS_360, new __VLS_360({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        disabled: (__VLS_ctx.saving),
    }));
    const __VLS_362 = __VLS_361({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        disabled: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_361));
    let __VLS_365;
    const __VLS_366 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedEvent))
                    return;
                __VLS_ctx.showEditForm = false;
                // @ts-ignore
                [saving, showEditForm,];
            } });
    const { default: __VLS_367 } = __VLS_363.slots;
    // @ts-ignore
    [];
    var __VLS_363;
    var __VLS_364;
    const __VLS_368 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_369 = __VLS_asFunctionalComponent1(__VLS_368, new __VLS_368({
        ...{ 'onClick': {} },
        variant: "danger",
        type: "button",
        disabled: (__VLS_ctx.saving || __VLS_ctx.selectedEvent.isCancelled),
    }));
    const __VLS_370 = __VLS_369({
        ...{ 'onClick': {} },
        variant: "danger",
        type: "button",
        disabled: (__VLS_ctx.saving || __VLS_ctx.selectedEvent.isCancelled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_369));
    let __VLS_373;
    const __VLS_374 = ({ click: {} },
        { onClick: (__VLS_ctx.cancelSelectedEvent) });
    const { default: __VLS_375 } = __VLS_371.slots;
    // @ts-ignore
    [selectedEvent, saving, cancelSelectedEvent,];
    var __VLS_371;
    var __VLS_372;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
// @ts-ignore
[];
var __VLS_263;
var __VLS_264;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
