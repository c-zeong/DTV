<template>
  <div class="app">
    <Sidebar @select-streamer="handleStreamerSelect"/>
    <div class="main-content">
      <Header @select-anchor="handleStreamerSelect"/>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import Header from '../components/Header.vue'
import type { Streamer } from '../types/streamer'

const router = useRouter()

const handleStreamerSelect = (streamer: Streamer) => {
  router.push({
    name: 'player',
    params: { roomId: streamer.roomId }
  })
}
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  background: var(--main-bg);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>