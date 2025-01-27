<template>
  <div class="app">
    <Header @select-anchor="handleStreamerSelect"/>
    <main class="main-content">
      <FollowList 
        @select="handleStreamerSelect" 
        ref="followListRef"
      />
      <div class="player-section">
        <Player 
          :room-id="currentRoomId"
          :isFollowed="isCurrentStreamerFollowed"
          @follow="followListRef?.addStreamer"
          @unfollow="followListRef?.removeStreamer"
        />
        <DanmakuList :room-id="currentRoomId" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Header from '../components/Header.vue'
import FollowList from '../components/FollowList.vue'
import Player from '../components/Player.vue'
import DanmakuList from '../components/DanmakuList.vue'
import type { Streamer } from '../types/streamer'

const currentRoomId = ref('');
const followListRef = ref<InstanceType<typeof FollowList> | null>(null);

const handleStreamerSelect = (streamer: Streamer) => {
  currentRoomId.value = streamer.roomId;
};

const isCurrentStreamerFollowed = computed(() => {
  return followListRef.value?.streamers.some((s: Streamer) => s.roomId === currentRoomId.value) ?? false;
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--main-bg);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: var(--main-bg);
}

.player-section {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem;

}
</style> 