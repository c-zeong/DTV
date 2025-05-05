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
          <div class="card-avatar">
            <img :src="streamer.avatarUrl" :alt="streamer.nickname">
          </div>
          <div class="card-info">
            <div class="streamer-name">
              {{ streamer.nickname }}
            </div>
            <div class="room-title">{{ streamer.roomTitle }}</div>
          </div>
          <div class="status-dot" :class="{ 'is-live': streamer.isLive }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

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

<style scoped>
.follow-list {
  width: 240px;
  background: var(--component-bg);
  border-radius: 12px;
  margin: 16px 0 16px 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 24px var(--shadow-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  padding: 16px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  background: var(--component-bg);
}

.list-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--primary-text);
}

.refresh-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: #2196f3;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 24px;
  line-height: 24px;
  display: flex;
  align-items: center;
}

.refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.refresh-btn:hover:not(:disabled) {
  background: #1e88e5;
}

.refresh-btn.refreshing {
  background: #1976d2;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.streamers-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.streamer-card {
  padding: 8px 8px 8px 6px;
  border-radius: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  position: relative;
  user-select: none;
}

.streamer-card:hover {
  background: var(--card-hover-bg);
}

.streamer-card.dragging {
  opacity: 0.5;
  background: var(--card-hover-bg);
}

.card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  margin: 0 2px;
  border: 2px solid var(--border-color);
}

.card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.streamer-name {
  font-size: 14px;
  color: var(--primary-text);
  font-weight: 500;
}

.room-title {
  font-size: 12px;
  color: var(--secondary-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-offline);
  flex-shrink: 0;
}

.status-dot.is-live {
  background: var(--status-live);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

/* 自定义滚动条样式 */
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
  background: rgba(255, 255, 255, 0.2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  height: 100%;
  color: var(--secondary-text);
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--secondary-text);
  opacity: 0.8;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--primary-text);
}

.empty-state p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
</style> 