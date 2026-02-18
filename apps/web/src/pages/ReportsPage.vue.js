import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTable from '@/components/ui/UiTable.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
import { formatRankDisplay } from '@/utils/rank-display';
const { selectedTenantSlug } = useSession();
const reportType = ref('next-promotion-needs');
const query = ref('');
const includeReady = ref('false');
const page = ref(1);
const pageSize = ref('100');
const total = ref(0);
const items = ref([]);
const sortBy = ref('memberName');
const sortDir = ref('asc');
const loadReport = async () => {
    if (!selectedTenantSlug.value)
        return;
    const params = {
        page: String(page.value),
        pageSize: pageSize.value,
        inactive: 'false',
        sortBy: sortBy.value,
        sortDir: sortDir.value
    };
    if (query.value.trim())
        params.search = query.value.trim();
    if (includeReady.value === 'false')
        params.ready = 'false';
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
    loadReport();
};
const sortLabel = (column) => {
    if (sortBy.value !== column)
        return '';
    return sortDir.value === 'asc' ? ' ▲' : ' ▼';
};
const needsFor = (row) => row.needs ?? [];
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const exportPdf = () => {
    const generatedAt = new Date().toLocaleString();
    const rowsHtml = items.value
        .map((row) => {
        const needs = needsFor(row);
        const needsText = needs.length ? needs.join('; ') : 'No blockers found';
        return `
        <tr>
          <td>${escapeHtml(row.memberName ?? 'Unknown cadet')}</td>
          <td>${escapeHtml(formatRankDisplay(row.rank))}</td>
          <td>${escapeHtml(row.capid)}</td>
          <td>${escapeHtml(row.achievementName ?? '—')}</td>
          <td>${escapeHtml(needsText)}</td>
        </tr>
      `;
    })
        .join('');
    const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Cadet Promotion Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
          h1 { margin: 0 0 8px 0; font-size: 22px; }
          .meta { margin-bottom: 16px; color: #444; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; font-size: 12px; text-align: left; word-wrap: break-word; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Cadet Next Promotion Needs</h1>
        <div class="meta">
          <div>Generated: ${escapeHtml(generatedAt)}</div>
          <div>Search: ${escapeHtml(query.value.trim() || 'None')}</div>
          <div>Ready filter: ${escapeHtml(includeReady.value === 'false' ? 'Not-ready only' : 'All active cadets')}</div>
          <div>Rows on page: ${escapeHtml(String(items.value.length))} of ${escapeHtml(String(total.value))}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Rank</th>
              <th>CAPID</th>
              <th>Next Achievement</th>
              <th>Needs for Next Promotion</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || '<tr><td colspan="5">No cadets matched your report filters.</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `;
    const popup = window.open('', '_blank', 'width=1100,height=850');
    if (!popup)
        return;
    try {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.onload = () => popup.print();
        window.setTimeout(() => {
            if (!popup.closed) {
                popup.print();
            }
        }, 400);
    }
    catch {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
};
const readyCount = computed(() => items.value.filter((row) => row.ready).length);
watch([selectedTenantSlug, query, includeReady, reportType], () => {
    page.value = 1;
    loadReport();
});
watch([page, pageSize], loadReport);
onMounted(loadReport);
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
    title: "Reports",
    subtitle: "Operational reporting for cadets and staff",
}));
const __VLS_2 = __VLS_1({
    title: "Reports",
    subtitle: "Operational reporting for cadets and staff",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 grid gap-3 md:grid-cols-5" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-5']} */ ;
const __VLS_5 = UiSelect;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.reportType),
    options: ([{ label: 'Cadet next promotion needs', value: 'next-promotion-needs' }]),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.reportType),
    options: ([{ label: 'Cadet next promotion needs', value: 'next-promotion-needs' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = UiInput;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search name, CAPID, rank, achievement",
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.query),
    placeholder: "Search name, CAPID, rank, achievement",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = UiSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.includeReady),
    options: ([{ label: 'Show not-ready only', value: 'false' }, { label: 'Show all active cadets', value: 'true' }]),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.includeReady),
    options: ([{ label: 'Show not-ready only', value: 'false' }, { label: 'Show all active cadets', value: 'true' }]),
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
    { onClick: (__VLS_ctx.loadReport) });
const { default: __VLS_27 } = __VLS_23.slots;
// @ts-ignore
[reportType, query, includeReady, loadReport,];
var __VLS_23;
var __VLS_24;
const __VLS_28 = UiButton || UiButton;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    variant: "secondary",
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = ({ click: {} },
    { onClick: (__VLS_ctx.exportPdf) });
const { default: __VLS_35 } = __VLS_31.slots;
// @ts-ignore
[exportPdf,];
var __VLS_31;
var __VLS_32;
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
    ...{ class: "mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-indigo-400']} */ ;
(__VLS_ctx.total);
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
    ...{ class: "mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-amber-400']} */ ;
(Math.max(0, __VLS_ctx.items.length - __VLS_ctx.readyCount));
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
    (__VLS_ctx.formatRankDisplay(row.rank));
    (row.capid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-slate-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-100']} */ ;
    (row.ready ? 'Ready' : 'Needs items');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (row.achievementName ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "mt-1 list-disc pl-5 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    if (__VLS_ctx.needsFor(row).length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [need] of __VLS_vFor((__VLS_ctx.needsFor(row)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${row.id}-${need}`),
        });
        (need);
        // @ts-ignore
        [total, readyCount, readyCount, items, items, formatRankDisplay, needsFor, needsFor,];
    }
    // @ts-ignore
    [];
}
if (__VLS_ctx.items.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card text-sm text-slate-500 dark:text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
}
const __VLS_36 = UiTable || UiTable;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    ...{ class: "hidden md:block" },
}));
const __VLS_38 = __VLS_37({
    ...{ class: "hidden md:block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:block']} */ ;
const { default: __VLS_41 } = __VLS_39.slots;
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
            [items, toggleSort,];
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
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [row] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (row.id),
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
    (__VLS_ctx.formatRankDisplay(row.rank));
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "list-disc pl-5 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    if (__VLS_ctx.needsFor(row).length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    for (const [need] of __VLS_vFor((__VLS_ctx.needsFor(row)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${row.id}-${need}`),
        });
        (need);
        // @ts-ignore
        [items, formatRankDisplay, needsFor, needsFor, sortLabel,];
    }
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
        colspan: "5",
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
var __VLS_39;
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
const __VLS_42 = UiSelect;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}));
const __VLS_44 = __VLS_43({
    modelValue: (__VLS_ctx.pageSize),
    options: ([{ label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }, { label: '200 / page', value: '200' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
const __VLS_47 = UiButton || UiButton;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}));
const __VLS_49 = __VLS_48({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page <= 1),
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
let __VLS_52;
const __VLS_53 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = Math.max(1, __VLS_ctx.page - 1);
            // @ts-ignore
            [total, items, pageSize, page, page, page,];
        } });
const { default: __VLS_54 } = __VLS_50.slots;
// @ts-ignore
[];
var __VLS_50;
var __VLS_51;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "px-2" },
});
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
(__VLS_ctx.page);
const __VLS_55 = UiButton || UiButton;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}));
const __VLS_57 = __VLS_56({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.page * Number(__VLS_ctx.pageSize) >= __VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
const __VLS_61 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.page = __VLS_ctx.page + 1;
            // @ts-ignore
            [total, pageSize, page, page, page, page,];
        } });
const { default: __VLS_62 } = __VLS_58.slots;
// @ts-ignore
[];
var __VLS_58;
var __VLS_59;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
