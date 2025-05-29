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
  import { ref, computed, onMounted, watch, toRefs } from 'vue'
  import { invoke } from '@tauri-apps/api/core'
  import { Platform } from '../../platforms/common/types'
  import type { StreamerDetails } from '../../platforms/common/types'
  // import { parseDouyuRoomDataToStreamerDetails } from '../../platforms/douyu/parsers' // Ensure this is removed or commented out
  
  const MAX_FETCH_ATTEMPTS = 3
  
  const emit = defineEmits<{
    (e: 'follow', data: { id: string; platform: Platform; nickname: string; avatarUrl: string; roomTitle?: string }): void
    (e: 'unfollow', roomId: string): void
  }>()
  
  const props = defineProps<{
    roomId: string
    platform: Platform
    isFollowed: boolean
    title?: string | null
    anchorName?: string | null
    avatar?: string | null
  }>()
  
  const roomDetails = ref<StreamerDetails | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const showAvatarText = ref(false)
  
  const roomTitle = computed(() => props.title ?? roomDetails.value?.roomTitle ?? '直播间标题加载中...')
  const nickname = computed(() => props.anchorName ?? roomDetails.value?.nickname ?? '主播昵称加载中...')
  const avatarUrl = computed(() => props.avatar ?? roomDetails.value?.avatarUrl ?? null)
  const viewerCount = computed(() => roomDetails.value?.viewerCount ?? 0)
  const isLive = computed(() => roomDetails.value?.isLive ?? false)
  const categoryName = computed(() => roomDetails.value?.categoryName ?? 'N/A')
  
  const isFollowing = computed(() => props.isFollowed)
  
  const statusClass = computed(() => {
    if (isLive.value) return 'live'
    return 'offline'
  })
  
  const getStatusText = computed(() => {
    if (error.value) return '信息加载失败'
    if (isLive.value) return '直播中'
    return '未开播'
  })
  
  const formattedViewerCount = computed(() => {
    if (viewerCount.value >= 10000) {
      return (viewerCount.value / 10000).toFixed(1) + '万'
    }
    return viewerCount.value.toString()
  })
  
  const fetchRoomDetails = async () => {
    if (props.platform === Platform.DOUYIN && props.title && props.anchorName && props.avatar) {
      console.log('[StreamerInfo] Douyin platform: Using details from props.')
      if (!avatarUrl.value) showAvatarText.value = true
      isLoading.value = false
      return
    }
    console.log(`[StreamerInfo] Fetching details for ${props.platform}/${props.roomId}`)
    isLoading.value = true
    error.value = null
    try {
      const rawDetails = await invoke<any>('fetch_douyu_room_info', { roomId: props.roomId });
      
      if (props.platform === Platform.DOUYU) {
        const roomData = rawDetails.data?.room ?? rawDetails.room ?? rawDetails.data ?? rawDetails;

        if (!roomData || Object.keys(roomData).length === 0) {
          console.error('[StreamerInfo] Douyu rawDetails or roomData is empty/undefined:', rawDetails);
          throw new Error('Received empty room data from API');
        }
        
        const showStatus = Number(roomData.show_status);
        const videoLoop = Number(roomData.videoLoop ?? roomData.video_loop ?? 0);
        const isReallyLive = showStatus === 1 && videoLoop !== 1;

        roomDetails.value = {
          roomId: props.roomId,
          platform: 'douyu', // Ensure string literal 'douyu' is used
          nickname: roomData.nickname || 'N/A',
          roomTitle: roomData.room_name || roomData.roomName || 'N/A',
          avatarUrl: roomData.avatar_mid || roomData.avatar || roomData.owner_avatar || null,
          isLive: isReallyLive,
          viewerCount: Number(roomData.hn || roomData.online_num || roomData.onlineNum || 0),
          categoryName: roomData.cate2_name || roomData.cate_name || roomData.game_name || 'N/A',
        };
      } else if (props.platform === Platform.DOUYIN) {
        // Placeholder for Douyin direct prop usage or future Douyin-specific API call
        // For now, if details come from props (handled at the start of function), this block might not be hit
        // If a Douyin specific API call is made here in the future, map it similarly.
        // Example if rawDetails were from a Douyin API:
        // roomDetails.value = {
        //   roomId: props.roomId,
        //   platform: 'douyin', 
        //   nickname: rawDetails.nickname || 'N/A',
        //   // ... other Douyin specific fields
        // };
        // For now, we assume Douyin details are passed via props and handled earlier.
        // If fetch_douyu_room_info is mistakenly called for Douyin, it would be an error.
        // The initial check `props.platform === Platform.DOUYIN && props.title ...` handles prop-based data for Douyin.
        // If execution reaches here for Douyin, it implies an API call was made, which is not currently the case
        // for Douyin in this function (it uses props). If `fetch_douyu_room_info` *could* return Douyin data,
        // we'd need a specific parser here.
        console.warn('[StreamerInfo] Reached Douyin processing block after API call. Ensure this is intended and data is Douyin-specific.');
        // Fallback or specific parsing for Douyin if rawDetails came from an API for Douyin
        roomDetails.value = rawDetails as StreamerDetails; // This is likely incorrect if rawDetails structure is unknown for Douyin API
      } else {
        console.warn(`[StreamerInfo] fetch_douyu_room_info was called for an unhandled platform: ${props.platform}. Ensure this is intended.`);
        roomDetails.value = rawDetails as StreamerDetails; 
      }

      if (!avatarUrl.value) showAvatarText.value = true
    } catch (e: any) {
      console.error(`[StreamerInfo] Error fetching room details for ${props.roomId}:`, e)
      error.value = e.message || 'Failed to load streamer details'
      showAvatarText.value = true
    } finally {
      isLoading.value = false
    }
  }
  
  const toggleFollow = () => {
    if (isFollowing.value) {
      emit('unfollow', props.roomId)
    } else {
      const followData = {
        id: props.roomId,
        platform: props.platform,
        nickname: nickname.value === '主播昵称加载中...' ? props.roomId : nickname.value,
        avatarUrl: avatarUrl.value ?? '',
        roomTitle: roomTitle.value === '直播间标题加载中...' ? undefined : roomTitle.value,
      }
      emit('follow', followData)
    }
  }
  
  const handleAvatarError = () => {
    console.warn('[StreamerInfo] Failed to load avatar: ' + avatarUrl.value)
    showAvatarText.value = true
  }
  
  onMounted(() => {
    fetchRoomDetails()
  })
  
  </script>