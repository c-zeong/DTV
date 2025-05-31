<template>
  <div class="player-view">
    <MainPlayer v-if="roomId" :platform="Platform.DOUYU" :room-id="roomId" :is-followed="isFollowed" @follow="handleFollow" @unfollow="handleUnfollow" @close-player="handleClosePlayer" />
    <div v-else>
      <p>无效的房间ID。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import MainPlayer from '../components/player/index.vue'; // Assuming MainPlayer is in components/player
import { useFollowStore } from '../store/followStore'; // Placeholder for follow state
import type { FollowedStreamer } from '../platforms/common/types'; // Keep as type-only import
import { Platform } from '../platforms/common/types'; // Regular import for enum

const props = defineProps<{
  roomId: string;
}>();

const router = useRouter(); // Initialize router
const followStore = useFollowStore(); // Placeholder

const isFollowed = computed(() => {
  // Placeholder: check if props.roomId (for a specific platform, e.g. DOUYU) is in followStore.followedStreamers
  return followStore.isFollowed(Platform.DOUYU, props.roomId);
});

const handleFollow = (streamerData: Omit<FollowedStreamer, 'platform'>) => {
  // Placeholder: add to followStore
  followStore.followStreamer({ ...streamerData, platform: Platform.DOUYU, id: props.roomId });
  console.log('PlayerView: Followed', streamerData);
};

const handleUnfollow = (platformId: string) => {
  // Placeholder: remove from followStore
  followStore.unfollowStreamer(Platform.DOUYU, platformId);
  console.log('PlayerView: Unfollowed', platformId);
};

const handleClosePlayer = () => {
  console.log('PlayerView: Close player event received. Navigating back.');
  router.back(); // Navigate to the previous page in history
  // Alternatively, navigate to a specific route like home:
  // router.push({ name: 'DouyuHome' }); 
};

// Watch roomId if the player needs to re-initialize or fetch new data when the route changes
// to a new roomId but the component instance is reused.
watch(() => props.roomId, (newRoomId, oldRoomId) => {
  if (newRoomId && newRoomId !== oldRoomId) {
    console.log(`PlayerView: Room ID changed from ${oldRoomId} to ${newRoomId}`);
    // Potentially re-initialize player or fetch new room details if MainPlayer doesn't handle it internally via its own watchers
  }
});

</script>

<style scoped>
.player-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #0e0e10; /* Twitch-like dark background */
}

/* Add styling for player or messages if roomId is invalid */
</style> 