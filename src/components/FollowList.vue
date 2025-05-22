<template>
  <div class="follow-list">
    <div class="list-header">
      <h3 class="header-title">关注列表</h3>
      <div class="header-actions">
        <button 
          @click="refreshList" 
          class="action-btn refresh-btn"
          :disabled="isRefreshing"
          title="刷新列表"
        >
          <span class="icon" :class="{ 'refreshing': isRefreshing }">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </span>
        </button>
      </div>
    </div>
    
    <div class="list-content" ref="listRef">
      <div v-if="streamers.length === 0" class="empty-state">
        <div class="empty-image">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="feather feather-heart">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
        <h3 class="empty-title">暂无关注主播</h3>
        <p class="empty-text">关注主播后，他们会出现在这里</p>
      </div>
      
      <TransitionGroup 
        v-else 
        tag="ul" 
        name="streamer-list"
        class="streamers-list"
      >
        <li
          v-for="(streamer, index) in streamers"
          :key="streamer.roomId"
          class="streamer-item"
          :class="{ 
            'is-live': streamer.isLive,
            'is-dragging': isDragging && draggedIndex === index,
            'just-added': justAddedIds.includes(streamer.roomId)
          }"
          @mousedown="handleMouseDown($event, index)"
          @click="handleClick($event, streamer)"
        >
          <div class="item-content">
            <div class="avatar-container">
              <img 
                v-if="streamer.avatarUrl" 
                :src="streamer.avatarUrl" 
                :alt="streamer.nickname"
                class="avatar-image"
              >
              <div v-else class="avatar-fallback">{{ streamer.nickname[0] }}</div>
            </div>
            
            <div class="streamer-details">
              <div class="primary-row">
                <span class="nickname" :title="streamer.nickname">{{ streamer.nickname }}</span>
              </div>
              
              <div class="secondary-row" :title="streamer.roomTitle">
                {{ streamer.roomTitle || '暂无直播标题' }}
              </div>
            </div>
          </div>
          
          <div class="status-container">
            <div class="live-indicator" :class="{'is-live': streamer.isLive}"></div>
          </div>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Streamer } from '../types/streamer';
import type { RoomInfo } from '../types/streamer';

const props = defineProps<{
  followedAnchors: Streamer[]
}>();

const emit = defineEmits(['selectAnchor', 'unfollow', 'reorderList']);
const isRefreshing = ref(false);
const listRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const draggedIndex = ref(-1);
const startY = ref(0);
const currentY = ref(0);
const justAddedIds = ref<string[]>([]);
const animationTimeout = ref<number | null>(null);

// 确保至少旋转一圈的动画持续时间(ms)
const MIN_ANIMATION_DURATION = 1500;

// Use computed property to access followedAnchors from props
const streamers = computed(() => props.followedAnchors);

// 监听关注列表变化，检测新添加的主播
watch(() => props.followedAnchors, (newVal, oldVal) => {
  // 如果是初始化，不处理
  if (!oldVal || oldVal.length === 0) return;
  
  // 找出新增的主播
  const oldIds = oldVal.map(streamer => streamer.roomId);
  const newStreamers = newVal.filter(streamer => !oldIds.includes(streamer.roomId));
  
  // 如果有新增主播，添加到justAddedIds
  if (newStreamers.length > 0) {
    newStreamers.forEach(streamer => {
      justAddedIds.value.push(streamer.roomId);
      // 3秒后移除高亮
      setTimeout(() => {
        justAddedIds.value = justAddedIds.value.filter(id => id !== streamer.roomId);
      }, 3000);
    });
  }
}, { deep: true });

const handleClick = (e: MouseEvent, streamer: Streamer) => {
  if (isDragging.value) {
    e.preventDefault();
    return;
  }
  emit('selectAnchor', streamer);
};

