import PageHeader from '@/components/layout/PageHeader.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import { onMounted, ref, watch } from 'vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';
const orgid = ref('1092');
const unitOnly = ref('1');
const timezone = ref('America/Chicago');
const cron = ref('0 */4 * * *');
const membershipFilename = ref('');
const dutyPositionFilename = ref('');
const { selectedTenantSlug } = useSession();
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
    const fileMappingJson = {};
    if (membershipFilename.value.trim()) {
        fileMappingJson.membership = membershipFilename.value.trim();
    }
    if (dutyPositionFilename.value.trim()) {
        fileMappingJson.dutyPosition = dutyPositionFilename.value.trim();
    }
    await api.patch(`/tenant/${selectedTenantSlug.value}/settings`, {
        orgid: Number(orgid.value),
        unitOnly: unitOnly.value === '1',
        timezone: timezone.value,
        syncScheduleCron: cron.value,
        fileMappingJson
    });
};
watch(selectedTenantSlug, loadSettings);
onMounted(loadSettings);
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
    ...{ class: "md:col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
const __VLS_35 = UiButton || UiButton;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    type: "submit",
}));
const __VLS_37 = __VLS_36({
    type: "submit",
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
const { default: __VLS_40 } = __VLS_38.slots;
// @ts-ignore
[saveSettings, orgid, unitOnly, timezone, cron, membershipFilename, dutyPositionFilename,];
var __VLS_38;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
