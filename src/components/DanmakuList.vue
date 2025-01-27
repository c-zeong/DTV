<template>
  <div class="danmaku-container">
    <div class="danmaku-header">
      <h3>弹幕列表</h3>
    </div>
    <div class="list-content" ref="danmakuListEl">
      <div v-for="(danmaku, index) in danmakuList" :key="index" class="danmaku-card">
        <div class="card-header">
          <div class="user-info">
            <span class="level">Lv.{{ danmaku.level }}</span>
            <span class="nickname">{{ danmaku.nickname }}</span>
          </div>
          <div v-if="danmaku.badgeName" class="badge">
            <span class="badge-name">{{ danmaku.badgeName }}</span>
            <span class="badge-level">{{ danmaku.badgeLevel }}</span>
          </div>
        </div>
        <div class="content-wrapper">
          <p class="content">{{ danmaku.content }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event'

interface DanmakuMessage {
  nickname: string;
  level: string;
  content: string;
  badgeName?: string;
  badgeLevel?: string;
}

const props = defineProps<{
  roomId: string;
}>();

const danmakuList = ref<DanmakuMessage[]>([]);
const danmakuListEl = ref<HTMLElement | null>(null);
let unlisten: (() => void) | null = null;
let shouldScroll = true;

// 检查是否应该自动滚动
const checkShouldScroll = (el: HTMLElement) => {
  const { scrollTop, scrollHeight, clientHeight } = el;
  // 如果用户滚动到距离底部20px以内，就继续自动滚动
  shouldScroll = scrollHeight - scrollTop - clientHeight < 20;
};

// 监听弹幕消息
const listenDanmaku = async (roomId: string) => {
  try {
    // 如果存在之前的监听器，先移除
    if (unlisten) {
      await unlisten();
    }

    // 启动弹幕监听
    await invoke('start_danmaku', { roomId });
    
    // 注册事件监听器接收弹幕
    unlisten = await listen<DanmakuMessage>('danmaku', (event) => {
      danmakuList.value.push(event.payload);
      // 保持最新的弹幕可见
      nextTick(() => {
        if (danmakuListEl.value && shouldScroll) {
          danmakuListEl.value.scrollTop = danmakuListEl.value.scrollHeight;
        }
      });
      
      // 限制弹幕列表长度
      if (danmakuList.value.length > 200) {
        danmakuList.value = danmakuList.value.slice(-200);
      }
    });

    // 添加滚动事件监听
    if (danmakuListEl.value) {
      danmakuListEl.value.addEventListener('scroll', () => {
        if (danmakuListEl.value) {
          checkShouldScroll(danmakuListEl.value);
        }
      });
    }
  } catch (error) {
    console.error('弹幕监听失败:', error);
  }
};

// 监听房间号变化
watch(() => props.roomId, (newRoomId) => {
  if (newRoomId) {
    danmakuList.value = []; // 清空之前的弹幕
    listenDanmaku(newRoomId);
  }
});

// 组件卸载时清理监听器
onUnmounted(async () => {
  if (unlisten) {
    await unlisten();
  }
});
</script>

<style scoped>
.danmaku-container {
  width: 300px;
  height: 100%;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 24px var(--shadow-color);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
}

.danmaku-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--component-bg);
}

.danmaku-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--primary-text);
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.danmaku-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  opacity: 0.85;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.level {
  background: #2196F3;
  color: white;
  padding: 0 3px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
}

.nickname {
  color: var(--secondary-text);
  font-weight: 600;
  font-size: 11px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--card-hover-bg);
  padding: 0 3px;
  border-radius: 6px;
  font-size: 10px;
  line-height: 16px;
}

.badge-name {
  color: var(--secondary-text);
  font-size: 10px;
}

.badge-level {
  color: var(--secondary-text);
  font-size: 10px;
  font-weight: normal;
}

.content-wrapper {
  background: var(--card-hover-bg);
  border-radius: 4px;
  padding: 4px 8px;
  margin-top: 4px;
}

.content {
  color: var(--primary-text);
  margin: 0;
  line-height: 1.5;
  font-size: 13px;
  font-weight: 400;
  word-wrap: break-word;
  word-break: break-all;
  white-space: pre-wrap;
  max-width: 100%;
}

/* 自定义滚动条样式 */
.list-content::-webkit-scrollbar {
  width: 6px;
}

.list-content::-webkit-scrollbar-track {
  background: transparent;
  margin: 6px 0;
}

.list-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.list-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.fan-badge {
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 12px;
  margin-right: 4px;
  background: rgba(33, 150, 243, 0.15);
  color: #1976d2;
}

/* 深色模式下的粉丝牌样式 */
:root.dark-mode .fan-badge {
  background: rgba(33, 150, 243, 0.2);
  color: #64b5f6;
}
</style> 