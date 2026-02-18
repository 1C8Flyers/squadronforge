import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
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
const actionMessage = ref('');
const items = ref([]);
const total = ref(0);
const selectedEventId = ref('');
const selectedEvent = ref(null);
const formTitle = ref('');
const formDescription = ref('');
const formLocation = ref('');
const formStartsAt = ref('');
const formEndsAt = ref('');
const formVisibility = ref('tenant');
const formAudienceMemberType = ref('all');
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
const formatDateTime = (value) => {
    const d = new Date(value);
    return d.toLocaleString();
};
const errorMessage = (error) => {
    const maybe = error;
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
const populateFormFromEvent = (event) => {
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
        const audienceRules = formVisibility.value === 'audience' && formAudienceMemberType.value !== 'all'
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
        const audienceRules = formVisibility.value === 'audience' && formAudienceMemberType.value !== 'all'
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
        actionMessage.value = 'Event cancelled.';
        await loadEvents();
        await loadEventDetail();
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
    subtitle: "Tenant event calendar, RSVPs, and attendance",
}));
const __VLS_2 = __VLS_1({
    title: "Events",
    subtitle: "Tenant event calendar, RSVPs, and attendance",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 grid gap-3 md:grid-cols-6" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-6']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 lg:grid-cols-[1.3fr_1fr]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[1.3fr_1fr]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
const __VLS_38 = UiTable || UiTable;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
    ...{ class: "hidden md:block" },
}));
const __VLS_40 = __VLS_39({
    ...{ class: "hidden md:block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:block']} */ ;
const { default: __VLS_43 } = __VLS_41.slots;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedEventId = item.id;
                // @ts-ignore
                [items, selectedEventId,];
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
    (item.isCancelled ? 'Cancelled' : 'Active');
    (item.visibility);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDateTime(item.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (item.location ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (item.counts.yes);
    (item.counts.maybe);
    (item.counts.no);
    // @ts-ignore
    [selectedEventId, formatDateTime,];
}
if (__VLS_ctx.items.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ class: "border-t border-slate-200 dark:border-slate-800" },
    });
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "4",
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
var __VLS_41;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedEventId = item.id;
                // @ts-ignore
                [items, selectedEventId,];
            } },
        key: (`mobile-${item.id}`),
        ...{ class: "card text-left" },
        ...{ class: (__VLS_ctx.selectedEventId === item.id ? 'ring-2 ring-indigo-400' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
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
        ...{ class: "mt-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (item.counts.yes);
    (item.counts.maybe);
    (item.counts.no);
    // @ts-ignore
    [selectedEventId, formatDateTime,];
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
const __VLS_44 = UiSelect;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]),
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '25 / page', value: '25' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_49 = UiButton || UiButton;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}));
const __VLS_51 = __VLS_50({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
let __VLS_54;
const __VLS_55 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = Math.max(1, __VLS_ctx.page - 1);
            // @ts-ignore
            [items, total, pageSize, page, page, page,];
        } });
const { default: __VLS_56 } = __VLS_52.slots;
// @ts-ignore
[];
var __VLS_52;
var __VLS_53;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.page);
const __VLS_57 = UiButton || UiButton;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}));
const __VLS_59 = __VLS_58({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
let __VLS_62;
const __VLS_63 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = __VLS_ctx.page + 1;
            // @ts-ignore
            [total, pageSize, page, page, page, page,];
        } });
const { default: __VLS_64 } = __VLS_60.slots;
// @ts-ignore
[];
var __VLS_60;
var __VLS_61;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
if (__VLS_ctx.selectedEvent) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.selectedEvent.myRsvp ?? 'No response yet');
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_65 = UiButton || UiButton;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}));
const __VLS_67 = __VLS_66({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
let __VLS_70;
const __VLS_71 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.rsvp('yes');
            // @ts-ignore
            [selectedEvent, selectedEvent, selectedEvent, selectedEvent, rsvp,];
        } });
const { default: __VLS_72 } = __VLS_68.slots;
// @ts-ignore
[];
var __VLS_68;
var __VLS_69;
const __VLS_73 = UiButton || UiButton;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}));
const __VLS_75 = __VLS_74({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}, ...__VLS_functionalComponentArgsRest(__VLS_74));
let __VLS_78;
const __VLS_79 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.rsvp('maybe');
            // @ts-ignore
            [selectedEvent, selectedEvent, rsvp,];
        } });
const { default: __VLS_80 } = __VLS_76.slots;
// @ts-ignore
[];
var __VLS_76;
var __VLS_77;
const __VLS_81 = UiButton || UiButton;
// @ts-ignore
const __VLS_82 = __VLS_asFunctionalComponent1(__VLS_81, new __VLS_81({
    ...{ 'onClick': {} },
    variant: "danger",
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}));
const __VLS_83 = __VLS_82({
    ...{ 'onClick': {} },
    variant: "danger",
    disabled: (!__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}, ...__VLS_functionalComponentArgsRest(__VLS_82));
let __VLS_86;
const __VLS_87 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.rsvp('no');
            // @ts-ignore
            [selectedEvent, selectedEvent, rsvp,];
        } });
