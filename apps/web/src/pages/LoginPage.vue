<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiAlert from '@/components/ui/UiAlert.vue';
import { api } from '@/lib';
import { useSession } from '@/state/session';

const router = useRouter();
const { hydrateSession } = useSession();
const email = ref('admin@example.com');
const password = ref('');
const error = ref('');

const login = async () => {
  error.value = '';
  try {
    const { data } = await api.post('/auth/login', { email: email.value, password: password.value });
    localStorage.setItem('sf_token', data.token);
    localStorage.setItem('sf_refresh_token', data.refreshToken);
    await hydrateSession();
    router.push('/');
  } catch {
    error.value = 'Invalid credentials.';
  }
};
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-[#06265b] p-4">
    <form class="w-full max-w-md rounded-[2rem] border-2 border-[#f2c100] bg-[#efefef] p-6 shadow-sm" @submit.prevent="login">
      <div class="mb-5 text-center">
        <p class="text-xs font-semibold uppercase tracking-wide text-[#1d3f8d]">Civil Air Patrol • U.S. Air Force Auxiliary</p>
        <h1 class="mt-2 text-5xl font-light text-[#1f2937]">eServices</h1>
      </div>
      <div v-if="error" class="mb-4"><UiAlert tone="danger">{{ error }}</UiAlert></div>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Email</label>
          <UiInput v-model="email" type="email" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Password</label>
          <UiInput v-model="password" type="password" />
        </div>
        <UiButton type="submit" class="w-full !py-2.5 !text-lg">Log in</UiButton>
      </div>
    </form>
  </div>
</template>
