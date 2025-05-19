<template>
  <div class="sidebar">
    <div class="logo">
      <img src="/tauri.svg" alt="Logo" />
    </div>
    <div class="nav-buttons">
      <router-link to="/" class="nav-btn" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>主页</span>
      </router-link>
    </div>
    <FollowList @select="$emit('select-streamer', $event)" ref="followListRef"/>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FollowList from './FollowList.vue'
import type { Streamer } from '../types/streamer'

defineEmits<{
  (e: 'select-streamer', streamer: Streamer): void
}>();

const followListRef = ref<InstanceType<typeof FollowList> | null>(null);

defineExpose({
  followListRef
})
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: #1f1e2b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
}

.logo img {
  height: 32px;
  width: auto;
}

.nav-buttons {
  padding: 16px;
}

.nav-btn {
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--secondary-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  transition: all 0.2s ease;
  text-decoration: none;
}

.nav-btn:hover {
  background: var(--button-hover-bg);
  color: var(--button-hover-text);
}

.nav-btn.active {
  background: var(--button-hover-bg);
  color: var(--primary-text);
}
</style>