const { default: __VLS_88 } = __VLS_84.slots;
// @ts-ignore
[];
var __VLS_84;
var __VLS_85;
if (__VLS_ctx.selectedEvent) {
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
}
if (__VLS_ctx.selectedEvent) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (__VLS_ctx.selectedTotal);
}
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
    ...{ class: "mt-1 text-xs text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.createEvent) },
    ...{ class: "mt-3 grid gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_89 = UiInput;
// @ts-ignore
const __VLS_90 = __VLS_asFunctionalComponent1(__VLS_89, new __VLS_89({
    modelValue: (__VLS_ctx.formTitle),
    placeholder: "Event title",
}));
const __VLS_91 = __VLS_90({
    modelValue: (__VLS_ctx.formTitle),
    placeholder: "Event title",
}, ...__VLS_functionalComponentArgsRest(__VLS_90));
const __VLS_94 = UiInput;
// @ts-ignore
const __VLS_95 = __VLS_asFunctionalComponent1(__VLS_94, new __VLS_94({
    modelValue: (__VLS_ctx.formDescription),
    placeholder: "Description",
}));
const __VLS_96 = __VLS_95({
    modelValue: (__VLS_ctx.formDescription),
    placeholder: "Description",
}, ...__VLS_functionalComponentArgsRest(__VLS_95));
const __VLS_99 = UiInput;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
    modelValue: (__VLS_ctx.formLocation),
    placeholder: "Location",
}));
const __VLS_101 = __VLS_100({
    modelValue: (__VLS_ctx.formLocation),
    placeholder: "Location",
}, ...__VLS_functionalComponentArgsRest(__VLS_100));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_104 = UiInput;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
    modelValue: (__VLS_ctx.formStartsAt),
    type: "datetime-local",
}));
const __VLS_106 = __VLS_105({
    modelValue: (__VLS_ctx.formStartsAt),
    type: "datetime-local",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
const __VLS_109 = UiInput;
// @ts-ignore
const __VLS_110 = __VLS_asFunctionalComponent1(__VLS_109, new __VLS_109({
    modelValue: (__VLS_ctx.formEndsAt),
    type: "datetime-local",
}));
const __VLS_111 = __VLS_110({
    modelValue: (__VLS_ctx.formEndsAt),
    type: "datetime-local",
}, ...__VLS_functionalComponentArgsRest(__VLS_110));
const __VLS_114 = UiSelect;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent1(__VLS_114, new __VLS_114({
    modelValue: (__VLS_ctx.formVisibility),
    options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
}));
const __VLS_116 = __VLS_115({
    modelValue: (__VLS_ctx.formVisibility),
    options: ([{ label: 'Tenant-wide', value: 'tenant' }, { label: 'Audience filtered', value: 'audience' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
if (__VLS_ctx.formVisibility === 'audience') {
    const __VLS_119 = UiSelect;
    // @ts-ignore
    const __VLS_120 = __VLS_asFunctionalComponent1(__VLS_119, new __VLS_119({
        modelValue: (__VLS_ctx.formAudienceMemberType),
        options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
    }));
    const __VLS_121 = __VLS_120({
        modelValue: (__VLS_ctx.formAudienceMemberType),
        options: ([{ label: 'Any member type', value: 'all' }, { label: 'Cadets', value: 'CADET' }, { label: 'Seniors', value: 'SENIOR' }, { label: 'Unknown', value: 'UNKNOWN' }]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_120));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_124 = UiButton || UiButton;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent1(__VLS_124, new __VLS_124({
    type: "submit",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.formTitle || !__VLS_ctx.formStartsAt || !__VLS_ctx.formEndsAt),
}));
const __VLS_126 = __VLS_125({
    type: "submit",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.formTitle || !__VLS_ctx.formStartsAt || !__VLS_ctx.formEndsAt),
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
const { default: __VLS_129 } = __VLS_127.slots;
(__VLS_ctx.saving ? 'Saving...' : 'Create event');
// @ts-ignore
[selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedTotal, createEvent, formTitle, formTitle, formDescription, formLocation, formStartsAt, formStartsAt, formEndsAt, formEndsAt, formVisibility, formVisibility, formAudienceMemberType, saving, saving,];
var __VLS_127;
const __VLS_130 = UiButton || UiButton;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({
    ...{ 'onClick': {} },
    variant: "secondary",
    type: "button",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.selectedEvent),
}));
const __VLS_132 = __VLS_131({
    ...{ 'onClick': {} },
    variant: "secondary",
    type: "button",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.selectedEvent),
}, ...__VLS_functionalComponentArgsRest(__VLS_131));
let __VLS_135;
const __VLS_136 = ({ click: {} },
    { onClick: (__VLS_ctx.saveSelectedEvent) });
const { default: __VLS_137 } = __VLS_133.slots;
// @ts-ignore
[selectedEvent, saving, saveSelectedEvent,];
var __VLS_133;
var __VLS_134;
const __VLS_138 = UiButton || UiButton;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent1(__VLS_138, new __VLS_138({
    ...{ 'onClick': {} },
    variant: "danger",
    type: "button",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}));
const __VLS_140 = __VLS_139({
    ...{ 'onClick': {} },
    variant: "danger",
    type: "button",
    disabled: (__VLS_ctx.saving || !__VLS_ctx.selectedEvent || __VLS_ctx.selectedEvent.isCancelled),
}, ...__VLS_functionalComponentArgsRest(__VLS_139));
let __VLS_143;
const __VLS_144 = ({ click: {} },
    { onClick: (__VLS_ctx.cancelSelectedEvent) });
const { default: __VLS_145 } = __VLS_141.slots;
// @ts-ignore
[selectedEvent, selectedEvent, saving, cancelSelectedEvent,];
var __VLS_141;
var __VLS_142;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.selectedEvent.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.selectedEvent.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.selectedEvent.endsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.selectedEvent.location ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.selectedEvent.visibility);
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
// @ts-ignore
[formatDateTime, formatDateTime, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, selectedEvent, actionMessage, actionMessage,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
