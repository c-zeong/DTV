<template>
  <div class="player-view">
    <div v-if="isLoading" class="loading-state">
      <p>正在加载抖音直播间 ({{ roomId }})...</p>
    </div>
    <div v-else-if="streamError" class="error-state">
      <p>加载失败: {{ streamError }}</p>
      <button @click="router.back()">返回</button>
    </div>
    
    <MainPlayer 
      v-else-if="mainPlayerComputedProps"
      :stream-url="mainPlayerComputedProps.streamUrl"
      :title="mainPlayerComputedProps.title"
      :anchor-name="mainPlayerComputedProps.anchorName"
      :avatar="mainPlayerComputedProps.avatar"
      :room-id="mainPlayerComputedProps.roomId" 
      :platform="mainPlayerComputedProps.platform" 
      :is-followed="mainPlayerComputedProps.isFollowed" 
      :is-live="mainPlayerComputedProps.isLive"
      :initial-error="mainPlayerComputedProps.initialError"
      @follow="handleFollow" 
      @unfollow="handleUnfollow" 
      @close-player="handleClosePlayer" 
      @fullscreen-change="handlePlayerFullscreenChange" 
    />
    <!-- Fallback if stream URL not found but other info is -->
     <div v-else-if="streamInfo && !isLoading" class="info-without-stream">
        <p>未能加载抖音直播流的详细信息，但主播信息已获取。</p>
        <p v-if="streamInfo.title">标题: {{ streamInfo.title }}</p>
        <p v-if="streamInfo.anchor_name">主播: {{ streamInfo.anchor_name }}</p>
        <img v-if="streamInfo.avatar" :src="streamInfo.avatar" alt="主播头像" class="streamer-avatar"/>
        <button @click="router.back()">返回</button>
    </div>

    <div v-else-if="!isLoading && !streamError" class="unknown-state">
        <p>无法加载播放器或信息。</p>
        <button @click="router.back()">返回</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MainPlayer from '../components/player/index.vue'; 
import { useFollowStore } from '../store/followStore'; 
import type { FollowedStreamer } from '../platforms/common/types'; 
import { Platform } from '../platforms/common/types'; 
import { invoke } from '@tauri-apps/api/core';
import type { LiveStreamInfo } from '../platforms/common/types';

const props = defineProps<{
  // Platform prop is no longer needed here as this view is Douyin-specific
  roomId: string;
}>();

const emit = defineEmits(['fullscreen-change']);

const router = useRouter();
const followStore = useFollowStore();

const isLoading = ref(true);
const streamInfo = ref<LiveStreamInfo | null>(null);
const streamError = ref<string | null>(null);

// Props for MainPlayer
const mainPlayerComputedProps = computed(() => {
  if (!streamInfo.value) { 
    return null; 
  }

  // If streamError is set AND it's NOT '主播未开播', then DouyinPlayerView shows its own error message.
  // Otherwise, we let MainPlayer handle it (either play or show '主播未开播' UI).
  if (streamError.value && !streamError.value.includes('主播未开播')) {
    return null;
  }
  
  const isActuallyLive = streamInfo.value.status === 2 && !!streamInfo.value.stream_url;

  return {
    streamUrl: streamInfo.value.stream_url, 
    title: streamInfo.value.title,
    anchorName: streamInfo.value.anchor_name, 
    avatar: streamInfo.value.avatar,         
    roomId: props.roomId, 
    platform: Platform.DOUYIN, 
    isFollowed: isFollowed.value,
    isLive: isActuallyLive,
    // Pass the specific "主播未开播" error to MainPlayer if it occurred at this stage
    initialError: streamError.value && streamError.value.includes('主播未开播') ? streamError.value : null,
  };
});

