<template>
  <div class="player-view">
    <MainPlayer v-if="roomId" :room-id="roomId" :platform="Platform.DOUYU" :is-followed="isFollowed" @follow="handleFollow" @unfollow="handleUnfollow" @close-player="handleClosePlayer" @fullscreen-change="handlePlayerFullscreenChange" />
    <div v-else class="invalid-room">
      <p>无效的斗鱼房间ID。</p>
      <button @click="router.back()">返回</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MainPlayer from '../components/player/index.vue';
import { useFollowStore } from '../store/followStore';
import type { FollowedStreamer } from '../platforms/common/types';
import { Platform } from '../platforms/common/types';

const props = defineProps<{
  roomId: string;
}>();

const emit = defineEmits(['fullscreen-change']);

const router = useRouter();
const followStore = useFollowStore();

const isFollowed = computed(() => {
  return followStore.isFollowed(Platform.DOUYU, props.roomId);
});

// Assuming MainPlayer emits streamer data that fits Omit<FollowedStreamer, 'platform' | 'id'>
// or we fetch it here if MainPlayer doesn't provide enough info for following.
// For simplicity, if MainPlayer emits an object with nickname and avatarUrl:
interface MainPlayerFollowEventData {
  nickname: string;
  avatarUrl: string;
  roomTitle?: string; 
  // other fields MainPlayer might provide
}

const handleFollow = (streamerDataFromPlayer: MainPlayerFollowEventData) => {
  const streamerToFollow: FollowedStreamer = {
    id: props.roomId,
    platform: Platform.DOUYU,
    nickname: streamerDataFromPlayer.nickname, 
    avatarUrl: streamerDataFromPlayer.avatarUrl,
    roomTitle: streamerDataFromPlayer.roomTitle, 
    // isLive could be true if emitted from live player context
  };
  followStore.followStreamer(streamerToFollow);
  console.log('[DouyuPlayerView] Followed', streamerToFollow);
};

const handleUnfollow = () => { // Douyu only needs roomId for unfollow from store
  followStore.unfollowStreamer(Platform.DOUYU, props.roomId);
  console.log('[DouyuPlayerView] Unfollowed', props.roomId);
};

const handleClosePlayer = () => {
  console.log('[DouyuPlayerView] Close player event received. Navigating back.');
  router.back();
};

const handlePlayerFullscreenChange = (isFullscreen: boolean) => {
  emit('fullscreen-change', isFullscreen);
  console.log('[DouyuPlayerView] Fullscreen event re-emitted:', isFullscreen);
};

watch(() => props.roomId, (newRoomId, oldRoomId) => {
  if (newRoomId && newRoomId !== oldRoomId) {
    console.log(`[DouyuPlayerView] Room ID changed from ${oldRoomId} to ${newRoomId}`);
    // MainPlayer should ideally handle re-initialization based on its own roomId prop watch.
    // If not, you might need to manually trigger something on MainPlayer here.
  }
});

</script>

<style scoped>
.player-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #0e0e10; 
  color: white;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.invalid-room p {
  padding: 10px 20px;
  font-size: 1.1em;
}
.invalid-room button {
  padding: 10px 20px;
  font-size: 1em;
  cursor: pointer;
  background-color: #5c16c5;
  color: white;
  border: none;
  border-radius: 5px;
  margin-top: 15px;
}
</style> 