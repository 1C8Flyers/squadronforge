import { computed, ref } from 'vue';
import { api } from '@/lib';
const me = ref(null);
const tenants = ref([]);
const selectedTenantSlug = ref(localStorage.getItem('sf_tenant_slug') ?? '');
const loading = ref(false);
export const activeTenant = computed(() => tenants.value.find((t) => t.slug === selectedTenantSlug.value) ?? tenants.value[0] ?? null);
export const setTenantSlug = (slug) => {
    selectedTenantSlug.value = slug;
    localStorage.setItem('sf_tenant_slug', slug);
};
export const hydrateSession = async () => {
    if (!localStorage.getItem('sf_token'))
        return;
    loading.value = true;
    try {
        const [meRes, tenantsRes] = await Promise.all([api.get('/me'), api.get('/tenants')]);
        me.value = meRes.data;
        tenants.value = tenantsRes.data;
        if (!selectedTenantSlug.value && tenants.value.length > 0) {
            setTenantSlug(tenants.value[0].slug);
        }
        if (selectedTenantSlug.value && !tenants.value.some((t) => t.slug === selectedTenantSlug.value) && tenants.value.length > 0) {
            setTenantSlug(tenants.value[0].slug);
        }
    }
    catch {
        localStorage.removeItem('sf_token');
        localStorage.removeItem('sf_refresh_token');
        localStorage.removeItem('sf_tenant_slug');
        me.value = null;
        tenants.value = [];
    }
    finally {
        loading.value = false;
    }
};
export const logout = async () => {
    try {
        await api.post('/auth/logout');
    }
    catch {
        // best-effort only
    }
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_refresh_token');
    localStorage.removeItem('sf_tenant_slug');
    me.value = null;
    tenants.value = [];
    selectedTenantSlug.value = '';
};
export const useSession = () => ({
    me,
    tenants,
    selectedTenantSlug,
    activeTenant,
    loading,
    setTenantSlug,
    hydrateSession,
    logout
});
