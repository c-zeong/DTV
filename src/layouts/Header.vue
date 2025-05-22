<template>
  <header class="app-header">
    <div class="search-container">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          placeholder="搜索主播..." 
          @input="handleSearch"
          @focus="showResults = true"
          @blur="handleBlur"
          class="search-input"
        />
        <button class="search-button" @click="doSearch">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-4-4" 
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      
      <div v-show="showResults && searchResults.length > 0" class="search-results">
        <div v-for="anchor in searchResults" 
             :key="anchor.roomId"
             class="search-result-item"
             @mousedown="selectAnchor(anchor)"
        >
          <div class="result-avatar">
            <img v-if="anchor.avatar" :src="anchor.avatar" :alt="anchor.userName">
            <div v-else class="avatar-placeholder">{{ anchor.userName[0] }}</div>
          </div>
          <div class="result-info">
            <div class="result-name">{{ anchor.userName }}</div>
            <div class="result-status" :class="{ 'is-live': anchor.liveStatus }">
              {{ anchor.liveStatus ? '直播中' : '未开播' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <button class="theme-btn" @click="toggleTheme">
      <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 5V3M12 21v-2M5 12H3m18 0h-2M17.7 17.7l1.4 1.4M4.9 4.9l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" 
          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { LiveAnchorItem } from '../types/streamer';
import { invoke } from '@tauri-apps/api/core';

const searchQuery = ref('');
const searchResults = ref<LiveAnchorItem[]>([]);
const showResults = ref(false);
const isDark = ref(false);

const emit = defineEmits(['themeChange', 'selectAnchor']);

let searchTimeout: number | null = null;

const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  searchTimeout = window.setTimeout(() => {
    performSearch();
  }, 300);
};

const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    showResults.value = false;
    return;
  }

  try {
    const response = await invoke<string>('search_anchor', { 
      keyword: searchQuery.value 
    });
    
    const data = JSON.parse(response);

    if (data.error === 0) {
      searchResults.value = data.data.relateUser
        .filter((item: any) => item.type === 1)
        .map((item: any) => {
          const anchorInfo = item.anchorInfo;
          const isReallyLive = anchorInfo.isLive === 1 && anchorInfo.videoLoop !== 1;
          return {
            roomId: anchorInfo.rid.toString(),
            userName: anchorInfo.nickName,
            avatar: anchorInfo.avatar,
            liveStatus: isReallyLive,
            fansCount: anchorInfo.fansNumStr,
            category: anchorInfo.cateName,
            description: anchorInfo.description
          };
        });
      showResults.value = true;
    }
  } catch (e) {
    console.error('搜索失败:', e);
    searchResults.value = [];
  }
};

const doSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  performSearch();
};

const handleBlur = () => {
  setTimeout(() => {
    showResults.value = false;
  }, 200);
};

const selectAnchor = async (anchor: LiveAnchorItem) => {
  emit('selectAnchor', {
    id: parseInt(anchor.roomId),
    name: anchor.userName,
    category: anchor.category || '',
    isLive: anchor.liveStatus,
    roomId: anchor.roomId
  });
  searchQuery.value = anchor.userName;
  showResults.value = false;
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.body.classList.toggle('dark-mode', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  emit('themeChange', isDark.value);
};

// 初始化主题
const initTheme = () => {
  // 先检查本地存储
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDark.value = savedTheme === 'dark';
  } else {
    // 如果没有保存的主题，则使用系统主题
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.body.classList.toggle('dark-mode', isDark.value);
};

// 监听系统主题变化
const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    // 只有在没有保存的主题时才跟随系统
    if (!localStorage.getItem('theme')) {
      isDark.value = e.matches;
      document.body.classList.toggle('dark-mode', isDark.value);
    }
  });
};

onMounted(() => {
  initTheme();
  watchSystemTheme();
});
</script>

<style scoped>
.app-header {
  height: 64px;
  background: var(--header-bg);
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 24px;
  justify-content: center;
}

.search-container {
  position: relative;
  width: 400px;
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--search-bg);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  background: var(--search-focus-bg);
}

.search-input {
  flex: 1;
  height: 40px;
  padding: 0 16px;
  border: none;
  background: transparent;
  color: var(--text-color);
  font-size: 14px;
  width: 100%;
}

.search-input:focus {
  outline: none;
}