// 处理鼠标按下事件，开始拖动
const handleMouseDown = (e: MouseEvent, index: number) => {
  if (e.button !== 0) return;
  
  isDragging.value = true;
  draggedIndex.value = index;
  startY.value = e.clientY;
  currentY.value = e.clientY;
  
  // 在文档级别添加事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  e.preventDefault();
};

// 处理鼠标移动事件，实现拖动效果
const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  
  currentY.value = e.clientY;
  const container = listRef.value?.querySelector('.streamers-list');
  if (!container) return;
  
  const items = Array.from(container.children) as HTMLElement[];
  const draggedItem = items[draggedIndex.value];
  if (!draggedItem) return;
  
  const moveY = currentY.value - startY.value;
  const itemHeight = draggedItem.offsetHeight;
  
  const moveSteps = Math.round(moveY / itemHeight);
  const newIndex = draggedIndex.value + moveSteps;
  
  // 确保新索引在有效范围内
  if (newIndex >= 0 && newIndex < items.length && newIndex !== draggedIndex.value) {
    // 创建重新排序后的数组
    const reorderedStreamers = [...streamers.value];
    const [removed] = reorderedStreamers.splice(draggedIndex.value, 1);
    reorderedStreamers.splice(newIndex, 0, removed);
    
    // 通知父组件更新顺序
    emit('reorderList', reorderedStreamers);
    
    // 更新当前拖动的索引和起始位置
    draggedIndex.value = newIndex;
    startY.value = e.clientY;
  }
};

// 处理鼠标释放事件，结束拖动
const handleMouseUp = () => {
  if (!isDragging.value) return;
  
  isDragging.value = false;
  draggedIndex.value = -1;
  
  // 移除文档级别的事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

const handleUnfollow = (roomId: string) => {
  emit('unfollow', roomId);
};

// 清除任何现有的动画超时
const clearAnimationTimeout = () => {
  if (animationTimeout.value !== null) {
    clearTimeout(animationTimeout.value);
    animationTimeout.value = null;
  }
};

// Refresh the list
const refreshList = async () => {
  if (isRefreshing.value) return;
  
  // 记录开始时间
  const startTime = Date.now();
  isRefreshing.value = true;
  
  try {
    const updates = await Promise.all(
      props.followedAnchors.map(async (streamer) => {
        try {
          const data = await invoke<RoomInfo>('fetch_room_info', { 
            roomId: streamer.roomId 
          });
          
          if (data.room) {
            const showStatus = Number(data.room.show_status);
            const videoLoop = Number(data.room.videoLoop);
            const isReallyLive = showStatus === 1 && videoLoop !== 1;
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
    
    // 按在线状态排序
    if (validUpdates.length > 0) {
      const liveStreamers = validUpdates.filter(s => s.isLive);
      const offlineStreamers = validUpdates.filter(s => !s.isLive);
      
      emit('reorderList', [...liveStreamers, ...offlineStreamers]);
    }
  } catch (e) {
    console.error('Failed to refresh streamers:', e);
  } finally {
    // 计算已经过去的时间
    const elapsedTime = Date.now() - startTime;
    
    // 如果过去的时间小于最小动画持续时间，等待剩余时间
    if (elapsedTime < MIN_ANIMATION_DURATION) {
      clearAnimationTimeout();
      animationTimeout.value = window.setTimeout(() => {
        isRefreshing.value = false;
        animationTimeout.value = null;
      }, MIN_ANIMATION_DURATION - elapsedTime);
    } else {
      // 已经超过最小时间，直接停止动画
      isRefreshing.value = false;
    }
  }
};

// 组件卸载时清除定时器
onMounted(() => {
  refreshList();
});

// 组件卸载时清除定时器
onUnmounted(() => {
  clearAnimationTimeout();
});
</script>

<style scoped>
.follow-list {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--component-bg, #1a1b1e);
  border-radius: 4px;
  overflow: hidden;
}

/* Header styles */
.list-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  background: var(--header-bg, rgba(25, 26, 31, 0.8));
}

.header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-text, #ffffff);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--secondary-text, rgba(255, 255, 255, 0.6));
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  background: var(--button-hover-bg, rgba(255, 255, 255, 0.15));
  color: var(--primary-text, #ffffff);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btn:active {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon.refreshing {
  color: rgba(80, 130, 255, 0.9);
  animation: spin 2s linear infinite;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.05);
}

.refresh-btn:disabled {
  background: rgba(80, 130, 255, 0.15);
  cursor: default;
  transform: none;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}

/* Content area */
.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--secondary-text, rgba(255, 255, 255, 0.6));
  padding: 16px;
  text-align: center;
}

.empty-image {
  margin-bottom: 16px;
  opacity: 0.2;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-text, #ffffff);
}

.empty-text {
  margin: 0;
  font-size: 14px;
}

/* Streamer list */
.streamers-list {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 224px;
  width: 100%;
}

.streamer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--card-bg, rgba(255, 255, 255, 0.03));
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
}

