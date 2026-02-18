import { Download, LogOut, Menu, Moon, Sun } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSession } from '@/state/session';
const emit = defineEmits();
const dark = ref(false);
const { me, tenants, selectedTenantSlug, setTenantSlug, hydrateSession, logout } = useSession();
const deferredInstallPrompt = ref(null);
const isStandalone = ref(false);
const updateStandaloneMode = () => {
    isStandalone.value = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
};
const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredInstallPrompt.value = event;
};
const canInstall = computed(() => deferredInstallPrompt.value !== null && !isStandalone.value);
const showIosHint = computed(() => /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone.value && !canInstall.value);
const applyTheme = (value) => {
    dark.value = value;
    document.documentElement.classList.toggle('dark', value);
    localStorage.setItem('sf_dark_mode', JSON.stringify(value));
};
onMounted(() => {
    const stored = localStorage.getItem('sf_dark_mode');
    applyTheme(stored ? JSON.parse(stored) : false);
    hydrateSession();
    updateStandaloneMode();
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', updateStandaloneMode);
});
onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', updateStandaloneMode);
});
const installApp = async () => {
    if (!deferredInstallPrompt.value)
        return;
    await deferredInstallPrompt.value.prompt();
    await deferredInstallPrompt.value.userChoice;
    deferredInstallPrompt.value = null;
    updateStandaloneMode();
};
const signOut = async () => {
    await logout();
    window.location.href = '/login';
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90" },
});
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/90']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-slate-900/90']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8" },
});
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-sidebar');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:hidden']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Menu} */
Menu;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "size-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "size-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['size-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ml-auto flex min-w-0 items-center gap-2 sm:gap-3" },
});
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.setTenantSlug($event.target.value);
            // @ts-ignore
            [setTenantSlug,];
        } },
    value: (__VLS_ctx.selectedTenantSlug),
    ...{ class: "max-w-[11rem] min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-base dark:border-slate-700 dark:bg-slate-800 sm:max-w-none sm:px-3 sm:text-sm" },
});
/** @type {__VLS_StyleScopedClasses['max-w-[11rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-11']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:max-w-none']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
for (const [tenant] of __VLS_vFor((__VLS_ctx.tenants))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (tenant.id),
        value: (tenant.slug),
    });
    (tenant.name);
    // @ts-ignore
    [selectedTenantSlug, tenants,];
}
if (__VLS_ctx.canInstall) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.installApp) },
        ...{ class: "min-h-11 rounded-lg border border-slate-200 px-2 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 sm:px-3" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-11']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:px-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    let __VLS_5;
    /** @ts-ignore @type {typeof __VLS_components.Download} */
    Download;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "size-4" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "size-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['size-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.applyTheme(!__VLS_ctx.dark);
            // @ts-ignore
            [canInstall, installApp, applyTheme, dark,];
        } },
    ...{ class: "rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800']} */ ;
if (__VLS_ctx.dark) {
    let __VLS_10;
    /** @ts-ignore @type {typeof __VLS_components.Sun} */
    Sun;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ class: "size-5" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "size-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    /** @type {__VLS_StyleScopedClasses['size-5']} */ ;
}
else {
    let __VLS_15;
    /** @ts-ignore @type {typeof __VLS_components.Moon} */
    Moon;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        ...{ class: "size-5" },
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "size-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    /** @type {__VLS_StyleScopedClasses['size-5']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hidden items-center gap-2 md:flex" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "max-w-[18rem] truncate rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700" },
});
/** @type {__VLS_StyleScopedClasses['max-w-[18rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
(__VLS_ctx.me?.email ?? 'User');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.signOut) },
    ...{ class: "rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.signOut) },
    ...{ class: "rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 md:hidden" },
    'aria-label': "Logout",
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
let __VLS_20;
/** @ts-ignore @type {typeof __VLS_components.LogOut} */
LogOut;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    ...{ class: "size-4" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "size-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
if (__VLS_ctx.showIosHint) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:px-6 lg:px-8" },
    });
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-slate-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-slate-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:px-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:px-8']} */ ;
}
// @ts-ignore
[dark, me, signOut, signOut, showIosHint,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
