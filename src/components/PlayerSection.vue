<template>
  <div class="player-section">
    <Player 
      :room-id="roomId"
      :isFollowed="isFollowed"
      @follow="$emit('follow', $event)"
      @unfollow="$emit('unfollow', $event)"
    />
    <DanmakuList :room-id="roomId" />
  </div>
</template>

<script setup lang="ts">
import Player from './Player.vue'
import DanmakuList from './DanmakuList.vue'

defineProps<{
  roomId: string
  isFollowed: boolean
}>();

defineEmits<{
  (e: 'follow', streamer: any): void
  (e: 'unfollow', roomId: string): void
}>();
</script>

<style scoped>
.player-section {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 16px;
  gap: 16px;
}
</style>