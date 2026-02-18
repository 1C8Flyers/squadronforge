import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const saving = ref(false);
const runningSync = ref(false);
const actionMessage = ref('');
const syncRuns = ref([]);
const selectedRunId = ref('');
const activeTab = ref('settings');
const queuedAt = ref(null);
let pollHandle = null;
const { selectedTenantSlug } = useSession();
const route = useRoute();
const router = useRouter();
const latestRun = computed(() => syncRuns.value[0] ?? null);
const selectedRun = computed(() => syncRuns.value.find((run) => run.id === selectedRunId.value) ?? latestRun.value);
const selectedDuration = computed(() => {
    if (!selectedRun.value?.finishedAt)
        return 'In progress';
    const ms = new Date(selectedRun.value.finishedAt).getTime() - new Date(selectedRun.value.startedAt).getTime();
    if (ms < 0)
        return 'n/a';
    return `${Math.round(ms / 1000)}s`;
});
const latestRunStage = computed(() => {
    const raw = latestRun.value?.fileListJson?.stage;
    return typeof raw === 'string' ? raw : latestRun.value?.status ?? 'idle';
});
const stageLabel = computed(() => {
    const stage = latestRunStage.value;
    const labels = {
        queued: 'Queued',
        downloading: 'Downloading CAPWATCH ZIP',
        extracting: 'Extracting ZIP',
        parsing: 'Parsing files',
        importing: 'Importing members',
        running: 'Running',
        success: 'Completed',
        failed: 'Failed'
    };
    return labels[stage] ?? 'Running';
});
const progressPercent = computed(() => {
    const stage = latestRunStage.value;
    const map = {
        queued: 10,
        downloading: 25,
        extracting: 45,
        parsing: 65,
        importing: 85,
        running: 60,
        success: 100,
        failed: 100
    };
    return map[stage] ?? 0;
});
const progressBarClass = computed(() => {
    if (latestRun.value?.status === 'failed')
        return 'bg-rose-500';
    if (latestRun.value?.status === 'success')
        return 'bg-emerald-500';
    return 'bg-indigo-500';
});
const latestRunStartedLabel = computed(() => {
    const date = latestRun.value?.startedAt;
    return date ? new Date(date).toLocaleString() : 'n/a';
});
const shouldPoll = computed(() => latestRun.value?.status === 'running' || runningSync.value);
const activeTabFromRoute = () => (route.query.tab === 'sync-log' ? 'sync-log' : 'settings');
const cronHumanized = computed(() => {
    const value = cron.value.trim();
    const parts = value.split(/\s+/);
    if (parts.length !== 5) {
        return 'Enter a 5-part cron expression (minute hour day month weekday).';
    }
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (minute === '0' && /^\*\/\d+$/.test(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const interval = hour.split('/')[1];
        return `Every ${interval} hours at minute 00.`;
    }
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}.`;
    }
    if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Every minute.';
    }
    return 'Custom schedule. Runs in the tenant timezone.';
});
const stopPolling = () => {
    if (pollHandle) {
        clearInterval(pollHandle);
        pollHandle = null;
    }
};
const startPolling = () => {
    if (pollHandle)
        return;
    pollHandle = setInterval(async () => {
        await loadSyncRuns();
    }, 3000);
};
const loadSyncRuns = async () => {
    if (!selectedTenantSlug.value) {
        syncRuns.value = [];
        return;
    }
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/sync-runs`);
    const runs = data;
    syncRuns.value = runs;
    if (!selectedRunId.value && runs.length > 0) {
        selectedRunId.value = runs[0].id;
    }
    if (selectedRunId.value && !runs.some((run) => run.id === selectedRunId.value) && runs.length > 0) {
        selectedRunId.value = runs[0].id;
    }
    if (queuedAt.value) {
        const queuedRun = runs.find((run) => new Date(run.startedAt).getTime() >= queuedAt.value - 1000);
        if (queuedRun) {
            selectedRunId.value = queuedRun.id;
        }
    }
    if (latestRun.value?.status !== 'running') {
        runningSync.value = false;
        if (!shouldPoll.value) {
            stopPolling();
        }
    }
};
const loadSettings = async () => {
    if (!selectedTenantSlug.value)
        return;
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/settings`);
    orgid.value = String(data.orgid);
    unitOnly.value = data.unitOnly ? '1' : '0';
    timezone.value = data.timezone;
    cron.value = data.syncScheduleCron;
};
const saveSettings = async () => {
    if (!selectedTenantSlug.value)
        return;
    saving.value = true;
    actionMessage.value = '';
    try {
        await api.patch(`/tenant/${selectedTenantSlug.value}/settings`, {
            orgid: Number(orgid.value),
            unitOnly: unitOnly.value === '1',
            timezone: timezone.value,
            syncScheduleCron: cron.value
        });
        actionMessage.value = 'Settings saved.';
    }
    finally {
        saving.value = false;
    }
};
const pullNow = async () => {
    if (!selectedTenantSlug.value)
        return;
    runningSync.value = true;
    queuedAt.value = Date.now();
    actionMessage.value = '';
    try {
        await api.post(`/tenant/${selectedTenantSlug.value}/sync-now`);
        actionMessage.value = 'CAPWATCH pull queued. Check Sync Log for progress.';
        await loadSyncRuns();
        startPolling();
    }
    finally {
        runningSync.value = false;
    }
};
watch(selectedTenantSlug, async () => {
    stopPolling();
    queuedAt.value = null;
    await loadSettings();
    await loadSyncRuns();
    if (latestRun.value?.status === 'running') {
        startPolling();
    }
});
watch(() => route.query.tab, () => {
    activeTab.value = activeTabFromRoute();
});
watch(activeTab, (tab) => {
    const nextQuery = { ...route.query };
    if (tab === 'sync-log') {
        nextQuery.tab = 'sync-log';
    }
    else {
        delete nextQuery.tab;
    }
    router.replace({ query: nextQuery });
});
watch(shouldPoll, (value) => {
    if (value)
        startPolling();
    else
        stopPolling();
});
onMounted(async () => {
    activeTab.value = activeTabFromRoute();
    await loadSettings();
    await loadSyncRuns();
    if (latestRun.value?.status === 'running') {
        startPolling();
    }
});
onUnmounted(() => {
    stopPolling();
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
    title: "Tenant Settings",
    subtitle: "Sync schedule and pull controls",
}));
const __VLS_2 = __VLS_1({
    title: "Tenant Settings",
    subtitle: "Sync schedule and pull controls",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_5 = UiButton || UiButton;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onClick': {} },
    variant: (__VLS_ctx.activeTab === 'settings' ? 'primary' : 'secondary'),
}));
const __VLS_7 = __VLS_6({
    ...{ 'onClick': {} },
    variant: (__VLS_ctx.activeTab === 'settings' ? 'primary' : 'secondary'),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'settings';
            // @ts-ignore
            [activeTab, activeTab,];
        } });
const { default: __VLS_12 } = __VLS_8.slots;
// @ts-ignore
[];
var __VLS_8;
var __VLS_9;
const __VLS_13 = UiButton || UiButton;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
    ...{ 'onClick': {} },
    variant: (__VLS_ctx.activeTab === 'sync-log' ? 'primary' : 'secondary'),
}));
const __VLS_15 = __VLS_14({
    ...{ 'onClick': {} },
    variant: (__VLS_ctx.activeTab === 'sync-log' ? 'primary' : 'secondary'),
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
let __VLS_18;
const __VLS_19 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'sync-log';
            // @ts-ignore
            [activeTab, activeTab,];
        } });
const { default: __VLS_20 } = __VLS_16.slots;
// @ts-ignore
[];
var __VLS_16;
var __VLS_17;
if (__VLS_ctx.activeTab === 'settings') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.saveSettings) },
        ...{ class: "card grid gap-4 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const __VLS_21 = UiInput;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        modelValue: (__VLS_ctx.orgid),
    }));
    const __VLS_23 = __VLS_22({
        modelValue: (__VLS_ctx.orgid),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const __VLS_26 = UiSelect;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
        modelValue: (__VLS_ctx.unitOnly),
        options: ([{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }]),
    }));
    const __VLS_28 = __VLS_27({
        modelValue: (__VLS_ctx.unitOnly),
        options: ([{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const __VLS_31 = UiInput;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        modelValue: (__VLS_ctx.timezone),
    }));
    const __VLS_33 = __VLS_32({
        modelValue: (__VLS_ctx.timezone),
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mb-1 block text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const __VLS_36 = UiInput;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        modelValue: (__VLS_ctx.cron),
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (__VLS_ctx.cron),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.cronHumanized);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex flex-wrap items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    const __VLS_41 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        type: "submit",
        disabled: (__VLS_ctx.saving),
    }));
    const __VLS_43 = __VLS_42({
        type: "submit",
        disabled: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    const { default: __VLS_46 } = __VLS_44.slots;
    (__VLS_ctx.saving ? 'Saving...' : 'Save settings');
    // @ts-ignore
    [activeTab, saveSettings, orgid, unitOnly, timezone, cron, cronHumanized, saving, saving,];
    var __VLS_44;
    const __VLS_47 = UiButton || UiButton;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (__VLS_ctx.runningSync),
    }));
    const __VLS_49 = __VLS_48({
        ...{ 'onClick': {} },
        variant: "secondary",
        disabled: (__VLS_ctx.runningSync),
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    let __VLS_52;
    const __VLS_53 = ({ click: {} },
        { onClick: (__VLS_ctx.pullNow) });
    const { default: __VLS_54 } = __VLS_50.slots;
    (__VLS_ctx.runningSync ? 'Queueing...' : 'Pull now');
    // @ts-ignore
    [runningSync, runningSync, pullNow,];
    var __VLS_50;
    var __VLS_51;
    if (__VLS_ctx.actionMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.actionMessage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "card mt-4" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    if (__VLS_ctx.latestRun) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-3 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.stageLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.latestRunStartedLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" },
        });
        /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-slate-800']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "h-full transition-all duration-500" },
            ...{ class: (__VLS_ctx.progressBarClass) },
            ...{ style: ({ width: `${__VLS_ctx.progressPercent}%` }) },
        });
        /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['duration-500']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-2 text-slate-600 dark:text-slate-300 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.latestRun.membersUpserted);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.latestRun.membersActive);
        if (__VLS_ctx.latestRun.errorMessage) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-rose-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-rose-50']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-rose-700']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:border-rose-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:bg-rose-900/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-rose-300']} */ ;
            (__VLS_ctx.latestRun.errorMessage);
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-3 text-sm text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "grid gap-4 lg:grid-cols-[1.3fr_1fr]" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:grid-cols-[1.3fr_1fr]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
    for (const [run] of __VLS_vFor((__VLS_ctx.syncRuns))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeTab === 'settings'))
                        return;
                    __VLS_ctx.selectedRunId = run.id;
                    // @ts-ignore
                    [actionMessage, actionMessage, latestRun, latestRun, latestRun, latestRun, latestRun, stageLabel, latestRunStartedLabel, progressBarClass, progressPercent, syncRuns, selectedRunId,];
                } },
            key: (`mobile-${run.id}`),
            ...{ class: "card text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (new Date(run.startedAt).toLocaleString());
        const __VLS_55 = UiBadge || UiBadge;
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
            tone: (run.status === 'success' ? 'success' : 'warn'),
        }));
        const __VLS_57 = __VLS_56({
            tone: (run.status === 'success' ? 'success' : 'warn'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        const { default: __VLS_60 } = __VLS_58.slots;
        (run.status);
        // @ts-ignore
        [];
        var __VLS_58;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 text-sm text-slate-600 dark:text-slate-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
        (run.membersUpserted);
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.syncRuns.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "card text-sm text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "table-shell hidden overflow-hidden md:block" },
    });
    /** @type {__VLS_StyleScopedClasses['table-shell']} */ ;
    /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "min-w-full text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [run] of __VLS_vFor((__VLS_ctx.syncRuns))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (run.id),
            ...{ class: "border-t border-slate-200 dark:border-slate-800" },
        });
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeTab === 'settings'))
                        return;
                    __VLS_ctx.selectedRunId = run.id;
                    // @ts-ignore
                    [syncRuns, syncRuns, selectedRunId,];
                } },
            ...{ class: "text-left hover:underline" },
        });
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
        (new Date(run.startedAt).toLocaleString());
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        const __VLS_61 = UiBadge || UiBadge;
        // @ts-ignore
        const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
            tone: (run.status === 'success' ? 'success' : 'warn'),
        }));
        const __VLS_63 = __VLS_62({
            tone: (run.status === 'success' ? 'success' : 'warn'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_62));
        const { default: __VLS_66 } = __VLS_64.slots;
        (run.status);
        // @ts-ignore
        [];
        var __VLS_64;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        (run.membersUpserted);
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.syncRuns.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ class: "border-t border-slate-200 dark:border-slate-800" },
        });
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "3",
            ...{ class: "px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    if (__VLS_ctx.selectedRun) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (new Date(__VLS_ctx.selectedRun.startedAt).toLocaleString());
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.selectedRun.finishedAt ? new Date(__VLS_ctx.selectedRun.finishedAt).toLocaleString() : 'Running');
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.selectedDuration);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.selectedRun.membersActive);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.selectedRun.checksum ?? 'n/a');
        if (__VLS_ctx.selectedRun.errorMessage) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-rose-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-rose-50']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-rose-700']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:border-rose-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:bg-rose-900/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-rose-300']} */ ;
            (__VLS_ctx.selectedRun.errorMessage);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mb-1 font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "max-h-64 overflow-auto rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-800" },
        });
        /** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-slate-800']} */ ;
        (JSON.stringify(__VLS_ctx.selectedRun.fileListJson, null, 2));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-3 text-sm text-slate-500 dark:text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-slate-400']} */ ;
    }
}
// @ts-ignore
[syncRuns, selectedRun, selectedRun, selectedRun, selectedRun, selectedRun, selectedRun, selectedRun, selectedRun, selectedRun, selectedDuration,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