.streamer-item:hover {
  background: var(--card-hover-bg, rgba(255, 255, 255, 0.05));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.streamer-item:active {
  transform: translateY(0);
}

/* Live streamer styling */
.streamer-item.is-live {
  background: linear-gradient(to right, 
    rgba(16, 185, 129, 0.03) 0%,
    rgba(16, 185, 129, 0.05) 50%,
    rgba(16, 185, 129, 0.03) 100%
  );
  border: 1px solid rgba(16, 185, 129, 0.15);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
}

.streamer-item.is-live:hover {
  background: linear-gradient(to right, 
    rgba(16, 185, 129, 0.05) 0%,
    rgba(16, 185, 129, 0.07) 50%,
    rgba(16, 185, 129, 0.05) 100%
  );
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.streamer-item.is-dragging {
  opacity: 0.7;
  transform: scale(1.02);
  z-index: 10;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

.streamer-item.just-added {
  animation: glow-new 2s ease;
}

@keyframes glow-new {
  0% { box-shadow: 0 0 0 rgba(16, 185, 129, 0); border-color: rgba(16, 185, 129, 0.1); }
  30% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); border-color: rgba(16, 185, 129, 0.4); }
  100% { box-shadow: 0 0 0 rgba(16, 185, 129, 0); border-color: transparent; }
}

.item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.avatar-container {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--card-bg, rgba(255, 255, 255, 0.03));
}

.avatar-image {
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
  background: linear-gradient(135deg, #6b46c1, #3f83f8);
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.status-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 6px;
}

.live-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.3s ease;
}

/* Live indicator dot styling - simplified */
.live-indicator.is-live {
  background: #10b981;
}

.streamer-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.primary-row {
  display: flex;
  align-items: center;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-text, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  letter-spacing: 0.2px;
  text-align: left;
}

/* Live streamer text styling */
.streamer-item.is-live .nickname {
  color: rgba(16, 185, 129, 0.9);
  text-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
}

.secondary-row {
  font-size: 12px;
  color: var(--secondary-text, rgba(255, 255, 255, 0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  text-align: left;
}

/* Live streamer subtitle styling */
.streamer-item.is-live .secondary-row {
  color: var(--secondary-text, rgba(255, 255, 255, 0.65));
}

/* List transitions */
.streamer-list-enter-active,
.streamer-list-leave-active {
  transition: all 0.3s ease;
}

.streamer-list-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.streamer-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.streamer-list-move {
  transition: transform 0.5s ease;
}

/* Scrollbar styles */
.list-content::-webkit-scrollbar {
  width: 4px;
}

.list-content::-webkit-scrollbar-track {
  background: transparent;
}

.list-content::-webkit-scrollbar-thumb {
  background: var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 2px;
}

.list-content::-webkit-scrollbar-thumb:hover {
  background: var(--secondary-text, rgba(255, 255, 255, 0.2));
}
</style>