<template>
  <div class="app" :class="{'hide-ui': isPlayerFullscreen}">
    <Sidebar 
      :followedAnchors="followedAnchors" 
      @selectAnchor="handleStreamerSelect"
      @unfollow="handleUnfollow"
      @reorderList="handleReorderList"
    />
    <div class="main-content">
      <Header 
        @select-anchor="handleStreamerSelect"
        @follow="handleFollow"
        @unfollow="handleUnfollow"
      />
      <router-view 
        v-slot="{ Component, route }" 
        @follow="handleFollow"
        @unfollow="handleUnfollow"
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import type { Streamer } from '../types/streamer'

const router = useRouter()
const followedAnchors = ref<Streamer[]>([])
const isPlayerFullscreen = ref(false)

// Load followed anchors from localStorage
const loadFollowedAnchors = () => {
  const savedList = localStorage.getItem('followList')
  if (savedList) {
    try {
      followedAnchors.value = JSON.parse(savedList)
    } catch (e) {
      console.error('Failed to load follow list:', e)
    }
  }
}

// Save followed anchors to localStorage
const saveFollowedAnchors = () => {
  localStorage.setItem('followList', JSON.stringify(followedAnchors.value))
}

const handleStreamerSelect = (streamer: Streamer) => {
  router.push({
    name: 'player',
    params: { roomId: streamer.roomId }
  })
}

// 处理关注主播
const handleFollow = (streamer: Streamer) => {
  // 检查是否已经关注了这个主播
  const existingIndex = followedAnchors.value.findIndex(
    item => item.roomId === streamer.roomId
  )
  
  if (existingIndex === -1) {
    // 如果不在列表中，添加到列表最前面
    followedAnchors.value = [streamer, ...followedAnchors.value]
    saveFollowedAnchors()
    console.log(`关注主播: ${streamer.nickname}`)
  }
}

const handleUnfollow = (roomId: string) => {
  followedAnchors.value = followedAnchors.value.filter(a => a.roomId !== roomId)
  saveFollowedAnchors()
}

// 处理关注列表的重排序
const handleReorderList = (reorderedList: Streamer[]) => {
  followedAnchors.value = reorderedList;
  saveFollowedAnchors();
}

// 处理播放器全屏变化
const handleFullscreenChange = (isFullscreen: boolean) => {
  console.log('Main layout received fullscreen change:', isFullscreen)
  isPlayerFullscreen.value = isFullscreen
}

onMounted(() => {
  loadFollowedAnchors()
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