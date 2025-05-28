<template>
    <div class="streamer-info">
      <div class="streamer-layout">
        <div class="avatar-wrapper">
          <img v-if="avatarUrl && !showAvatarText" :src="avatarUrl" :alt="nickname" @error="handleAvatarError" class="avatar-img">
          <div v-else class="avatar-fallback">{{ nickname.charAt(0).toUpperCase() }}</div>
        </div>
  
        <div class="streamer-details-main">
          <h3 class="room-title" :title="roomTitle">{{ roomTitle }}</h3>
          <div class="streamer-meta-row">
            <span class="streamer-name">{{ nickname }}</span>
            <span :class="['status-tag', statusClass]">{{ getStatusText }}</span>
            <span v-if="viewerCount > 0" class="viewers-tag">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3"/></svg>
              {{ formattedViewerCount }}
            </span>
          </div>
        </div>
  
        <div class="streamer-actions">
          <div class="id-follow-container" :class="{ 'highlight-moves-to-id': isFollowing }">
            <span class="streamer-id" :class="{ 'text-active-on-highlight': isFollowing }">ID:{{ props.roomId }}</span>
            <button class="follow-btn" :class="{ 'text-active-on-highlight': !isFollowing, 'is-following': isFollowing }" @click="toggleFollow">
              <span class="follow-icon-wrapper">
                <span class="follow-icon icon-add" v-if="!isFollowing">
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12.998h-6v6h-2v-6H5v-2h6v-6h2v6h6z"/></svg>
                </span>
                <span class="follow-icon icon-check" v-else>
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="m9.55 18.001l-5.7-5.7l1.425-1.425L9.55 15.151l9.175-9.175l1.425 1.425z"/></svg>
                </span>
              </span>
              <span class="follow-text">{{ isFollowing ? '已关' : '关注' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <style scoped>
  .streamer-info {
    width: 100%;
    padding: 24px 0 32px 0; /* 增加上下边距，特别是下边距 */
  }
  
  .streamer-layout {
    display: flex;
    align-items: center; /* 改为居中对齐，确保所有元素垂直居中 */
    gap: 16px;
    position: relative;
  }
  
  .avatar-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.15);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  
  .avatar-wrapper:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.25);
  }
  
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    background: linear-gradient(135deg, #ff4757, #ff6b81);
  }
  
  .streamer-details-main {
    flex-grow: 1; /* Takes available space, pushing actions to the right */
    display: flex;
    flex-direction: column;
    gap: 8px; /* Space between title and meta-row */
    min-width: 0; /* Prevents overflow issues with long text */
  }
  
  .room-title {
    font-size: 1rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0; /* Removed bottom margin, using gap from parent */
    line-height: 1.4; /* Adjusted line height */
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    letter-spacing: 0.2px;
  }
  
  .streamer-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .streamer-name {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }
  
  .streamer-actions {
    display: flex;
    margin-left: auto; 
    flex-shrink: 0; 
    align-items: center; /* 确保垂直居中 */
    align-self: center; /* 在flex容器中自身居中 */
  }
  
  .id-follow-container {
    display: flex;
    align-items: stretch; 
    border-radius: 6px; 
    overflow: hidden; /* Important for clipping the pseudo-element */
    box-shadow: 0 1px 3px rgba(0,0,0,0.15); 
    background-color: #2c2f38; /* Base container background */
    position: relative; /* For the pseudo-element */
  }
  
  /* The sliding highlight pseudo-element */
  .id-follow-container::before {
    content: '';
    position: absolute;
    top: 2px; /* Small inset from container edges */
    bottom: 2px;
    height: calc(100% - 4px); /* Full height within insets */
    /* Width and Left are dynamic based on active segment */
    background-color: #FB7299; /* Accent color */
    z-index: 0; /* Behind text and icons */
    border-radius: 4px; /* Rounded corners for the highlight pill itself */
    transition: left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), width 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Optimized bounce & duration */
    /* Initial state: highlight on button (right side, 40% width) */
    left: calc(60% + 1px); 
    width: calc(40% - 2px); 
  }
  
  .id-follow-container.highlight-moves-to-id::before {
    /* Target state: highlight on ID (left side, 60% width) */
    left: 2px; 
    width: calc(60% - 4px); 
  }
  
  .streamer-id,
  .follow-btn {
    background-color: transparent !important; /* CRITICAL: Must be transparent to see pseudo-element */
    padding: 6px 10px; /* Slightly reduced horizontal padding too for compactness */
    font-weight: 500;
    display: flex; 
    align-items: center;
    justify-content: center; /* Center content within each segment */
    /* flex: 1; Replaced by specific flex values below */
    position: relative; /* To ensure text/icons are above pseudo-element */
    z-index: 1;
    transition: color 0.2s ease-in-out 0.1s; /* Slight delay for text color change */
    cursor: default; 
    border: none; /* Ensure no borders on either by default */
  }
  
  .follow-btn {
    cursor: pointer;
    flex: 2; /* Button takes 2 parts of flex space */
    min-width: 60px; /* 添加最小宽度，确保"关注"两个字可以在一行显示 */
    white-space: nowrap; /* 防止文本换行 */
  }
  
  .streamer-id {
    color: #9098a3; /* Neutral default */
    border-top-left-radius: 6px; /* Match container */
    border-bottom-left-radius: 6px;
    font-size: 0.75rem; /* Base size for "ID:" */
    flex: 3; /* ID takes 3 parts of flex space */
  }
  
  .follow-btn {
    color: #9098a3; /* Neutral default */
    border-top-right-radius: 6px; /* Match container */
    border-bottom-right-radius: 6px;
    font-size: 0.8rem; /* Keep follow button text size */
  }
  
  .streamer-id.text-active-on-highlight,
  /* .streamer-id.text-active-on-highlight .room-id-number, Removed as .room-id-number is gone */
  .follow-btn.text-active-on-highlight .follow-text, 
  .follow-btn.text-active-on-highlight .follow-icon-wrapper svg {
    color: white !important; /* Active text color when highlight is underneath */
  }
  
  /* Icon animation styles - preserved */
  .follow-btn .follow-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative; 
    width: 16px; 
    height: 16px; 
  }
  
  .follow-btn .follow-icon {
    display: inline-flex;
    align-items: center; 
    justify-content: center;
    transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
    position: absolute; 
    top: 0; left: 0; width: 100%; height: 100%; 
  }
  
  .follow-btn .follow-icon.icon-add {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  .follow-btn.is-following .follow-icon.icon-add {
    opacity: 0;
    transform: scale(0.5) rotate(-90deg);
  }
  
  .follow-btn .follow-icon.icon-check {
    opacity: 0;
    transform: scale(0.5) rotate(90deg);
  }
  .follow-btn.is-following .follow-icon.icon-check {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  
  /* .follow-text transition is now part of the general .follow-btn color transition */
  
  .status-tag {
    font-size: 0.7rem; 
    padding: 2px 7px; 
    border-radius: 5px; 
    color: #ffffff;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    line-height: 1.3; 
  }
  
  .status-tag.live {
    background: linear-gradient(135deg, #ff4757, #ff6b81);
  }
  
  .status-tag.replay {
    background: linear-gradient(135deg, #5352ed, #6c6bff);
  }
  
  .status-tag.offline {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .viewers-tag {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.85);
    display: inline-flex;
    align-items: center;
    gap: 5px; /* Adjusted gap */
    background: rgba(255, 255, 255, 0.08);
    padding: 3px 10px; /* Adjusted padding */
    border-radius: 8px; /* Consistent border radius */
  }
  
  .viewers-tag svg {
    width: 12px;
    height: 12px;
    opacity: 0.9;
  }
  
  @keyframes idPulse {
    0% { text-shadow: 0 0 2px rgba(251, 114, 153, 0); }
    50% { text-shadow: 0 0 6px rgba(251, 114, 153, 0.7); }
    100% { text-shadow: 0 0 2px rgba(251, 114, 153, 0); }
  }
  </style>
  
  <script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  // import { invoke } from '@tauri-apps/api/core' // No longer directly used for fetch_douyu_room_info
  // import type { RoomInfo } from '../../types/streamer' // Old type import
  import { fetchRoomInfo } from '../../platforms/common/apiService'; // New service import
  import type { StreamerDetails } from '../../platforms/common/types'; // Use the common StreamerDetails type
  
  const MAX_FETCH_ATTEMPTS = 3;
  
  const emit = defineEmits<{
    (e: 'follow', streamer: {
      roomId: string,
      nickname: string,
      roomTitle: string,
      avatarUrl: string,
      isLive: boolean,
      categoryName?: string,
      viewerCount?: number
    }): void,
    (e: 'unfollow', roomId: string): void
  }>()
  
  const props = defineProps<{
    roomId: string,
    isFollowed?: boolean
  }>()
  
  const roomTitle = ref('加载中...')
  const nickname = ref('主播名称')
  const isLive = ref(false)
  const isReplay = ref(false)
  const isFollowing = ref(props.isFollowed || false)
  const avatarUrl = ref('')
  const showAvatarText = ref(false)
  const categoryName = ref('')
  const viewerCount = ref(0)
  const platform = ref('douyu')
  
  const isLoading = ref(false); // Added loading state
  const fetchAttempts = ref(0); // Added fetch attempts counter
  const permanentError = ref(false); // Indicates if max attempts reached
  
  const statusClass = computed(() => {
    if (isLive.value) return 'live'
    if (isReplay.value) return 'replay'
    return 'offline'
  })
  
  const getStatusText = computed(() => {
    if (permanentError.value) return '信息加载失败';
    if (isLive.value) return '直播中';
    if (isReplay.value) return '轮播中';
    if (isLoading.value && fetchAttempts.value === 0) return '加载中...';
    if (isLoading.value) return '尝试重连...';
    return '未开播';
  })
  
  const formattedViewerCount = computed(() => {
    if (viewerCount.value >= 10000) {
      return (viewerCount.value / 10000).toFixed(1) + '万'
    }
    return viewerCount.value.toString()
  })
  
  const resetStateForNewRoom = () => {
    roomTitle.value = '加载中...'; 
    nickname.value = '主播名称'; 
    isLive.value = false; 
    isReplay.value = false;
    avatarUrl.value = ''; 
    categoryName.value = ''; 
    viewerCount.value = 0; 
    showAvatarText.value = false;
    fetchAttempts.value = 0;
    isLoading.value = false;
    permanentError.value = false;
    platform.value = 'douyu';
  };
  
  const fetchRoomData = async () => {
    if (!props.roomId) {
      console.warn('StreamerInfo: roomId is not provided.');
      resetStateForNewRoom();
      roomTitle.value = ''; nickname.value = 'N/A';
      return;
    }
  
    if (isLoading.value && fetchAttempts.value > 0) {
        console.log('StreamerInfo: Already fetching room info for ' + props.roomId);
        return;
    }
  
    if (fetchAttempts.value >= MAX_FETCH_ATTEMPTS) {
      console.error(`StreamerInfo: Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for room ${props.roomId}.`);
      roomTitle.value = '信息加载失败'; 
      nickname.value = '请检查网络或稍后再试';
      permanentError.value = true;
      isLoading.value = false;
      return;
    }
  
    isLoading.value = true;
    permanentError.value = false;
    console.log(`StreamerInfo: Attempt ${fetchAttempts.value + 1} to fetch room info for ${props.roomId}`);
  
    try {
      // const data = await invoke<RoomInfo>('fetch_douyu_room_info', { roomId: props.roomId }) // Old call
      const streamerData: StreamerDetails = await fetchRoomInfo(props.roomId); // New call, expects StreamerDetails
      console.log('StreamerInfo fetched StreamerDetails:', streamerData);
      
      if (!streamerData || !streamerData.roomId) {
        console.error('StreamerInfo: Invalid StreamerDetails received:', streamerData);
        throw new Error('Invalid StreamerDetails structure received'); 
      }
  
      roomTitle.value = streamerData.roomTitle || '未知房间名'
      nickname.value = streamerData.nickname || '未知主播'
      isLive.value = streamerData.isLive
      isReplay.value = streamerData.isReplay || false
      avatarUrl.value = streamerData.avatarUrl || ''
      categoryName.value = streamerData.categoryName || '游戏分区'
      viewerCount.value = streamerData.viewerCount || 0
      platform.value = streamerData.platform || 'douyu'
  
      if (!avatarUrl.value) {
          console.log('StreamerInfo: Avatar URL is empty, attempting fallback.');
          showAvatarText.value = true;
      } else {
          showAvatarText.value = false;
      }
      fetchAttempts.value = 0;
    } catch (error) {
      console.error(`StreamerInfo: Error on attempt ${fetchAttempts.value + 1} for room ${props.roomId}:`, error);
      fetchAttempts.value++;
      if (fetchAttempts.value < MAX_FETCH_ATTEMPTS) {
        // Optionally, implement a small delay before retrying
        // setTimeout(fetchRoomData, 1000 * fetchAttempts.value); // Example: 1s, 2s delay
        // For now, relies on watch to re-trigger or direct call if needed.
        // If watch is not re-triggering on error, a direct re-call might be needed here after a delay.
      } else {
          console.error(`StreamerInfo: All ${MAX_FETCH_ATTEMPTS} attempts failed for room ${props.roomId}.`);
          roomTitle.value = '信息加载失败'; 
          nickname.value = '网络错误或服务不可达';
          permanentError.value = true;
      }
    } finally {
      isLoading.value = false;
    }
  }
  
  const handleAvatarError = () => {
    console.warn('StreamerInfo: Failed to load avatar: ' + avatarUrl.value);
    showAvatarText.value = true 
    avatarUrl.value = '' 
  }
  
  const toggleFollow = () => {
    isFollowing.value = !isFollowing.value
    if (isFollowing.value) {
      emit('follow', {
        roomId: props.roomId,
        nickname: nickname.value,
        roomTitle: roomTitle.value,
        avatarUrl: avatarUrl.value,
        isLive: isLive.value,
        categoryName: categoryName.value,
        viewerCount: viewerCount.value
      })
    } else {
      emit('unfollow', props.roomId)
    }
  }
  
  watch(() => props.roomId, (newId, oldId) => {
    console.log('StreamerInfo: roomId changed from ' + (oldId || 'null') + ' to ' + (newId || 'null'));
    if (newId) {
      resetStateForNewRoom(); // Reset states for the new room before fetching
      fetchRoomData(); // Call the modified fetch function
    } else {
      resetStateForNewRoom(); // Clear all info if roomId becomes null
      roomTitle.value = ''; 
      nickname.value = 'N/A';
      isFollowing.value = false;
    }
  }, { immediate: true })
  
  watch(() => props.isFollowed, (newValue) => {
    isFollowing.value = newValue || false;
  });
  
  </script>