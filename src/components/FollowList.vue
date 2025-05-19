<template>
  <div class="follow-list">
    <div class="list-header">
      <h3>关注列表</h3>
      <button 
        @click="refreshList" 
        class="refresh-btn"
        :class="{ 'refreshing': isRefreshing }"
        :disabled="isRefreshing"
      >
        <span class="btn-text">{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
      </button>
    </div>
    <div class="list-content" ref="listRef">
      <div v-if="streamers.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8.5V7M12 12.5V11M12 16.5V15M12 20.5V19M8 8.5V7M8 12.5V11M8 16.5V15M8 20.5V19M4 8.5V7M4 12.5V11M4 16.5V15M4 20.5V19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M19 10.5C19 11.8807 17.8807 13 16.5 13C15.1193 13 14 11.8807 14 10.5C14 9.11929 15.1193 8 16.5 8C17.8807 8 19 9.11929 19 10.5Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <h3>还没有关注主播</h3>
        <p>点击右上角搜索按钮添加你喜欢的主播</p>
      </div>
      <div v-else class="streamers-container">
        <div
          v-for="(streamer, index) in streamers"
          :key="streamer.roomId"
          :data-room-id="streamer.roomId"
          class="streamer-card"
          :class="{ 
            'live': streamer.isLive,
            'dragging': isDragging && draggedIndex === index
          }"
          @mousedown="handleMouseDown($event, index)"
          @click="handleClick($event, streamer)"
        >
          <div class="card-content">
            <div class="card-avatar">
              <img :src="streamer.avatarUrl" :alt="streamer.nickname">
              <div class="status-dot" :class="{ 'is-live': streamer.isLive }"></div>
            </div>
            <div class="card-info">
              <div class="streamer-row">
                <span class="streamer-name">{{ streamer.nickname }}</span>
                <span v-if="streamer.isLive" class="live-badge">
                  <span class="dot"></span>
                  直播中
                </span>
              </div>
              <div class="room-title">{{ streamer.roomTitle }}</div>
            </div>
          </div>
          <div class="card-actions">
            <div class="action-dot"></div>
            <div class="action-dot"></div>
            <div class="action-dot"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.follow-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.list-header h3 {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.refresh-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  display: flex;
  align-items: center;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.refresh-btn.refreshing {
  opacity: 0.5;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.streamers-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.streamer-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
  overflow: hidden;
}

.streamer-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
}

.card-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.streamer-card:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(4px);
}

.streamer-card.live {
  background: rgba(255, 255, 255, 0.05);
}

.card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  transition: transform 0.3s ease;
}

.streamer-card:hover .card-avatar {
  transform: scale(1.05);
}

.card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  border: 2px solid rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.status-dot.is-live {
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.streamer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.streamer-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.2px;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.live-badge .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.5s ease-in-out infinite;
}

.room-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}

.streamer-card:hover .room-title {
  color: rgba(255, 255, 255, 0.7);
}

.card-actions {
  display: flex;
  gap: 2px;
  padding-left: 12px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.2s ease;
}

.streamer-card:hover .card-actions {
  opacity: 1;
  transform: translateX(0);
}

.action-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
}

/* 滚动条样式 */
.list-content::-webkit-scrollbar {
  width: 4px;
}

.list-content::-webkit-scrollbar-track {
  background: transparent;
}

.list-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.list-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Empty State Styles */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 8px;
}

.empty-state h3 {
  margin: 0 0 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.empty-state p {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.4);
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Streamer } from '../types/streamer';
import type { RoomInfo } from '../types/streamer';

const emit = defineEmits(['select']);
const isRefreshing = ref(false);
const listRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const draggedIndex = ref(-1);
const startY = ref(0);
const currentY = ref(0);
const streamers = ref<Streamer[]>([]);

