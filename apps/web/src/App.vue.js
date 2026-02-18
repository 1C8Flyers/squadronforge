import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import SidebarNav from '@/components/layout/SidebarNav.vue';
import TopBar from '@/components/layout/TopBar.vue';
const route = useRoute();
const sidebarOpen = ref(false);
const isAuthPage = computed(() => route.path === '/login');
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.isAuthPage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-dvh" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-dvh']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.RouterView} */
    RouterView;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex min-h-dvh bg-slate-100 dark:bg-slate-950" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-dvh']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-slate-950']} */ ;
    const __VLS_5 = SidebarNav;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ 'onClose': {} },
        open: (__VLS_ctx.sidebarOpen),
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onClose': {} },
        open: (__VLS_ctx.sidebarOpen),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!!(__VLS_ctx.isAuthPage))
                    return;
                __VLS_ctx.sidebarOpen = false;
                // @ts-ignore
                [isAuthPage, sidebarOpen, sidebarOpen,];
            } });
    var __VLS_8;
    var __VLS_9;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-[max(env(safe-area-inset-bottom),0px)]']} */ ;
    const __VLS_12 = TopBar;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ 'onToggleSidebar': {} },
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onToggleSidebar': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_17;
    const __VLS_18 = ({ toggleSidebar: {} },
        { onToggleSidebar: (...[$event]) => {
                if (!!(__VLS_ctx.isAuthPage))
                    return;
                __VLS_ctx.sidebarOpen = !__VLS_ctx.sidebarOpen;
                // @ts-ignore
                [sidebarOpen, sidebarOpen,];
            } });
    var __VLS_15;
    var __VLS_16;
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 pb-[max(env(safe-area-inset-bottom),1rem)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:p-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-[max(env(safe-area-inset-bottom),1rem)]']} */ ;
    let __VLS_19;
    /** @ts-ignore @type {typeof __VLS_components.RouterView} */
    RouterView;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({}));
    const __VLS_21 = __VLS_20({}, ...__VLS_functionalComponentArgsRest(__VLS_20));
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
