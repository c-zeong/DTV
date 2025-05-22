<template>
  <div class="player-view-container" :class="{'fullscreen-mode': isFullScreen}">
    <MainPlayer
      :room-id="roomId"
      :isFollowed="isFollowedStreamer"
      @follow="$emit('follow', $event)"
      @unfollow="$emit('unfollow', $event)"
      @close-player="goBack"
      @fullscreen-change="handleFullscreenChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MainPlayer from '../components/player/MainPlayer.vue'

const route = useRoute()
const router = useRouter()
const isFullScreen = ref(false)

const roomId = computed(() => route.params.roomId as string)

// Check if the current streamer is in the followed list
const getFollowList = () => {
  const savedList = localStorage.getItem('followList')
  if (savedList) {
    try {
      return JSON.parse(savedList) || []
    } catch (e) {
      console.error('Failed to parse follow list:', e)
      return []
    }
  }
  return []
}

const isFollowedStreamer = computed(() => {
  const followList = getFollowList()
  return followList.some((streamer: any) => streamer.roomId === roomId.value)
})

const emit = defineEmits<{
  (e: 'follow', streamer: any): void
  (e: 'unfollow', roomId: string): void
  (e: 'fullscreen-change', isFullscreen: boolean): void
}>()

const handleFullscreenChange = (fullscreen: boolean) => {
  isFullScreen.value = fullscreen
  emit('fullscreen-change', fullscreen)
  
  if (fullscreen) {
    document.body.classList.add('player-fullscreen')
  } else {
    document.body.classList.remove('player-fullscreen')
  }
}

const goBack = () => {
  router.back()
}

onUnmounted(() => {
  document.body.classList.remove('player-fullscreen')
})
</script>

<style scoped>
.player-view-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.player-view-container.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9000;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
}

:global(body.player-fullscreen) {
  overflow: hidden;
}
</style>