// 从本地存储加载关注列表
const loadFollowList = () => {
  const savedList = localStorage.getItem('followList');
  if (savedList) {
    try {
      streamers.value = JSON.parse(savedList);
    } catch (e) {
      console.error('Failed to load follow list:', e);
    }
  } else {
  }
};

// 保存关注列表到本地存储
const saveFollowList = () => {
  localStorage.setItem('followList', JSON.stringify(streamers.value));
};

// 添加关注
const addStreamer = (streamer: Streamer) => {
  const index = streamers.value.findIndex(s => s.roomId === streamer.roomId);
  if (index === -1) {
    streamers.value = [...streamers.value, streamer];
    saveFollowList();
  }
};

// 取消关注
const removeStreamer = (roomId: string) => {
  streamers.value = streamers.value.filter(s => s.roomId !== roomId);
  saveFollowList();
};

const handleClick = (e: MouseEvent, streamer: Streamer) => {
  if (isDragging.value) {
    e.preventDefault();
    return;
  }
  emit('select', streamer);
};

const handleMouseDown = (e: MouseEvent, index: number) => {
  if (e.button !== 0) return;
  
  isDragging.value = true;
  draggedIndex.value = index;
  startY.value = e.clientY;
  currentY.value = e.clientY;
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  e.preventDefault();
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  
  currentY.value = e.clientY;
  const container = listRef.value?.querySelector('.streamers-container');
  if (!container) return;
  
  const cards = Array.from(container.children) as HTMLElement[];
  const draggedCard = cards[draggedIndex.value];
  if (!draggedCard) return;
  
  const moveY = currentY.value - startY.value;
  const cardHeight = draggedCard.offsetHeight;
  
  // 计算移动的格数
  const moveSteps = Math.round(moveY / cardHeight);
  const newIndex = draggedIndex.value + moveSteps;
  
  if (newIndex >= 0 && newIndex < cards.length && newIndex !== draggedIndex.value) {
    const newStreamers = [...streamers.value];
    const [removed] = newStreamers.splice(draggedIndex.value, 1);
    newStreamers.splice(newIndex, 0, removed);
    streamers.value = newStreamers;
    draggedIndex.value = newIndex;
    startY.value = e.clientY;
  }
};

const handleMouseUp = () => {
  if (!isDragging.value) return;
  
  // 保存更新后的列表
  saveFollowList();
  
  // 重置状态
  isDragging.value = false;
  draggedIndex.value = -1;
  
  // 移除事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 刷新列表
const refreshList = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;

  try {
    const updates = await Promise.all(
      streamers.value.map(async (streamer) => {
        try {
          const data = await invoke<RoomInfo>('fetch_room_info', { 
            roomId: streamer.roomId 
          });
          
          if (data.room) {
            const showStatus = Number(data.room.show_status)
            const videoLoop = Number(data.room.videoLoop)
            const isReallyLive = showStatus === 1 && videoLoop !== 1
            return {
              ...streamer,
              isLive: isReallyLive,
              nickname: data.room.nickname,
              roomTitle: data.room.room_name,
              avatarUrl: data.room.avatar_mid,
            };
          }
          return null;
        } catch (e) {
          console.error(`Failed to refresh streamer ${streamer.roomId}:`, e);
          return null;
        }
      })
    );

    const validUpdates = updates.filter((update): update is Streamer => update !== null);
    
    // 按直播状态排序，保持每个分组内的原有顺序
    const liveStreamers = validUpdates.filter(s => s.isLive);
    const offlineStreamers = validUpdates.filter(s => !s.isLive);
    
    // 合并排序后的列表
    streamers.value = [...liveStreamers, ...offlineStreamers];
    saveFollowList();
  } catch (e) {
    console.error('Failed to refresh streamers:', e);
  } finally {
    isRefreshing.value = false;
  }
};

// 导出方法和属性供父组件使用
defineExpose({
  addStreamer,
  removeStreamer,
  streamers
});

onMounted(async () => {
  loadFollowList();
  await refreshList();
});
</script>