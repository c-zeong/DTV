<template>
  <div class="streamer-info">
    <div class="info-layout">
      <div class="streamer-avatar">
        <img 
          :src="avatarUrl" 
          :alt="nickname"
          @error="handleAvatarError"
        >
      </div>
      <div class="info-content">
        <div class="room-title">{{ roomTitle }}</div>
        <div class="streamer-details">
          <span class="nickname">{{ nickname }}</span>
          <div class="meta-info">
            <span class="room-id">ID: {{ roomId }}</span>
            <span class="status" :class="{ 
              'live': isLive,
              'replay': isReplay 
            }">
              {{ getStatusText }}
            </span>
          </div>
        </div>
      </div>
      <button 
        class="follow-btn"
        :class="{ 'following': isFollowing }"
        @click="toggleFollow"
      >
        <span class="btn-icon">{{ isFollowing ? '✓' : '+' }}</span>
        <span class="btn-text">{{ isFollowing ? '已关注' : '关注' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { RoomInfo } from '../types/streamer'

const emit = defineEmits<{
  (e: 'follow', streamer: {
    roomId: string,
    nickname: string,
    roomTitle: string,
    avatarUrl: string,
    isLive: boolean
  }): void,
  (e: 'unfollow', roomId: string): void
}>()

const props = defineProps<{
  roomId: string,
  isFollowed?: boolean
}>()

const roomTitle = ref('')
const nickname = ref('')
const isLive = ref(false)
const isReplay = ref(false)
const isFollowing = ref(props.isFollowed || false)
const avatarUrl = ref('')
const showAvatarText = ref(false)

const getStatusText = computed(() => {
  if (isLive.value) return '直播中'
  if (isReplay.value) return '轮播中'
  return '未开播'
})

const fetchRoomInfo = async () => {
  if (!props.roomId) {
    return
  }
  
  try {
    const data = await invoke<RoomInfo>('fetch_room_info', { roomId: props.roomId })
    
    if (!data.room) {
      return
    }
    
    roomTitle.value = data.room.room_name || '未知房间'
    nickname.value = data.room.nickname || '未知主播'
    const showStatus = Number(data.room.show_status)
    const videoLoop = Number(data.room.videoLoop)
    isLive.value = showStatus === 1 && videoLoop !== 1
    isReplay.value = showStatus === 1 && videoLoop === 1
    avatarUrl.value = data.room.avatar_mid || ''
  } catch (error) {
    console.error('获取房间信息失败:', error)
  }
}

const handleAvatarError = () => {
  showAvatarText.value = true
}

const toggleFollow = () => {
  isFollowing.value = !isFollowing.value
  if (isFollowing.value) {
    emit('follow', {
      roomId: props.roomId,
      nickname: nickname.value,
      roomTitle: roomTitle.value,
      avatarUrl: avatarUrl.value,
      isLive: isLive.value
    })
  } else {
    emit('unfollow', props.roomId)
  }
}

onMounted(() => {
  if (props.roomId) {
    fetchRoomInfo()
  }
})

watch(() => props.roomId, (newId) => {
  if (newId) {
    fetchRoomInfo()
  }
})

watch(() => props.isFollowed, (newValue) => {
  isFollowing.value = newValue || false;
});
</script>

<style scoped>
.streamer-info {
  padding: 20px;
  background: var(--component-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 24px var(--shadow-color);
}

.info-layout {
  display: flex;
  gap: 20px;
  align-items: center;
}

.streamer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.streamer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.streamer-avatar img:hover {
  transform: scale(1.1);
}

.avatar-text {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  display: none;
}

.streamer-avatar:has(.avatar-text[v-show="true"]) {
  background: linear-gradient(135deg, #1a237e, #0d47a1);
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-title {
  font-size: 18px;
  color: var(--primary-text);
  margin: 0;
  font-weight: 600;
  line-height: 1.3;
}

.streamer-details {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nickname {
  font-size: 14px;
  color: var(--primary-text);
  font-weight: 500;
  opacity: 0.8;
}

.meta-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--meta-bg);
  padding: 1px;
  border-radius: 4px;
}

.room-id {
  font-size: 12px;
  color: var(--secondary-text);
  padding: 1px 6px;
}

.status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 10px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.status.live {
  color: #fff;
  background: #2196f3;
}

.status.replay {
  color: #fff;
  background: #ff9800;
}

.follow-btn {
  padding: 6px 20px;
  border-radius: 4px;
  border: none;
  background: #2196f3;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
}

.follow-btn:hover {
  background: #1e88e5;
}

.follow-btn.following {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--button-text);
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  height: 16px;
}

.btn-text {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}
</style> 