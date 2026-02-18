import axios from 'axios';
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
});
const unauthenticatedClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
});
let refreshPromise = null;
const clearAuthStorage = () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_refresh_token');
    localStorage.removeItem('sf_tenant_slug');
};
const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('sf_refresh_token');
    if (!refreshToken) {
        return null;
    }
    const { data } = await unauthenticatedClient.post('/auth/refresh', { refreshToken });
    localStorage.setItem('sf_token', data.token);
    localStorage.setItem('sf_refresh_token', data.refreshToken);
    return data.token;
};
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sf_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
api.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error?.config ?? {};
    if (error?.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null;
                });
            }
            const nextToken = await refreshPromise;
            if (!nextToken) {
                throw new Error('No refresh token');
            }
            originalRequest.headers = {
                ...(originalRequest.headers ?? {}),
                Authorization: `Bearer ${nextToken}`
            };
            return api.request(originalRequest);
        }
        catch {
            clearAuthStorage();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
    }
    return Promise.reject(error);
});
