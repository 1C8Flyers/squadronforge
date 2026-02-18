import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const { selectedTenantSlug } = useSession();
const query = ref('');
const ready = ref('all');
const inactive = ref('all');
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref('50');
const readyCount = ref(0);
const inactiveCount = ref(0);
const sortBy = ref('memberName');
const sortDir = ref('asc');
const expandedNeedId = ref(null);
const loadCadetPromotions = async () => {
    if (!selectedTenantSlug.value)
        return;
    const params = {
        page: String(page.value),
        pageSize: pageSize.value,
        sortBy: sortBy.value,
        sortDir: sortDir.value
    };
    if (query.value.trim())
        params.search = query.value.trim();
    if (ready.value !== 'all')
        params.ready = ready.value;
    if (inactive.value !== 'all')
        params.inactive = inactive.value;
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/cadet-promotions`, { params });
    items.value = data.items;
    total.value = data.total;
    readyCount.value = data.summary?.readyCount ?? 0;
    inactiveCount.value = data.summary?.inactiveCount ?? 0;
};
const toggleSort = (column) => {
    if (sortBy.value === column) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    }
    else {
        sortBy.value = column;
        sortDir.value = 'asc';
    }
    page.value = 1;
    loadCadetPromotions();
};
const sortLabel = (column) => {
    if (sortBy.value !== column)
        return '';
    return sortDir.value === 'asc' ? ' ▲' : ' ▼';
};
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const rowStatusText = (row) => {
    if (row.inactive)
        return 'Inactive';
    if (isChecklistReady(row))
        return 'Ready';
    return 'Pending';
};
const rowStatusTone = (row) => {
    if (row.inactive)
        return 'warn';
    if (isChecklistReady(row))
        return 'success';
    return 'neutral';
};
const readyDisplay = (row) => {
    if (!isChecklistReady(row)) {
        return 'No';
    }
    const raw = row.readyStatus?.trim();
    if (raw && raw.length > 0) {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        }
        return raw;
    }
    return 'Yes';
};
const readyTone = (row) => {
    const value = readyDisplay(row).toLowerCase();
    if (value === 'yes')
        return 'success';
    if (value === 'no')
        return 'neutral';
    return 'success';
};
const normalizeStatus = (value) => (value ?? '').trim();
const statusDone = (value) => {
    const v = normalizeStatus(value).toUpperCase();
    return v.length > 0 && v !== 'WC';
};
const isSdaRequired = (row) => normalizeStatus(row.sdaStatus).toUpperCase() !== 'N/A';
const checkProgress = (row) => {
    const required = [row.ptStatus, row.leadStatus, row.aeStatus, row.drillStatus, row.cdStatus];
    if (isSdaRequired(row)) {
        required.push(row.sdaStatus);
    }
    const done = required.filter((status) => statusDone(status)).length;
    return { done, total: required.length };
};
const needsList = (row) => {
    const needs = [];
    if (!normalizeStatus(row.ptStatus)) {
        needs.push('CPFT within last 182 days');
    }
    const lead = normalizeStatus(row.leadStatus).toUpperCase();
    if (!lead) {
        needs.push('Leadership: test and interactive module');
    }
    else if (lead === 'X') {
        if (!row.leadershipTestCompleted)
            needs.push('Leadership: complete leadership test');
        if (!row.leadershipModuleCompleted)
            needs.push('Leadership: complete interactive module');
    }
    const ae = normalizeStatus(row.aeStatus).toUpperCase();
    if (!ae) {
        needs.push('Aerospace: test and interactive module');
    }
    else if (ae === 'X') {
        if (row.aeTestCompleted !== true)
            needs.push('Aerospace: complete AE test');
        if (row.aeModuleCompleted !== true)
            needs.push('Aerospace: complete interactive module');
    }
    if (!normalizeStatus(row.drillStatus)) {
        needs.push('Drill test');
    }
    const cd = normalizeStatus(row.cdStatus).toUpperCase();
    if (cd === 'WC') {
        needs.push('Welcome Course');
    }
    else if (!cd) {
        needs.push('Character Development forum');
    }
    if (isSdaRequired(row) && !normalizeStatus(row.sdaStatus)) {
        needs.push('Staff Duty Analysis (SDA)');
    }
    return needs;
};
const completedList = (row) => {
    const completed = [];
    if (statusDone(row.ptStatus)) {
        completed.push('PT complete');
    }
    const lead = normalizeStatus(row.leadStatus).toUpperCase();
    if (lead === '★') {
        completed.push('Leadership complete');
    }
    else if (lead === 'X') {
        if (row.leadershipTestCompleted)
            completed.push('Leadership test complete');
        if (row.leadershipModuleCompleted)
            completed.push('Leadership interactive module complete');
    }
    const ae = normalizeStatus(row.aeStatus).toUpperCase();
    if (ae === '★') {
        completed.push('Aerospace complete');
    }
    else if (ae === 'X') {
        if (row.aeTestCompleted === true)
            completed.push('Aerospace AE test complete');
        if (row.aeModuleCompleted === true)
            completed.push('Aerospace interactive module complete');
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
    }
    else if (statusDone(row.sdaStatus)) {
        completed.push('SDA complete');
    }
    return completed;
};
function isChecklistReady(row) {
    return !row.inactive && needsList(row).length === 0;
}
const toggleNeeds = (id) => {
    expandedNeedId.value = expandedNeedId.value === id ? null : id;
};
const pendingCount = computed(() => Math.max(0, total.value - readyCount.value - inactiveCount.value));
watch([selectedTenantSlug, query, ready, inactive], () => {
    page.value = 1;
    loadCadetPromotions();
});
watch([page, pageSize], loadCadetPromotions);
onMounted(loadCadetPromotions);
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
    title: "Cadet Promotions",
    subtitle: "Track achievement readiness and promotion blockers",
}));
const __VLS_2 = __VLS_1({
    title: "Cadet Promotions",
    subtitle: "Track achievement readiness and promotion blockers",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 grid gap-3 md:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
const __VLS_5 = UiInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search name, CAPID, rank, achievement",
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search name, CAPID, rank, achievement",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = UiSelect;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.ready),
    options: ([
        { label: 'Ready + Not Ready', value: 'all' },
        { label: 'Ready only', value: 'true' },
        { label: 'Not ready only', value: 'false' }
    ]),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.ready),
    options: ([
        { label: 'Ready + Not Ready', value: 'all' },
        { label: 'Ready only', value: 'true' },
        { label: 'Not ready only', value: 'false' }
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = UiSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.inactive),
    options: ([
        { label: 'Active + Inactive', value: 'all' },
        { label: 'Active only', value: 'false' },
        { label: 'Inactive only', value: 'true' }
    ]),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.inactive),
    options: ([
        { label: 'Active + Inactive', value: 'all' },
        { label: 'Active only', value: 'false' },
        { label: 'Inactive only', value: 'true' }
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_20 = UiButton || UiButton;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
const __VLS_26 = ({ click: {} },
    { onClick: (__VLS_ctx.loadCadetPromotions) });
const { default: __VLS_27 } = __VLS_23.slots;
// @ts-ignore
[query, ready, inactive, loadCadetPromotions,];
var __VLS_23;
var __VLS_24;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 grid gap-3 sm:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-emerald-400']} */ ;
(__VLS_ctx.readyCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-indigo-400']} */ ;
(__VLS_ctx.pendingCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-amber-400']} */ ;
(__VLS_ctx.inactiveCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
for (const [row] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (row.id),
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (row.memberName ?? 'Unknown cadet');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (row.rank ?? '—');
    (row.capid);
    const __VLS_28 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        tone: (__VLS_ctx.rowStatusTone(row)),
    }));
    const __VLS_30 = __VLS_29({
        tone: (__VLS_ctx.rowStatusTone(row)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    const { default: __VLS_33 } = __VLS_31.slots;
    (__VLS_ctx.rowStatusText(row));
    // @ts-ignore
    [readyCount, pendingCount, inactiveCount, items, rowStatusTone, rowStatusText,];
    var __VLS_31;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid grid-cols-2 gap-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (row.achievementName ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.formatDate(row.datePromotionEligible));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.formatDate(row.lastPtDate));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (row.comments ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "col-span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "mt-1 list-disc pl-5 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    if (__VLS_ctx.needsList(row).length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [need] of __VLS_vFor((__VLS_ctx.needsList(row)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${row.id}-${need}`),
        });
        (need);
        // @ts-ignore
        [formatDate, formatDate, needsList, needsList,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "mt-1 list-disc pl-5 text-xs text-emerald-700 dark:text-emerald-300" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
    if (__VLS_ctx.completedList(row).length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [done] of __VLS_vFor((__VLS_ctx.completedList(row)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${row.id}-done-${done}`),
        });
        (done);
        // @ts-ignore
        [completedList, completedList,];
    }
    // @ts-ignore
    [];
}
const __VLS_34 = UiTable || UiTable;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    ...{ class: "hidden md:block" },
}));
const __VLS_36 = __VLS_35({
    ...{ class: "hidden md:block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:block']} */ ;
const { default: __VLS_39 } = __VLS_37.slots;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('memberName');
            // @ts-ignore
            [toggleSort,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('memberName'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('rank');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('rank'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('capid');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('capid'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('achievementName');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('achievementName'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('datePromotionEligible');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('datePromotionEligible'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('lastPtDate');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('lastPtDate'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('ready');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('ready'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('inactive');
            // @ts-ignore
            [toggleSort, sortLabel,];
        } },
    ...{ class: "hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
(__VLS_ctx.sortLabel('inactive'));
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
for (const [row] of __VLS_vFor((__VLS_ctx.items))) {
    (row.id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ class: "border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" },
    });
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
    (row.memberName ?? 'Unknown cadet');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (row.rank ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3 font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (row.capid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (row.achievementName ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDate(row.datePromotionEligible));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDate(row.lastPtDate));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_40 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        tone: (__VLS_ctx.readyTone(row)),
    }));
    const __VLS_42 = __VLS_41({
        tone: (__VLS_ctx.readyTone(row)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const { default: __VLS_45 } = __VLS_43.slots;
    (__VLS_ctx.readyDisplay(row));
    // @ts-ignore
    [items, formatDate, formatDate, sortLabel, readyTone, readyDisplay,];
    var __VLS_43;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_46 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        tone: (row.inactive ? 'warn' : 'neutral'),
    }));
    const __VLS_48 = __VLS_47({
        tone: (row.inactive ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    const { default: __VLS_51 } = __VLS_49.slots;
    (row.inactive ? 'Yes' : 'No');
    // @ts-ignore
    [];
    var __VLS_49;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3 text-xs text-slate-600 dark:text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.checkProgress(row).done);
    (__VLS_ctx.checkProgress(row).total);
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
        ...{ class: "px-3 py-1 text-xs" },
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        variant: "secondary",
        ...{ class: "px-3 py-1 text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_57;
    const __VLS_58 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.toggleNeeds(row.id);
                // @ts-ignore
                [checkProgress, checkProgress, toggleNeeds,];
            } });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    const { default: __VLS_59 } = __VLS_55.slots;
    (__VLS_ctx.expandedNeedId === row.id ? 'Hide' : 'What I need');
    // @ts-ignore
    [expandedNeedId,];
    var __VLS_55;
    var __VLS_56;
    if (__VLS_ctx.expandedNeedId === row.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ class: "bg-slate-50/70 dark:bg-slate-900/60" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-slate-50/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-slate-900/60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "10",
            ...{ class: "px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "card p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "mt-2 list-disc pl-5 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
        /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        if (__VLS_ctx.needsList(row).length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        }
        for (const [need] of __VLS_vFor((__VLS_ctx.needsList(row)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (`${row.id}-${need}`),
            });
            (need);
            // @ts-ignore
            [needsList, needsList, expandedNeedId,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-700']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "mt-2 list-disc pl-5 text-sm text-emerald-700 dark:text-emerald-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
        /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-700']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
        if (__VLS_ctx.completedList(row).length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        }
        for (const [done] of __VLS_vFor((__VLS_ctx.completedList(row)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (`${row.id}-done-${done}`),
            });
            (done);
            // @ts-ignore
            [completedList, completedList,];
        }
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_37;
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
const __VLS_60 = UiSelect;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_65 = UiButton || UiButton;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}));
const __VLS_67 = __VLS_66({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
let __VLS_70;
const __VLS_71 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = Math.max(1, __VLS_ctx.page - 1);
            // @ts-ignore
            [items, total, pageSize, page, page, page,];
        } });
const { default: __VLS_72 } = __VLS_68.slots;
// @ts-ignore
[];
var __VLS_68;
var __VLS_69;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "px-2" },
});
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
(__VLS_ctx.page);
const __VLS_73 = UiButton || UiButton;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}));
const __VLS_75 = __VLS_74({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_74));
let __VLS_78;
const __VLS_79 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = __VLS_ctx.page + 1;
            // @ts-ignore
            [total, pageSize, page, page, page, page,];
        } });
const { default: __VLS_80 } = __VLS_76.slots;
// @ts-ignore
[];
var __VLS_76;
var __VLS_77;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
