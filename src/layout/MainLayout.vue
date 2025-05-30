<template>
  <div class="app">
    <Sidebar 
      v-show="!isPlayerFullscreen"
      :followedAnchors="followedStreamersFromStore" 
      @selectAnchor="handleStreamerSelect"
      @unfollow="handleUnfollowStore"
      @reorderList="handleReorderListStore"
    />
    <div class="main-content">
      <Header 
        v-show="!isPlayerFullscreen"
        @select-anchor="handleStreamerSelect"
        @follow="handleFollowStore"
        @unfollow="handleUnfollowStore"
      />
      <router-view 
        v-slot="{ Component, route }" 
        @follow="handleFollowStore"
        @unfollow="handleUnfollowStore"
        @fullscreen-change="handleFullscreenChange"
      >
        <transition name="fade" mode="out-in">
          <keep-alive :include="['HomeView']">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import { useFollowStore } from '../store/followStore'
import type { FollowedStreamer } from '../platforms/common/types'
import { Platform } from '../platforms/common/types'

const router = useRouter()
const followStore = useFollowStore()

const followedStreamersFromStore = computed(() => followStore.getFollowedStreamers)

const isPlayerFullscreen = ref(false)

const handleStreamerSelect = (streamer: FollowedStreamer) => {
  let routeName = '';
  if (streamer.platform === Platform.DOUYU) {
    routeName = 'douyuPlayer';
  } else if (streamer.platform === Platform.DOUYIN) {
    routeName = 'douyinPlayer';
  } else {
    console.error('Unsupported platform for player:', streamer.platform);
    return; // Or handle error appropriately
  }

  router.push({
    name: routeName,
    params: { 
      roomId: streamer.id
      // platform is now part of the path structure, not a separate param for these routes
    }
  });
}

const handleFollowStore = (streamer: FollowedStreamer) => {
  followStore.followStreamer(streamer)
  console.log(`MainLayout: Follow event for ${streamer.nickname} - dispatched to store`)
}

const handleUnfollowStore = (payload: {platform: Platform, id: string} | string) => {
  if (typeof payload === 'string') {
    console.warn('MainLayout: Unfollow event with only ID, assuming DOUYU. Please update emitter to send {platform, id}.')
    followStore.unfollowStreamer(Platform.DOUYU, payload)
  } else {
    followStore.unfollowStreamer(payload.platform, payload.id)
  }
  console.log(`MainLayout: Unfollow event for ${typeof payload === 'string' ? payload : payload.id} - dispatched to store`)
}

const handleReorderListStore = (reorderedList: FollowedStreamer[]) => {
  followStore.updateOrder(reorderedList)
  console.log('MainLayout: Reorder list event - dispatched to store')
}

const handleFullscreenChange = (isFullscreen: boolean) => {
  console.log('Main layout received fullscreen change:', isFullscreen)
  isPlayerFullscreen.value = isFullscreen
}

onMounted(() => {
  // No longer needed here if store handles its own loading or it's done in main.ts
})
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

/* 全屏模式时隐藏UI */
.app.hide-ui > :not(.main-content) {
  display: none !important;
}

.app.hide-ui .main-content > :not(.player-view-container) {
  display: none !important;
}

.app.hide-ui {
  background: transparent !important;
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