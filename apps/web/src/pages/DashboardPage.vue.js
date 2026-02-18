import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const router = useRouter();
const { activeTenant, selectedTenantSlug } = useSession();
const dashboard = ref(null);
const loadDashboard = async () => {
    if (!selectedTenantSlug.value)
        return;
    const { data } = await api.get(`/tenant/${selectedTenantSlug.value}/dashboard`);
    dashboard.value = data;
};
const runSyncNow = async () => {
    if (!selectedTenantSlug.value)
        return;
    await api.post(`/tenant/${selectedTenantSlug.value}/sync-now`);
};
const lastSyncLabel = computed(() => {
    const date = dashboard.value?.lastRun?.startedAt;
    if (!date)
        return 'Never';
    return new Date(date).toLocaleString();
});
const nextRunLabel = computed(() => {
    const date = dashboard.value?.nextRunAt;
    if (!date)
        return 'n/a';
    return new Date(date).toLocaleString();
});
const nextEventStartLabel = computed(() => {
    const date = dashboard.value?.nextEvent?.startsAt;
    if (!date)
        return 'No upcoming events';
    return new Date(date).toLocaleString();
});
const nextEventUniformLabel = computed(() => {
    const value = dashboard.value?.nextEvent?.uniformOfDay;
    if (!value)
        return 'UOD: Not set';
    if (value === 'ABU_OCP')
        return 'UOD: ABU/OCP';
    return `UOD: ${value}`;
});
watch(selectedTenantSlug, () => {
    loadDashboard();
});
onMounted(loadDashboard);
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
    title: "Dashboard",
    subtitle: (__VLS_ctx.activeTenant?.name ?? 'No tenant selected'),
}));
const __VLS_2 = __VLS_1({
    title: "Dashboard",
    subtitle: (__VLS_ctx.activeTenant?.name ?? 'No tenant selected'),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-5" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-5']} */ ;
const __VLS_5 = UiCard || UiCard;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const { default: __VLS_10 } = __VLS_8.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.lastSyncLabel);
// @ts-ignore
[activeTenant, lastSyncLabel,];
var __VLS_8;
const __VLS_11 = UiCard || UiCard;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({}));
const __VLS_13 = __VLS_12({}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_16 } = __VLS_14.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.nextRunLabel);
// @ts-ignore
[nextRunLabel,];
var __VLS_14;
const __VLS_17 = UiCard || UiCard;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({}));
const __VLS_19 = __VLS_18({}, ...__VLS_functionalComponentArgsRest(__VLS_18));
const { default: __VLS_22 } = __VLS_20.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.dashboard?.memberCount ?? 0);
// @ts-ignore
[dashboard,];
var __VLS_20;
const __VLS_23 = UiCard || UiCard;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({}));
const __VLS_25 = __VLS_24({}, ...__VLS_functionalComponentArgsRest(__VLS_24));
const { default: __VLS_28 } = __VLS_26.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.dashboard?.activeCount ?? 0);
// @ts-ignore
[dashboard,];
var __VLS_26;
const __VLS_29 = UiCard || UiCard;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({}));
const __VLS_31 = __VLS_30({}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const { default: __VLS_34 } = __VLS_32.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-base font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.dashboard?.nextEvent?.title ?? 'No upcoming events');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.nextEventStartLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.nextEventUniformLabel);
// @ts-ignore
[dashboard, nextEventStartLabel, nextEventUniformLabel,];
var __VLS_32;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "mt-6 card" },
});
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex flex-wrap gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
const __VLS_35 = UiButton || UiButton;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    ...{ 'onClick': {} },
}));
const __VLS_37 = __VLS_36({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
let __VLS_40;
const __VLS_41 = ({ click: {} },
    { onClick: (__VLS_ctx.runSyncNow) });
const { default: __VLS_42 } = __VLS_38.slots;
// @ts-ignore
[runSyncNow,];
var __VLS_38;
var __VLS_39;
const __VLS_43 = UiButton || UiButton;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
    ...{ 'onClick': {} },
    variant: "secondary",
}));
const __VLS_45 = __VLS_44({
    ...{ 'onClick': {} },
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_44));
let __VLS_48;
const __VLS_49 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.router.push('/members');
            // @ts-ignore
            [router,];
        } });
const { default: __VLS_50 } = __VLS_46.slots;
// @ts-ignore
[];
var __VLS_46;
var __VLS_47;
const __VLS_51 = UiButton || UiButton;
// @ts-ignore
const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
    ...{ 'onClick': {} },
    variant: "ghost",
}));
const __VLS_53 = __VLS_52({
    ...{ 'onClick': {} },
    variant: "ghost",
}, ...__VLS_functionalComponentArgsRest(__VLS_52));
let __VLS_56;
const __VLS_57 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.router.push('/settings?tab=sync-log');
            // @ts-ignore
            [router,];
        } });
const { default: __VLS_58 } = __VLS_54.slots;
// @ts-ignore
[];
var __VLS_54;
var __VLS_55;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
