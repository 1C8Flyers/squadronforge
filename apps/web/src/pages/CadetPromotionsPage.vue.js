import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
import { computePromotion } from '@/lib/promotionLogic';
const { selectedTenantSlug } = useSession();
const query = ref('');
const ready = ref('all');
const inactive = ref('all');
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref('50');
const sortBy = ref('memberName');
const sortDir = ref('asc');
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
    if (inactive.value !== 'all')
        params.inactive = inactive.value;
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/cadet-promotions`, { params });
    items.value = data.items;
    total.value = data.total;
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
const normalizeStatus = (value) => {
    const normalized = (value ?? '').trim();
    return normalized.length > 0 ? normalized : '—';
};
const computedRows = computed(() => items.value.map((row) => {
    const computed = computePromotion(row);
    return {
        row,
        computed
    };
}));
const visibleRows = computed(() => {
    const search = query.value.trim().toLowerCase();
    return computedRows.value.filter(({ row, computed }) => {
        const matchesSearch = !search ||
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
const rowStatusText = (row) => {
    if (row.inactive)
        return 'Inactive';
    if (computePromotion(row).readyComputed)
        return 'Ready';
    return 'Pending';
};
const rowStatusTone = (row) => {
    if (row.inactive)
        return 'warn';
    if (computePromotion(row).readyComputed)
        return 'success';
    return 'neutral';
};
const readyDisplay = (row) => {
    return computePromotion(row).readyComputed ? 'Yes' : 'No';
};
const readyTone = (row) => {
    if (row.inactive)
        return 'neutral';
    return computePromotion(row).readyComputed ? 'success' : 'warn';
};
watch([selectedTenantSlug], () => {
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
for (const [entry] of __VLS_vFor((__VLS_ctx.visibleRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (entry.row.id),
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
    (entry.row.memberName ?? 'Unknown cadet');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    (entry.row.rank ?? '—');
    (entry.row.capid);
    const __VLS_28 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        tone: (__VLS_ctx.rowStatusTone(entry.row)),
    }));
    const __VLS_30 = __VLS_29({
        tone: (__VLS_ctx.rowStatusTone(entry.row)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    const { default: __VLS_33 } = __VLS_31.slots;
    (__VLS_ctx.rowStatusText(entry.row));
    // @ts-ignore
    [readyCount, pendingCount, inactiveCount, visibleRows, rowStatusTone, rowStatusText,];
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
    (entry.row.achievementName ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.formatDate(entry.row.datePromotionEligible));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.formatDate(entry.row.lastPtDate));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "list-disc pl-4 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    if (entry.computed.missingDetails.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [need] of __VLS_vFor((entry.computed.missingDetails))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (need),
        });
        (need);
        // @ts-ignore
        [formatDate, formatDate,];
    }
    // @ts-ignore
    [];
}
const __VLS_34 = UiTable || UiTable;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    ...{ class: "table-shell hidden md:block" },
}));
const __VLS_36 = __VLS_35({
    ...{ class: "table-shell hidden md:block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
/** @type {__VLS_StyleScopedClasses['table-shell']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [entry] of __VLS_vFor((__VLS_ctx.visibleRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (entry.row.id),
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
    (entry.row.memberName ?? 'Unknown cadet');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3 font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (entry.row.capid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (entry.row.rank ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (entry.row.achievementName ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDate(entry.row.datePromotionEligible));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    (__VLS_ctx.formatDate(entry.row.lastPtDate));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_40 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        tone: (__VLS_ctx.readyTone(entry.row)),
    }));
    const __VLS_42 = __VLS_41({
        tone: (__VLS_ctx.readyTone(entry.row)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const { default: __VLS_45 } = __VLS_43.slots;
    (__VLS_ctx.readyDisplay(entry.row));
    // @ts-ignore
    [visibleRows, formatDate, formatDate, sortLabel, readyTone, readyDisplay,];
    var __VLS_43;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3 text-xs text-slate-600 dark:text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "list-disc pl-4" },
    });
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-4']} */ ;
    if (entry.computed.missingDetails.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [need] of __VLS_vFor((entry.computed.missingDetails))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${entry.row.id}-${need}`),
        });
        (need);
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_46 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        tone: (__VLS_ctx.normalizeStatus(entry.row.ptStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_48 = __VLS_47({
        tone: (__VLS_ctx.normalizeStatus(entry.row.ptStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    const { default: __VLS_51 } = __VLS_49.slots;
    (__VLS_ctx.normalizeStatus(entry.row.ptStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus,];
    var __VLS_49;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_52 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        tone: (__VLS_ctx.normalizeStatus(entry.row.leadStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_54 = __VLS_53({
        tone: (__VLS_ctx.normalizeStatus(entry.row.leadStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const { default: __VLS_57 } = __VLS_55.slots;
    (__VLS_ctx.normalizeStatus(entry.row.leadStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus,];
    var __VLS_55;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_58 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_59 = __VLS_asFunctionalComponent1(__VLS_58, new __VLS_58({
        tone: (__VLS_ctx.normalizeStatus(entry.row.aeStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_60 = __VLS_59({
        tone: (__VLS_ctx.normalizeStatus(entry.row.aeStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_59));
    const { default: __VLS_63 } = __VLS_61.slots;
    (__VLS_ctx.normalizeStatus(entry.row.aeStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus,];
    var __VLS_61;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_64 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent1(__VLS_64, new __VLS_64({
        tone: (__VLS_ctx.normalizeStatus(entry.row.drillStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_66 = __VLS_65({
        tone: (__VLS_ctx.normalizeStatus(entry.row.drillStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const { default: __VLS_69 } = __VLS_67.slots;
    (__VLS_ctx.normalizeStatus(entry.row.drillStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus,];
    var __VLS_67;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_70 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
        tone: (__VLS_ctx.normalizeStatus(entry.row.cdStatus) === 'WC' ? 'warn' : __VLS_ctx.normalizeStatus(entry.row.cdStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_72 = __VLS_71({
        tone: (__VLS_ctx.normalizeStatus(entry.row.cdStatus) === 'WC' ? 'warn' : __VLS_ctx.normalizeStatus(entry.row.cdStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    const { default: __VLS_75 } = __VLS_73.slots;
    (__VLS_ctx.normalizeStatus(entry.row.cdStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus, normalizeStatus,];
    var __VLS_73;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_76 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
        tone: (__VLS_ctx.normalizeStatus(entry.row.sdaStatus) === '—' ? 'warn' : 'neutral'),
    }));
    const __VLS_78 = __VLS_77({
        tone: (__VLS_ctx.normalizeStatus(entry.row.sdaStatus) === '—' ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    const { default: __VLS_81 } = __VLS_79.slots;
    (__VLS_ctx.normalizeStatus(entry.row.sdaStatus));
    // @ts-ignore
    [normalizeStatus, normalizeStatus,];
    var __VLS_79;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    const __VLS_82 = UiBadge || UiBadge;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
        tone: (entry.row.inactive ? 'warn' : 'neutral'),
    }));
    const __VLS_84 = __VLS_83({
        tone: (entry.row.inactive ? 'warn' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    const { default: __VLS_87 } = __VLS_85.slots;
    (entry.row.inactive ? 'Yes' : 'No');
    // @ts-ignore
    [];
    var __VLS_85;
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
(__VLS_ctx.visibleRows.length);
(__VLS_ctx.items.length);
(__VLS_ctx.total);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_88 = UiSelect;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
const __VLS_93 = UiButton || UiButton;
// @ts-ignore
const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}));
const __VLS_95 = __VLS_94({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}, ...__VLS_functionalComponentArgsRest(__VLS_94));
let __VLS_98;
const __VLS_99 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = Math.max(1, __VLS_ctx.page - 1);
            // @ts-ignore
            [visibleRows, items, total, pageSize, page, page, page,];
        } });
const { default: __VLS_100 } = __VLS_96.slots;
// @ts-ignore
[];
var __VLS_96;
var __VLS_97;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "px-2" },
});
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
(__VLS_ctx.page);
const __VLS_101 = UiButton || UiButton;
// @ts-ignore
const __VLS_102 = __VLS_asFunctionalComponent1(__VLS_101, new __VLS_101({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}));
const __VLS_103 = __VLS_102({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_102));
let __VLS_106;
const __VLS_107 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = __VLS_ctx.page + 1;
            // @ts-ignore
            [total, pageSize, page, page, page, page,];
        } });
const { default: __VLS_108 } = __VLS_104.slots;
// @ts-ignore
[];
var __VLS_104;
var __VLS_105;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