const fetchDouyinStreamDetails = async () => {
  if (!props.roomId) return;
  isLoading.value = true;
  streamInfo.value = null;
  streamError.value = null;
  try {
    console.log(`[DouyinPlayerView] Fetching Douyin stream for roomId: ${props.roomId}`);
    const payloadData = { args: { room_id_str: props.roomId } };
    const result = await invoke<LiveStreamInfo>('get_douyin_live_stream_url', { payload: payloadData }); 
    
    console.log('[DouyinPlayerView] Douyin stream details received:', result);

    if (result.error_message) {
      streamError.value = result.error_message;
      streamInfo.value = null; // Clear any previous info
    } else if (result.status === 2) { // Check for live status (status 2)
      if (result.stream_url) {
        streamInfo.value = result; // Stream is live and URL is present
        streamError.value = null;
      } else {
        // Live but no stream URL, this is an error condition for playback
        streamError.value = "直播中，但未能获取到有效的直播流地址。";
        streamInfo.value = result; // Store other info even if stream_url is missing
      }
    } else { // Not live (status is not 2) or status is null/undefined
      let statusMessage = '主播未开播。'; // Default offline message
      // Optionally refine message based on exact status if needed, but keep it simple for now
      // if (result.status !== undefined && result.status !== null) {
      //   statusMessage = `主播当前状态 (${result.status})，未开播。`;
      // }
      streamError.value = statusMessage; // This will be '主播未开播。'
      streamInfo.value = result; // Store other info (like title, avatar) for display by MainPlayer
    }
  } catch (error: any) {
    console.error('[DouyinPlayerView] Error fetching Douyin stream details:', error);
    streamError.value = typeof error === 'string' ? error : (error.message || '加载直播信息失败');
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchDouyinStreamDetails();
});

watch(() => props.roomId, (newRoomId, oldRoomId) => {
  if (newRoomId && newRoomId !== oldRoomId) {
    console.log(`[DouyinPlayerView] Room ID changed from ${oldRoomId} to ${newRoomId}`);
    fetchDouyinStreamDetails();
  }
});


const isFollowed = computed(() => {
  return followStore.isFollowed(Platform.DOUYIN, props.roomId);
});

const handleFollow = () => { 
  // Map anchor_name to nickname and avatar to avatarUrl for FollowedStreamer
  const streamerToFollow: Omit<FollowedStreamer, 'platform' | 'id' | 'roomTitle' | 'isLive'> = {
    nickname: streamInfo.value?.anchor_name || props.roomId, // Use roomId as fallback nickname
    avatarUrl: streamInfo.value?.avatar || '', // Fallback to empty string
    // displayName can be set if different
  };

  followStore.followStreamer({ 
    ...streamerToFollow, 
    id: props.roomId,
    platform: Platform.DOUYIN,
    roomTitle: streamInfo.value?.title === null ? undefined : streamInfo.value?.title, // Ensure null becomes undefined
    // isLive can be assumed true if they are watching, or fetched separately if needed for store
  });
  console.log('[DouyinPlayerView] Followed:', streamerToFollow);
};

const handleUnfollow = () => {
  followStore.unfollowStreamer(Platform.DOUYIN, props.roomId);
  console.log('[DouyinPlayerView] Unfollowed', props.roomId);
};

const handleClosePlayer = () => {
  console.log('[DouyinPlayerView] Close player event received. Navigating back.');
  router.back();
};

const handlePlayerFullscreenChange = (isFullscreen: boolean) => {
  emit('fullscreen-change', isFullscreen);
  console.log('[DouyinPlayerView] Fullscreen event re-emitted:', isFullscreen);
};

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
.loading-state p, .error-state p, .info-without-stream p, .unknown-state p {
  padding: 10px 20px;
  font-size: 1.1em;
}
.error-state button, .info-without-stream button, .unknown-state button {
  padding: 10px 20px;
  font-size: 1em;
  cursor: pointer;
  background-color: #5c16c5;
  color: white;
  border: none;
  border-radius: 5px;
  margin-top: 15px;
}
.info-without-stream .streamer-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-top: 10px;
  object-fit: cover;
}
</style> 