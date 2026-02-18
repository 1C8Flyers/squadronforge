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
      <h3 class="mb-3 text-lg font-semibold">Tenants</h3>
      <form class="mb-4 grid gap-2" @submit.prevent="createTenant">
        <UiInput v-model="newTenant.name" placeholder="Tenant name" />
        <UiInput v-model="newTenant.slug" placeholder="tenant-slug" />
        <div class="grid grid-cols-2 gap-2">
          <UiInput v-model="newTenant.orgid" placeholder="ORGID" />
          <UiSelect v-model="newTenant.unitOnly" :options="[{ label: 'Unit only', value: '1' }, { label: 'Wing level', value: '0' }]" />
        </div>
        <UiInput v-model="newTenant.timezone" placeholder="America/Chicago" />
        <UiInput v-model="newTenant.syncScheduleCron" placeholder="0 */4 * * *" />
        <UiInput v-model="newTenant.credentialsRef" placeholder="credentialsRef (optional)" />
        <UiButton type="submit">Create tenant</UiButton>
      </form>
      <ul class="space-y-2 text-sm">
        <li v-for="tenant in tenants" :key="tenant.id" class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <div class="flex items-center justify-between gap-2">
            <div>
              {{ tenant.name }} <span class="text-slate-500">({{ tenant.slug }})</span>
            </div>
            <UiButton variant="danger" @click="removeTenant(tenant.id)">Delete</UiButton>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h3 class="mb-3 text-lg font-semibold">Users</h3>
      <form class="mb-4 grid gap-2" @submit.prevent="createUser">
        <UiInput v-model="newUser.email" placeholder="user@example.com" />
        <UiInput v-model="newUser.password" type="password" placeholder="Password (min 8)" />
        <UiSelect v-model="newUser.systemRole" :options="[{ label: 'User', value: 'user' }, { label: 'System Admin', value: 'systemAdmin' }]" />
        <UiButton type="submit">Create user</UiButton>
      </form>
      <ul class="space-y-2 text-sm">
        <li v-for="user in users" :key="user.id" class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <div class="flex items-center justify-between gap-2">
            <div>
              {{ user.email }} <span class="text-slate-500">({{ user.systemRole }})</span>
            </div>
            <UiButton variant="danger" @click="removeUser(user.id)">Delete</UiButton>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h3 class="mb-3 text-lg font-semibold">Assignments</h3>
      <form class="mb-4 grid gap-2" @submit.prevent="assignUser">
        <UiSelect v-model="assignment.tenantId" :options="tenantOptions" />
        <UiSelect v-model="assignment.userId" :options="userOptions" />
        <UiSelect v-model="assignment.role" :options="[{ label: 'Tenant Viewer', value: 'tenantViewer' }, { label: 'Tenant Admin', value: 'tenantAdmin' }]" />
        <UiButton type="submit">Assign role</UiButton>
      </form>

      <div class="space-y-3 text-sm">
        <div v-for="user in users" :key="user.id" class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p class="mb-2 font-medium">{{ user.email }}</p>
          <ul class="space-y-1">
            <li v-for="link in user.tenants" :key="`${link.tenant.id}-${link.role}`" class="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <span>{{ link.tenant.name }} - {{ link.role }}</span>
              <UiButton variant="ghost" @click="removeAssignment(link.tenant.id, user.id)">Remove</UiButton>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
