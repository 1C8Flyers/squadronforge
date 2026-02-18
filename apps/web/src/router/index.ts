import { createRouter, createWebHistory } from 'vue-router';

import DashboardPage from '@/pages/DashboardPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import MembersPage from '@/pages/MembersPage.vue';
import DutyPositionsPage from '@/pages/DutyPositionsPage.vue';
import CadetPromotionsPage from '@/pages/CadetPromotionsPage.vue';
import ReportsPage from '@/pages/ReportsPage.vue';
import SyncRunsPage from '@/pages/SyncRunsPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import AdminPage from '@/pages/AdminPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true } },
    { path: '/', name: 'dashboard', component: DashboardPage },
    { path: '/members', name: 'members', component: MembersPage },
    { path: '/duty-positions', name: 'duty-positions', component: DutyPositionsPage },
    { path: '/cadet-promotions', name: 'cadet-promotions', component: CadetPromotionsPage },
    { path: '/reports', name: 'reports', component: ReportsPage },
    { path: '/sync-runs', name: 'sync-runs', component: SyncRunsPage },
    { path: '/settings', name: 'settings', component: SettingsPage },
    { path: '/admin', name: 'admin', component: AdminPage }
  ]
});

router.beforeEach((to) => {
  const token = localStorage.getItem('sf_token');
  if (!to.meta.public && !token) {
    return '/login';
  }
  if (to.path === '/login' && token) {
    return '/';
  }
  return true;
});

export default router;
