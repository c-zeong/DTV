<template>
  <div class="player-view">
    <MainPlayer 
      v-if="roomId && !isLoadingDetails"
      :room-id="roomId" 
      :platform="Platform.DOUYU" 
      :is-followed="isFollowed"
      :title="streamerDetails?.roomTitle ?? undefined"
      :anchor-name="streamerDetails?.nickname ?? undefined"
      :avatar="streamerDetails?.avatarUrl ?? undefined"
      :is-live="streamerDetails?.isLive ?? undefined"
      :initial-error="detailsError" 
      @follow="handleFollow" 
      @unfollow="handleUnfollow" 
      @close-player="handleClosePlayer" 
      @fullscreen-change="handlePlayerFullscreenChange"
      @request-refresh-details="handleRefreshDetails" />
    <div v-else-if="roomId && isLoadingDetails" class="loading-details">
      <p>正在加载主播信息 ({{ roomId }})...</p>
    </div>
    <div v-else-if="detailsError" class="invalid-room">
      <p>错误: {{ detailsError }}</p>
      <button @click="router.back()">返回</button>
    </div>
    <div v-else class="invalid-room">
      <p>无效的斗鱼房间ID。</p>
      <button @click="router.back()">返回</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MainPlayer from '../components/player/index.vue';
import { useFollowStore } from '../store/followStore';
import type { FollowedStreamer } from '../platforms/common/types';
import { Platform } from '../platforms/common/types';
import { fetchDouyuStreamerDetails } from '../platforms/douyu/streamerInfoParser';
import type { StreamerDetails } from '../platforms/common/types';

const props = defineProps<{
  roomId: string;
}>();

const emit = defineEmits(['fullscreen-change']);

const router = useRouter();
const followStore = useFollowStore();

const streamerDetails = ref<StreamerDetails | null>(null);
const isLoadingDetails = ref(false);
const detailsError = ref<string | null>(null);
let hasLoadedDetailsForCurrentRoom = false; // Flag to prevent re-fetching for the same room ID

const loadStreamerDetails = async (currentRoomId: string) => {
  if (!currentRoomId) {
    streamerDetails.value = null;
    detailsError.value = 'Room ID is invalid.';
    isLoadingDetails.value = false;
    hasLoadedDetailsForCurrentRoom = false; // Reset flag
    return;
  }

  if (hasLoadedDetailsForCurrentRoom && streamerDetails.value?.roomId === currentRoomId) {
    console.log(`[DouyuPlayerView] Details already processed for room ${currentRoomId}. Skipping fetch.`);
    if(isLoadingDetails.value) isLoadingDetails.value = false;
    return;
  }
  
  isLoadingDetails.value = true;
  detailsError.value = null;
  if (streamerDetails.value?.roomId !== currentRoomId) {
      streamerDetails.value = null;
  }

  console.log(`[DouyuPlayerView] Fetching details for room: ${currentRoomId} (Single Attempt)`);

  try {
    const result = await fetchDouyuStreamerDetails(currentRoomId);
    console.log('[DouyuPlayerView] Raw streamer details received:', result);

    if (result?.errorMessage) {
      detailsError.value = result.errorMessage;
      streamerDetails.value = null; 
      console.warn(`[DouyuPlayerView] Error from fetchDouyuStreamerDetails: ${result.errorMessage}`);
    } else if (!result || !result.nickname) { 
      detailsError.value = '获取到的主播信息无效或不完整。';
      streamerDetails.value = null; 
      console.warn('[DouyuPlayerView] Invalid or incomplete data from backend.', result);
    } else {
      streamerDetails.value = result; 
      detailsError.value = null; 
    }
  } catch (e: any) {
    console.error(`[DouyuPlayerView] Exception while loading streamer details for ${currentRoomId}:`, e);
    detailsError.value = e.message || '加载主播详情时发生未知错误。';
    streamerDetails.value = null;
  } finally {
    isLoadingDetails.value = false;
    hasLoadedDetailsForCurrentRoom = true; 
  }
};

const isFollowed = computed(() => {
  return followStore.isFollowed(Platform.DOUYU, props.roomId);
});

interface MainPlayerFollowEventData {
  nickname: string;
  avatarUrl: string;
  roomTitle?: string; 
}

const handleFollow = (streamerDataFromPlayer: MainPlayerFollowEventData) => {
  const streamerToFollow: FollowedStreamer = {
    id: props.roomId,
    platform: Platform.DOUYU,
    nickname: streamerDataFromPlayer.nickname, 
    avatarUrl: streamerDataFromPlayer.avatarUrl,
    roomTitle: streamerDataFromPlayer.roomTitle, 
  };
  followStore.followStreamer(streamerToFollow);
  console.log('[DouyuPlayerView] Followed', streamerToFollow);
};

const handleUnfollow = () => {
  followStore.unfollowStreamer(Platform.DOUYU, props.roomId);
  console.log('[DouyuPlayerView] Unfollowed', props.roomId);
  if (streamerDetails.value) {
  }
};

const handleClosePlayer = () => {
  console.log('[DouyuPlayerView] Close player event received. Navigating back.');
  router.back();
};

const handlePlayerFullscreenChange = (isFullscreen: boolean) => {
  emit('fullscreen-change', isFullscreen);
  console.log('[DouyuPlayerView] Fullscreen event re-emitted:', isFullscreen);
};

const handleRefreshDetails = () => {
  if (props.roomId) {
    console.log(`[DouyuPlayerView] Received request-refresh-details for room ${props.roomId}. Re-fetching.`);
    hasLoadedDetailsForCurrentRoom = false; // Reset flag to allow re-fetch
    streamerDetails.value = null; // Optionally clear current details to ensure UI updates to loading
    detailsError.value = null;    // Clear previous errors
    // isLoadingDetails will be set to true inside loadStreamerDetails
    loadStreamerDetails(props.roomId);
  } else {
    console.warn('[DouyuPlayerView] request-refresh-details received but no roomId available.');
  }
};

watch(() => props.roomId, (newRoomId, oldRoomId) => {
  if (newRoomId) {
    if (newRoomId !== oldRoomId) {
      console.log(`[DouyuPlayerView] Room ID changed from ${oldRoomId} to ${newRoomId}. Initializing load.`);
      hasLoadedDetailsForCurrentRoom = false; // Reset flag for the new room ID
      loadStreamerDetails(newRoomId);
    } else { // roomId is the same, or it's the initial immediate:true call
      if (!hasLoadedDetailsForCurrentRoom) {
         console.log(`[DouyuPlayerView] Watch (immediate or same ID without load yet): Room ID ${newRoomId}. Attempting load.`);
         loadStreamerDetails(newRoomId);
      }
    }
  } else {
    streamerDetails.value = null;
    detailsError.value = null;
    isLoadingDetails.value = false;
    hasLoadedDetailsForCurrentRoom = false;
  }
}, { immediate: true });

onMounted(() => {
  console.log(`[DouyuPlayerView] Component mounted. Room ID: ${props.roomId}. Watcher handles initial load if ID present and not yet loaded.`);
  if (props.roomId && hasLoadedDetailsForCurrentRoom && isLoadingDetails.value) {
     isLoadingDetails.value = false; 
  } else if (!props.roomId && isLoadingDetails.value) {
     isLoadingDetails.value = false;
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