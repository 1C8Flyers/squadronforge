import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const membershipFilename = ref('');
const dutyPositionFilename = ref('');
const saving = ref(false);
const runningSync = ref(false);
const actionMessage = ref('');
const latestRun = ref(null);
const queuedAt = ref(null);
let pollHandle = null;
const { selectedTenantSlug } = useSession();
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
        await loadLatestRun();
    }, 3000);
};
const loadLatestRun = async () => {
    if (!selectedTenantSlug.value) {
        latestRun.value = null;
        return;
    }
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/sync-runs`);
    const runs = data;
    if (queuedAt.value) {
        const queuedRun = runs.find((run) => new Date(run.startedAt).getTime() >= queuedAt.value - 1000);
        latestRun.value = queuedRun ?? runs[0] ?? null;
    }
    else {
        latestRun.value = runs[0] ?? null;
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
    const fileMapping = (data.fileMappingJson ?? {});
    membershipFilename.value = fileMapping.membership ?? '';
    dutyPositionFilename.value = fileMapping.dutyPosition ?? '';
};
const saveSettings = async () => {
    if (!selectedTenantSlug.value)
        return;
    saving.value = true;
    actionMessage.value = '';
    const fileMappingJson = {};
    if (membershipFilename.value.trim()) {
        fileMappingJson.membership = membershipFilename.value.trim();
    }
    if (dutyPositionFilename.value.trim()) {
        fileMappingJson.dutyPosition = dutyPositionFilename.value.trim();
    }
    try {
        await api.patch(`/tenant/${selectedTenantSlug.value}/settings`, {
            orgid: Number(orgid.value),
            unitOnly: unitOnly.value === '1',
            timezone: timezone.value,
            syncScheduleCron: cron.value,
            fileMappingJson
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
        actionMessage.value = 'CAPWATCH pull queued. Check Sync Runs for progress.';
        await loadLatestRun();
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
    await loadLatestRun();
    if (latestRun.value?.status === 'running') {
        startPolling();
    }
});
watch(shouldPoll, (value) => {
    if (value)
        startPolling();
    else
        stopPolling();
});
onMounted(async () => {
    await loadSettings();
    await loadLatestRun();
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
    subtitle: "Sync schedule and file mapping overrides",
}));
const __VLS_2 = __VLS_1({
    title: "Tenant Settings",
    subtitle: "Sync schedule and file mapping overrides",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
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
const __VLS_5 = UiInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.orgid),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.orgid),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_10 = UiSelect;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.unitOnly),
    options: ([{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }]),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.unitOnly),
    options: ([{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }]),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_15 = UiInput;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.timezone),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.timezone),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_20 = UiInput;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.cron),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.cron),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.cronHumanized);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_25 = UiInput;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    modelValue: (__VLS_ctx.membershipFilename),
    placeholder: "e.g., MbrContact.txt",
}));
const __VLS_27 = __VLS_26({
    modelValue: (__VLS_ctx.membershipFilename),
    placeholder: "e.g., MbrContact.txt",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "mb-1 block text-sm" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_30 = UiInput;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    modelValue: (__VLS_ctx.dutyPositionFilename),
    placeholder: "e.g., DutyPosition.txt",
}));
const __VLS_32 = __VLS_31({
    modelValue: (__VLS_ctx.dutyPositionFilename),
    placeholder: "e.g., DutyPosition.txt",
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "md:col-span-2 flex flex-wrap items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
const __VLS_35 = UiButton || UiButton;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    type: "submit",
    disabled: (__VLS_ctx.saving),
}));
const __VLS_37 = __VLS_36({
    type: "submit",
    disabled: (__VLS_ctx.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
const { default: __VLS_40 } = __VLS_38.slots;
(__VLS_ctx.saving ? 'Saving...' : 'Save settings');
// @ts-ignore
[saveSettings, orgid, unitOnly, timezone, cron, cronHumanized, membershipFilename, dutyPositionFilename, saving, saving,];
var __VLS_38;
const __VLS_41 = UiButton || UiButton;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.runningSync),
}));
const __VLS_43 = __VLS_42({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.runningSync),
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
let __VLS_46;
const __VLS_47 = ({ click: {} },
    { onClick: (__VLS_ctx.pullNow) });
const { default: __VLS_48 } = __VLS_44.slots;
(__VLS_ctx.runningSync ? 'Queueing...' : 'Pull now');
// @ts-ignore
[runningSync, runningSync, pullNow,];
var __VLS_44;
var __VLS_45;
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
// @ts-ignore
[actionMessage, actionMessage, latestRun, latestRun, latestRun, latestRun, latestRun, stageLabel, latestRunStartedLabel, progressBarClass, progressPercent,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