.search-button {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.search-button:hover {
  color: var(--primary-text);
}

.theme-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: var(--toggle-bg);
  color: var(--toggle-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: absolute;
  right: 16px;
}

.theme-btn:hover {
  background: var(--toggle-hover-bg);
  color: var(--toggle-hover-color);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: var(--component-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 24px var(--shadow-color);
  max-height: 360px;
  overflow-y: auto;
  z-index: 1000;
  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-color);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--card-hover-bg);
}

.result-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.result-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #3a7bd5, #00d2ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.result-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-name {
  font-size: 14px;
  color: var(--primary-text);
}

.result-status {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--meta-bg);
  color: var(--secondary-text);
}

.result-status.is-live {
  background: rgba(33, 150, 243, 0.15);
  color: #2196f3;
}

/* 深色模式下的样式 */
:root.dark-mode .result-status.is-live {
  background: rgba(33, 150, 243, 0.2);
  color: #64b5f6;
}
</style>

<style>
/* 全局主题变量 */
:root {
  /* 浅色主题 */
  --header-bg: #ffffff;
  --main-bg: #f5f7fa;
  --component-bg: #ffffff;
  --card-bg: #ffffff;
  --card-hover-bg: #f8fafc;
  --card-border: #e2e8f0;
  
  /* 边框和分割线 */
  --border-color: #e2e8f0;
  
  /* 文本颜色 */
  --text-color: #334155;
  --primary-text: #334155;
  --secondary-text: #64748b;
  
  /* 搜索框 */
  --search-bg: #f1f5f9;
  --search-focus-bg: #e2e8f0;
  
  /* 主题切换按钮 */
  --toggle-bg: #f1f5f9;
  --toggle-color: #64748b;
  --toggle-hover-bg: #e2e8f0;
  --toggle-hover-color: #334155;
  
  /* 搜索结果 */
  --result-bg: #ffffff;
  --result-hover-bg: #f8fafc;
  --result-border: #e2e8f0;
  
  /* 状态指示器 */
  --status-offline: #94a3b8;
  --status-live: #10b981;
  
  /* 按钮 */
  --button-bg: #f1f5f9;
  --button-hover-bg: #e2e8f0;
  --button-text: #64748b;
  --button-hover-text: #334155;
  
  /* 阴影 */
  --shadow-color: rgba(51, 65, 85, 0.08);
  --shadow-lg: 0 4px 12px var(--shadow-color);
  
  /* 交互元素 */
  --hover-transition: all 0.2s ease;
  --active-state: #e2e8f0;
  
  /* 徽章 */
  --badge-bg: rgba(33, 150, 243, 0.1);
  --badge-text: #2196F3;
  
  /* 元信息背景 */
  --meta-bg: #e2e8f0;
}

/* 深色主题 */
.dark-mode {
  --header-bg: #1a1b1e;
  --border-color: rgba(255, 255, 255, 0.1);
  --search-bg: rgba(255, 255, 255, 0.05);
  --search-focus-bg: rgba(255, 255, 255, 0.1);
  --text-color: #ffffff;
  --toggle-bg: rgba(255, 255, 255, 0.05);
  --toggle-color: rgba(255, 255, 255, 0.8);
  --toggle-hover-bg: rgba(255, 255, 255, 0.1);
  --toggle-hover-color: #ffffff;
  --result-bg: #1a1b1e;
  --result-hover-bg: rgba(255, 255, 255, 0.05);
  --result-border: rgba(255, 255, 255, 0.1);
  /* 组件背景色 */
  --component-bg: #1a1b1e;
  /* 主窗口背景色 */
  --main-bg: #000000;
  /* 卡片样式 */
  --card-bg: rgba(255, 255, 255, 0.03);
  --card-hover-bg: rgba(255, 255, 255, 0.05);
  --card-border: rgba(255, 255, 255, 0.05);
  /* 文本颜色 */
  --primary-text: #ffffff;
  /* 状态颜色 */
  --status-offline: rgba(255, 255, 255, 0.2);
  /* 按钮颜色 */
  --button-bg: rgba(255, 255, 255, 0.05);
  --button-hover-bg: rgba(255, 255, 255, 0.1);
  --button-text: rgba(255, 255, 255, 0.8);
  --button-hover-text: #ffffff;
  /* 阴影 */
  --shadow-color: rgba(0, 0, 0, 0.3);
  
  /* 徽章 */
  --badge-bg: rgba(33, 150, 243, 0.2);
  --badge-text: #64b5f6;
  
  /* 元信息背景 */
  --meta-bg: rgba(255, 255, 255, 0.05);
}
</style>