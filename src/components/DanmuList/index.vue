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
        <div v-if="!messages || messages.length === 0" class="empty-danmu-placeholder">
          <p>暂无弹幕</p>
          <p v-if="!props.roomId">请先选择一个直播间</p>
          <p v-else>连接中或弹幕稀疏...</p>
        </div>
        <div v-for="(danmaku, index) in messages" :key="index" class="danmu-item">
          <div class="danmu-meta-line">
            <span v-if="danmaku.badgeName" class="danmu-badge">
              <span class="badge-name">{{ danmaku.badgeName }}</span>
              <span v-if="danmaku.badgeLevel" class="badge-level">{{ danmaku.badgeLevel }}</span>
            </span>
            <span class="danmu-user" :style="{ color: danmaku.color || userColor(danmaku.nickname) }">
              <span v-if="danmaku.level" class="user-level">[Lv.{{ danmaku.level }}]</span>
              {{ danmaku.nickname }}:
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
  import { ref, watch, nextTick, type PropType } from 'vue';
  // import { invoke } from '@tauri-apps/api/core'; // No longer directly used for start_danmaku_listener
  import { listen } from '@tauri-apps/api/event';
  import { startDanmakuListener, getCurrentPlatform } from '../../platforms/common/apiService';
  import { CommonDanmakuMessage } from '../../platforms/common/types'; // Import common type
  import { parseDouyuDanmakuMessage } from '../../platforms/douyu/parsers'; // Import Douyu parser
  // TODO: Import other platform parsers as needed
  // import { parseBilibiliDanmakuMessage } from '../../platforms/bilibili/parsers';
  
  // Assuming DanmakuMessage from player/index.vue is the structure of messages passed in props
  // If not, this interface needs to match the actual structure provided by player/index.vue
  interface DanmakuUIMessage { // Renamed to avoid conflict if CommonDanmakuMessage is very different
    id?: string; // If your messages have unique IDs, use them for :key for better performance
    nickname: string;
    content: string;
    level?: string; // Made optional to match player/index.vue's DanmakuMessage
    badgeName?: string;
    badgeLevel?: string;
    color?: string;
    // Ensure all fields used in the template are here
    // sender?: { nickname: string; level?: string; badgeName?: string; badgeLevel?: string }; // if sender is an object
  }
  
  const props = defineProps<{
    roomId: string | null;
    messages: DanmakuUIMessage[]; // Use PropType for complex types if needed, or direct type here
                                  // Make sure DanmakuUIMessage matches what player/index.vue provides in danmakuMessages
  }>();
  
  const danmakuListEl = ref<HTMLElement | null>(null);
  const autoScroll = ref(true); 
  const userScrolled = ref(false);
  
  const userColor = (nickname: string | undefined) => {
    if (!nickname || nickname.length === 0) {
      const defaultHue = 0;
      const defaultSaturation = 0;
      const defaultLightness = 75;
      return `hsl(${defaultHue}, ${defaultSaturation}%, ${defaultLightness}%)`;
    }
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
      hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; 
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 75%)`;
  };
  
  const handleScroll = () => {
    if (!danmakuListEl.value) return;
    const el = danmakuListEl.value;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 50) {
      userScrolled.value = true;
    } else {
      userScrolled.value = false;
    }
  };
  
  const scrollToBottom = () => {
    nextTick(() => {
      if (danmakuListEl.value && autoScroll.value && !userScrolled.value) {
        const el = danmakuListEl.value;
        el.scrollTop = el.scrollHeight;
      }
    });
  };

  watch(autoScroll, (newValue) => {
    if (newValue) {
      userScrolled.value = false;
      scrollToBottom();
    }
  });
  
  // Watch the messages prop to scroll to bottom when new messages arrive
  watch(() => props.messages, (newMessages, oldMessages) => {
    if (newMessages && oldMessages && newMessages.length > oldMessages.length) {
      scrollToBottom();
    }
  }, { deep: true }); // deep watch might be needed if individual message objects change, though length check is often enough

  // Watch for roomId changes to clear scroll state if needed (though messages prop handles data)
  watch(() => props.roomId, () => {
      userScrolled.value = false; // Reset scroll state on room change
      autoScroll.value = true; // Default to auto scroll for new room
      nextTick(() => {
        if (danmakuListEl.value) danmakuListEl.value.scrollTop = 0; // Scroll to top for new room, then auto-scroll will take over if messages come in
        scrollToBottom(); // Attempt to scroll to bottom immediately if there are messages for the new room
      });
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
    text-align: left;
    padding: 4px 6px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.1);
    word-wrap: break-word;
    overflow-wrap: break-word;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: transform 0.15s ease-out, background-color 0.15s ease;
    display: flex;
    flex-direction: column;
    max-width: 100%; 
  }
  
  .danmu-item:hover {
    background: linear-gradient(to right, rgba(0,0,0,0.3), rgba(0,0,0,0.15));
    transform: translateY(-1px);
  }
  
  .danmu-meta-line {
    font-size: 0.8rem;
    color: var(--secondary-text, #aaa);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .danmu-badge {
    background-color: var(--tag-bg, #FB7299); 
    color: #ffffff; 
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem; 
    margin-right: 8px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    height: auto;
    line-height: normal;
    flex-shrink: 0;
  }
  
  .badge-name {
    /* Style for badge name if needed */
  }
  
  .badge-level {
    margin-left: 4px;
    font-weight: bold;
    font-size: 0.65rem; 
  }
  
  .danmu-user {
    font-weight: 500;
    margin-right: 5px;
  }
  
  .user-level {
    font-size: 0.7rem;
    color: var(--meta-text, #ababab); 
    margin-right: 5px;
  }
  
  .danmu-content-line {
    font-size: 0.85rem;
    line-height: 1.4;
  }
  
  .danmu-content {
    color: var(--primary-text-light, #f0f0f0); 
    white-space: pre-wrap; 
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-size: 0.875rem; 
    line-height: 1.4;
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