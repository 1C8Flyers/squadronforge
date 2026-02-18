<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import { api } from '@/lib';

type Tenant = { id: string; name: string; slug: string; orgid: number; timezone: string; unitOnly: boolean; syncScheduleCron: string; credentialsRef: string; isEnabled: boolean };
type User = { id: string; email: string; systemRole: 'systemAdmin' | 'user'; tenants: Array<{ tenant: { id: string; name: string; slug: string }; role: 'tenantAdmin' | 'tenantViewer' }> };

const tenants = ref<Tenant[]>([]);
const users = ref<User[]>([]);

const newTenant = ref({
  name: '',
  slug: '',
  orgid: '1092',
  unitOnly: '1',
  timezone: 'America/Chicago',
  syncScheduleCron: '0 */4 * * *',
  credentialsRef: ''
});

const newUser = ref({
  email: '',
  password: '',
  systemRole: 'user'
});

const assignment = ref({
  tenantId: '',
  userId: '',
  role: 'tenantViewer'
});

const tenantOptions = computed(() => tenants.value.map((tenant) => ({ label: `${tenant.name} (${tenant.slug})`, value: tenant.id })));
const userOptions = computed(() => users.value.map((user) => ({ label: user.email, value: user.id })));

const loadData = async () => {
  const [tenantRes, userRes] = await Promise.all([api.get('/admin/tenants'), api.get('/admin/users')]);
  tenants.value = tenantRes.data;
  users.value = userRes.data;

  if (!assignment.value.tenantId && tenants.value.length > 0) {
    assignment.value.tenantId = tenants.value[0].id;
  }
  if (!assignment.value.userId && users.value.length > 0) {
    assignment.value.userId = users.value[0].id;
  }
};

const createTenant = async () => {
  await api.post('/admin/tenants', {
    name: newTenant.value.name,
    slug: newTenant.value.slug,
    orgid: Number(newTenant.value.orgid),
    unitOnly: newTenant.value.unitOnly === '1',
    timezone: newTenant.value.timezone,
    syncScheduleCron: newTenant.value.syncScheduleCron,
    credentialsRef: newTenant.value.credentialsRef || newTenant.value.slug
  });
  newTenant.value.name = '';
  newTenant.value.slug = '';
  newTenant.value.credentialsRef = '';
  await loadData();
};

const createUser = async () => {
  await api.post('/admin/users', {
    email: newUser.value.email,
    password: newUser.value.password,
    systemRole: newUser.value.systemRole
  });
  newUser.value.email = '';
  newUser.value.password = '';
  newUser.value.systemRole = 'user';
  await loadData();
};

const assignUser = async () => {
  await api.post('/admin/tenant-users', assignment.value);
  await loadData();
};

const removeTenant = async (tenantId: string) => {
  await api.delete(`/admin/tenants/${tenantId}`);
  await loadData();
};

const removeUser = async (userId: string) => {
  await api.delete(`/admin/users/${userId}`);
  await loadData();
};

const removeAssignment = async (tenantId: string, userId: string) => {
  await api.delete('/admin/tenant-users', { data: { tenantId, userId } });
  await loadData();
};

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <PageHeader title="System Admin" subtitle="Manage tenants, users, and assignments">
    <UiButton @click="loadData">Refresh</UiButton>
  </PageHeader>

  <section class="grid gap-4 lg:grid-cols-3">
    <div class="card">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-semibold">Tenants</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Create and maintain tenant workspaces</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ tenants.length }}</span>
      </div>
      <form class="mb-4 grid gap-2" @submit.prevent="createTenant">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant name</label>
        <UiInput v-model="newTenant.name" placeholder="Tenant name" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant slug</label>
        <UiInput v-model="newTenant.slug" placeholder="tenant-slug" />
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ORGID</label>
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Scope</label>
          <UiInput v-model="newTenant.orgid" placeholder="ORGID" />
          <UiSelect v-model="newTenant.unitOnly" :options="[{ label: 'Unit only', value: '1' }, { label: 'Wing level', value: '0' }]" />
        </div>
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Timezone</label>
        <UiInput v-model="newTenant.timezone" placeholder="America/Chicago" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sync schedule (cron)</label>
        <UiInput v-model="newTenant.syncScheduleCron" placeholder="0 */4 * * *" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Credentials reference</label>
        <UiInput v-model="newTenant.credentialsRef" placeholder="credentialsRef (optional)" />
        <UiButton type="submit">Create tenant</UiButton>
      </form>
      <ul class="space-y-2 text-sm">
        <li v-for="tenant in tenants" :key="tenant.id" class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0 break-words">
              {{ tenant.name }} <span class="text-slate-500 dark:text-slate-400">({{ tenant.slug }})</span>
            </div>
            <UiButton variant="danger" @click="removeTenant(tenant.id)">Delete</UiButton>
          </div>
        </li>
        <li v-if="tenants.length === 0" class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No tenants yet.
        </li>
      </ul>
    </div>

    <div class="card">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-semibold">Users</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Create system users and admin access</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ users.length }}</span>
      </div>
      <form class="mb-4 grid gap-2" @submit.prevent="createUser">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</label>
        <UiInput v-model="newUser.email" placeholder="user@example.com" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Password</label>
        <UiInput v-model="newUser.password" type="password" placeholder="Password (min 8)" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">System role</label>
        <UiSelect v-model="newUser.systemRole" :options="[{ label: 'User', value: 'user' }, { label: 'System Admin', value: 'systemAdmin' }]" />
        <UiButton type="submit">Create user</UiButton>
      </form>
      <ul class="space-y-2 text-sm">
        <li v-for="user in users" :key="user.id" class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0 break-words">
              {{ user.email }} <span class="text-slate-500 dark:text-slate-400">({{ user.systemRole }})</span>
            </div>
            <UiButton variant="danger" @click="removeUser(user.id)">Delete</UiButton>
          </div>
        </li>
        <li v-if="users.length === 0" class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No users yet.
        </li>
      </ul>
    </div>

    <div class="card">
      <div class="mb-3">
        <h3 class="text-lg font-semibold">Assignments</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">Link users to tenants with scoped permissions</p>
      </div>
      <form class="mb-4 grid gap-2" @submit.prevent="assignUser">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant</label>
        <UiSelect v-model="assignment.tenantId" :options="tenantOptions" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">User</label>
        <UiSelect v-model="assignment.userId" :options="userOptions" />
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant role</label>
        <UiSelect v-model="assignment.role" :options="[{ label: 'Tenant Viewer', value: 'tenantViewer' }, { label: 'Tenant Admin', value: 'tenantAdmin' }]" />
        <UiButton type="submit">Assign role</UiButton>
      </form>

      <div class="space-y-3 text-sm">
        <div v-for="user in users" :key="user.id" class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p class="mb-2 font-medium">{{ user.email }}</p>
          <ul class="space-y-1">
            <li v-for="link in user.tenants" :key="`${link.tenant.id}-${link.role}`" class="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <span class="min-w-0 break-words">{{ link.tenant.name }} - {{ link.role }}</span>
              <UiButton variant="ghost" @click="removeAssignment(link.tenant.id, user.id)">Remove</UiButton>
            </li>
            <li v-if="user.tenants.length === 0" class="text-slate-500 dark:text-slate-400">No assignments.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
