<template>
    <div class="danmu-list-wrapper">
      <div class="danmu-header">
        <h4>弹幕列表</h4>
        <div class="danmu-controls">
          <!-- 保留功能但隐藏控件 -->
          <input type="checkbox" v-model="autoScroll" id="auto-scroll-toggle" class="hidden-toggle">
        </div>
      </div>
      <div class="danmu-messages-area" ref="danmakuListEl" @scroll="handleScroll">
        <div v-if="danmakuList.length === 0" class="empty-danmu-placeholder">
          <p>暂无弹幕</p>
          <p v-if="!props.roomId">请先选择一个直播间</p>
          <p v-else>连接中或弹幕稀疏...</p>
        </div>
        <div v-for="(danmaku) in danmakuList" :key="danmaku.id" class="danmu-item">
          <div class="danmu-meta-line">
            <span v-if="danmaku.sender.badgeName" class="danmu-badge">
              <span class="badge-name">{{ danmaku.sender.badgeName }}</span>
              <span v-if="danmaku.sender.badgeLevel" class="badge-level">{{ danmaku.sender.badgeLevel }}</span>
            </span>
            <span class="danmu-user" :style="{ color: danmaku.color || userColor(danmaku.sender.nickname) }">
              <span v-if="danmaku.sender.level" class="user-level">[Lv.{{ danmaku.sender.level }}]</span>
              {{ danmaku.sender.nickname }}:
            </span>
          </div>
          <div class="danmu-content-line">
            <span class="danmu-content">{{ danmaku.content }}</span>
          </div>
        </div>
      </div>
      <!-- Optional: Danmu input field -->
      <!-- <div class="danmu-input-area"> ... </div> -->
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch, nextTick, onUnmounted, onMounted } from 'vue';
  // import { invoke } from '@tauri-apps/api/core'; // No longer directly used for start_danmaku_listener
  import { listen } from '@tauri-apps/api/event';
  import { startDanmakuListener, getCurrentPlatform } from '../../platforms/common/apiService';
  import { CommonDanmakuMessage } from '../../platforms/common/types'; // Import common type
  import { parseDouyuDanmakuMessage } from '../../platforms/douyu/parsers'; // Import Douyu parser
  // TODO: Import other platform parsers as needed
  // import { parseBilibiliDanmakuMessage } from '../../platforms/bilibili/parsers';
  
  const props = defineProps<{
    roomId: string | null; // Allow null if no room is selected
  }>();
  
  const danmakuList = ref<CommonDanmakuMessage[]>([]); // Use CommonDanmakuMessage
  const danmakuListEl = ref<HTMLElement | null>(null);
  let unlistenDanmaku: (() => void) | null = null;
  let currentRoomId: string | null = null;
  const autoScroll = ref(true); // 默认开启自动滚动
  const userScrolled = ref(false); // 用户是否手动滚动
  
  // Simple hashing function to get a color for a user nickname
  const userColor = (nickname: string) => {
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
      hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 75%)`; // Adjusted for better readability on dark background
  };
  
  // 处理滚动事件，检测用户是否手动滚动
  const handleScroll = () => {
    if (!danmakuListEl.value) return;
    
    const el = danmakuListEl.value;
    // 如果用户向上滚动，则标记为用户手动滚动
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 50) {
      userScrolled.value = true;
    } else {
      // 如果滚动到接近底部，则重置手动滚动状态
      userScrolled.value = false;
    }
  };
  
  // 监视自动滚动设置变化
  watch(autoScroll, (newValue) => {
    if (newValue) {
      // 如果重新启用自动滚动，立即滚动到底部
      userScrolled.value = false;
      scrollToBottom();
    }
  });
  
  const scrollToBottom = () => {
    nextTick(() => {
      if (danmakuListEl.value && autoScroll.value && !userScrolled.value) {
        const el = danmakuListEl.value;
        el.scrollTop = el.scrollHeight;
      }
    });
  };
  
  const setupDanmakuListener = async (roomIdToListenFor: string) => {
    if (currentRoomId === roomIdToListenFor && unlistenDanmaku) {
      console.log('[DanmuList] Listener already active for room:', roomIdToListenFor);
      return;
    }
  
    if (unlistenDanmaku) {
      console.log('[DanmuList] Cleaning up previous listener for room:', currentRoomId);
      unlistenDanmaku();
      unlistenDanmaku = null;
    }
    
    currentRoomId = roomIdToListenFor;
    danmakuList.value = [];
    console.log('[DanmuList] Setting up listener for room:', currentRoomId);
  
    try {
      // await invoke('start_danmaku_listener', { roomId: currentRoomId }); // Old call
      await startDanmakuListener(currentRoomId); // New call via apiService
      
      // The payload from `listen` is initially `any` or the type provided by the backend (which might be a simple JSON string or object)
      unlistenDanmaku = await listen<any>('danmaku', (event) => { 
        // console.log('[DanmuList] Raw danmaku event payload:', event.payload);
        let parsedMessage: CommonDanmakuMessage | null = null;
        const platform = getCurrentPlatform(); // Get current platform to select parser

        if (platform === 'douyu') {
          parsedMessage = parseDouyuDanmakuMessage(event.payload);
        } 
        // else if (platform === 'bilibili') {
        //   parsedMessage = parseBilibiliDanmakuMessage(event.payload);
        // }
        // Add other platforms here

        if (parsedMessage) {
          // Filter which message types to display in the list
          if (parsedMessage.type === 'chat' || parsedMessage.type === 'enter') {
            danmakuList.value.push(parsedMessage);
            if (danmakuList.value.length > 300) {
              danmakuList.value.shift();
            }
            scrollToBottom();
          } else if (parsedMessage.type === 'gift'){
            // console.log('[DanmuList] Gift event:', parsedMessage);
            // Optionally handle gift messages differently (e.g., display in a separate area or a special format)
            // For now, we can push them to the list too, or filter them out
             danmakuList.value.push(parsedMessage); // Example: also show gifts in list
             if (danmakuList.value.length > 300) danmakuList.value.shift();
             scrollToBottom();
          }
        } else {
          // console.warn('[DanmuList] Failed to parse danmaku message or unhandled type:', event.payload);
        }
      });
      console.log('[DanmuList] Successfully listening for danmaku messages on room:', currentRoomId);
    } catch (error) {
      console.error('[DanmuList] Failed to start or set up danmaku listener for room:', currentRoomId, error);
      currentRoomId = null;
    }
  };
  
  const cleanupListener = () => {
    if (unlistenDanmaku) {
      console.log('[DanmuList] Cleaning up danmaku listener.');
      unlistenDanmaku();
      unlistenDanmaku = null;
    }
    if (currentRoomId) {
      // It might be good to also tell the backend to stop sending messages for this room if not handled by start_danmaku_listener itself
      // invoke('stop_danmaku_listener', { roomId: currentRoomId }).catch(e => console.error('Error stopping listener:', e));
      console.log('[DanmuList] Signalling backend to stop for room:', currentRoomId);
    }
    currentRoomId = null;
    danmakuList.value = []; // Clear messages when listener is cleaned up or room becomes null
  };
  
  onMounted(() => {
    console.log('[DanmuList] Mounted. Initial Room ID:', props.roomId);
    if (props.roomId) {
      setupDanmakuListener(props.roomId);
    }
  });
  
  watch(() => props.roomId, (newRoomId, oldRoomId) => {
    console.log('[DanmuList] Room ID changed from', oldRoomId, 'to', newRoomId);
    if (newRoomId && newRoomId !== oldRoomId) {
      setupDanmakuListener(newRoomId);
    } else if (!newRoomId) {
      cleanupListener();
    }
  }, { immediate: false }); // immediate: true could be problematic if component setup order is an issue
  
  onUnmounted(() => {
    console.log('[DanmuList] Unmounted. Cleaning up listener.');
    cleanupListener();
  });
  
  </script>
  
  <style scoped>
  .danmu-list-wrapper {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 100%;
    width: 250px; /* 减小宽度，从280px改为250px */
    background-color: var(--secondary-bg, #2c2c2e);
    color: var(--primary-text, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .danmu-header {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-color-dark, #1e1e1e);
    flex-shrink: 0;
    background-color: var(--tertiary-bg, #3a3a3c);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .danmu-header h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--primary-text-light, #f5f5f5);
  }
  
  .danmu-controls {
    display: flex;
    align-items: center;
  }
  
  .hidden-toggle {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  
  .danmu-messages-area {
    position: absolute;
    top: 40px; /* 头部高度 */
    bottom: 0;
    left: 0;
    right: 0;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .empty-danmu-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    width: 100%;
  }
  .empty-danmu-placeholder p {
    margin: 4px 0;
  }
  
  .danmu-item {
    background: linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0.1));
    padding: 8px 12px; /* Adjusted padding */
    border-radius: 8px; /* Slightly less rounded for a more structured look */
    margin-bottom: 8px; /* Spacing between items */
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: transform 0.15s ease-out, background-color 0.15s ease;
    display: flex; /* Changed to flex */
    flex-direction: column; /* Stack meta and content lines */
    max-width: 100%; 
  }
  
  .danmu-item:hover {
    background: linear-gradient(to right, rgba(0,0,0,0.3), rgba(0,0,0,0.15));
    transform: translateY(-1px);
  }
  
  .danmu-meta-line {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
    flex-wrap: nowrap; 
    max-width: 100%;
    overflow: hidden; /* 隐藏溢出内容 */
    text-overflow: ellipsis; /* 使用省略号 */
    white-space: nowrap; /* 确保不换行 */
  }
  
  .danmu-badge {
    background-color: var(--tag-bg, #FB7299); 
    color: #ffffff; 
    padding: 2px 6px; /* Adjusted padding */
    border-radius: 4px; /* Slightly more defined badge corners */
    font-size: 0.7rem; 
    margin-right: 8px; /* Increased margin */
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    height: auto; /* Auto height for badge based on content */
    line-height: normal; /* Normal line height */
    flex-shrink: 0; /* Prevent badge from shrinking */
  }
  
  .badge-name {
    /* Style for badge name if needed */
  }
  
  .badge-level {
    margin-left: 4px; /* Adjusted margin */
    font-weight: bold;
    font-size: 0.65rem; 
  }
  
  .danmu-user {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px; /* 最大宽度限制 */
    font-weight: 500;
    margin-right: 6px;
    color: #DDDDDD;
    font-size: 0.8rem;
  }
  
  .user-level {
    font-size: 0.7rem; /* Adjusted size */
    color: var(--meta-text, #ababab); 
    margin-right: 5px; /* Adjusted margin */
  }
  
  .danmu-content-line {
    /* This div will ensure content starts on a new line */
  }
  
  .danmu-content {
    color: var(--primary-text-light, #f0f0f0); 
    white-space: pre-wrap; 
    word-wrap: break-word; /* Ensure long words break */
    overflow-wrap: break-word; /* Alternative for word breaking */
    font-size: 0.875rem; 
    line-height: 1.4;
    /* The content will naturally take the width of .danmu-item */
  }
  
  /* Custom scrollbar styling (optional, WebKit browsers) */
  .danmu-messages-area::-webkit-scrollbar {
    width: 6px;
  }
  
  .danmu-messages-area::-webkit-scrollbar-track {
    background: var(--tertiary-bg, #3a3a3c);
    border-radius: 3px;
  }
  
  .danmu-messages-area::-webkit-scrollbar-thumb {
    background-color: var(--border-color-light, #5a5a5e);
    border-radius: 3px;
  }
  
  .danmu-messages-area::-webkit-scrollbar-thumb:hover {
    background-color: var(--primary-accent, #007aff);
  }
  
  /* Fallback styling for non-WebKit if needed */
  .danmu-messages-area {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color-light, #5a5a5e) var(--tertiary-bg, #3a3a3c);
  }
  
  </style>