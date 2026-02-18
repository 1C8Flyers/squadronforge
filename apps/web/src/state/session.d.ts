export type Tenant = {
    id: string;
    name: string;
    slug: string;
};
export declare const activeTenant: import("vue").ComputedRef<{
    id: string;
    name: string;
    slug: string;
}>;
export declare const setTenantSlug: (slug: string) => void;
export declare const hydrateSession: () => Promise<void>;
export declare const logout: () => Promise<void>;
export declare const useSession: () => {
    me: import("vue").Ref<{
        id: string;
        email: string;
    } | null, {
        id: string;
        email: string;
    } | {
        id: string;
        email: string;
    } | null>;
    tenants: import("vue").Ref<{
        id: string;
        name: string;
        slug: string;
    }[], Tenant[] | {
        id: string;
        name: string;
        slug: string;
    }[]>;
    selectedTenantSlug: import("vue").Ref<string, string>;
    activeTenant: import("vue").ComputedRef<{
        id: string;
        name: string;
        slug: string;
    }>;
    loading: import("vue").Ref<boolean, boolean>;
    setTenantSlug: (slug: string) => void;
    hydrateSession: () => Promise<void>;
    logout: () => Promise<void>;
};
