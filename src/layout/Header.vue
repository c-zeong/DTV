<template>
  <header class="app-header">
    <div class="search-container">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          placeholder="搜索斗鱼主播 / 抖音房间ID" 
          @input="handleSearch"
          @focus="showResults = true"
          @blur="handleBlur"
          class="search-input"
        />
        <button class="search-button" @click="doSearch" :disabled="isLoadingSearch">
          <svg v-if="!isLoadingSearch" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-4-4" 
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <div v-else class="mini-spinner"></div>
        </button>
      </div>
      
      <div v-show="showResults" class="search-results-wrapper">
        <div v-if="isLoadingSearch" class="search-loading">搜索中...</div>
        <div v-else-if="searchError" class="search-error-message">{{ searchError }}</div>
        <div v-else-if="searchResults.length > 0" class="search-results-list">
          <div v-for="anchor in searchResults" 
              :key="anchor.platform + '-' + anchor.roomId"
              class="search-result-item"
              @mousedown="selectAnchor(anchor)"
          >
            <div class="result-avatar">
              <img v-if="anchor.avatar" :src="anchor.avatar" :alt="anchor.userName" class="avatar-img">
              <div v-else class="avatar-placeholder">{{ anchor.userName[0] }}</div>
            </div>
            
            <div class="result-main-content">
              <div class="result-line-1-main">
                <span class="result-name" :title="anchor.userName">{{ anchor.userName }}</span>
                <span class="live-status-badge styled-badge" :class="{ 'is-live': anchor.liveStatus }">
                  {{ anchor.liveStatus ? '直播中' : '未开播' }}
                </span>
              </div>
              <div class="result-line-2-main">
                <span class="result-room-title" :title="anchor.roomTitle || '无标题'">
                  {{ anchor.roomTitle || '无直播标题' }}
                </span>
                <span class="result-roomid styled-badge">
                  ID: {{ anchor.roomId }}
                </span>
              </div>
            </div>

            <div class="result-meta-right">
              <span class="platform-tag styled-badge" :class="anchor.platform.toLowerCase()">
                {{ anchor.platform === Platform.DOUYU ? '斗鱼' : (anchor.platform === Platform.DOUYIN ? '抖音' : anchor.platform) }}
              </span>
            </div>

          </div>
        </div>
        <div v-else-if="searchQuery.trim() && !isLoadingSearch && !searchError" class="search-no-results">
            无匹配结果。
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
import { ref, onMounted, nextTick } from 'vue';
import type { LiveAnchorItem } from '../types/streamer';
import { invoke } from '@tauri-apps/api/core';
import { Platform } from '../platforms/common/types';

interface DouyinApiStreamInfo {
  title?: string | null;
  anchor_name?: string | null;
  avatar?: string | null;
  status?: number | null;
  error_message?: string | null;
}

interface SearchResultItem {
  platform: Platform;
  roomId: string;
  userName: string;
  roomTitle?: string | null;
  avatar: string | null;
  liveStatus: boolean;
  fansCount?: string;
  category?: string;
  rawStatus?: number | null;
}

const searchQuery = ref('');
const searchResults = ref<SearchResultItem[]>([]);
const showResults = ref(false);
const searchError = ref<string | null>(null);
const isLoadingSearch = ref(false);
const isDark = ref(false);

const emit = defineEmits(['themeChange', 'selectAnchor']);

let searchTimeout: number | null = null;

const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchError.value = null;
  isLoadingSearch.value = true;
  
  searchTimeout = window.setTimeout(() => {
    performSearchBasedOnInput();
  }, 500);
};

const performSearchBasedOnInput = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    searchResults.value = [];
    showResults.value = false;
    isLoadingSearch.value = false;
    return;
  }

  const douyinIdRegex = /^\d{10,}$/;

  if (douyinIdRegex.test(query)) {
    await performDouyinIdSearch(query);
  } else {
    await performDouyuSearch(query);
  }
  isLoadingSearch.value = false;
};

const performDouyinIdSearch = async (userInputRoomId: string) => {
  searchResults.value = [];
  searchError.value = null;
  isLoadingSearch.value = true;
  try {
    const payloadData = { args: { room_id_str: userInputRoomId } };
    const douyinInfo = await invoke<DouyinApiStreamInfo>('get_douyin_live_stream_url', {
      payload: payloadData,
    });
    isLoadingSearch.value = false;
    if (douyinInfo) {
      if (douyinInfo.error_message) {
        searchError.value = douyinInfo.error_message;
      } else if (douyinInfo.anchor_name) {
        const isLive = douyinInfo.status === 2;
        searchResults.value = [{
          platform: Platform.DOUYIN,
          roomId: userInputRoomId,
          userName: douyinInfo.anchor_name || '未知抖音主播',
          roomTitle: douyinInfo.title || null,
          avatar: douyinInfo.avatar || null,
          liveStatus: isLive,
          rawStatus: douyinInfo.status,
        }];
      } else {
        searchError.value = '没有找到该抖音主播或房间信息不完整。';
      }
    } else {
      searchError.value = '未能获取抖音房间信息。';
    }
  } catch (e: any) {
    isLoadingSearch.value = false;
    searchError.value = typeof e === 'string' ? e : '搜索抖音主播失败，请检查网络或ID。';
  }
  showResults.value = true;
};

const performDouyuSearch = async (keyword: string) => {
  searchResults.value = [];
  searchError.value = null;
  isLoadingSearch.value = true;
  try {
    const response = await invoke<string>('search_anchor', { keyword });
    isLoadingSearch.value = false;
    const data = JSON.parse(response);
    if (data.error === 0 && data.data && data.data.relateUser) {
      searchResults.value = data.data.relateUser
        .filter((item: any) => item.type === 1)
        .map((item: any): SearchResultItem => {
          const anchorInfo = item.anchorInfo;
          const isReallyLive = anchorInfo.isLive === 1 && anchorInfo.videoLoop !== 1;
          return {
            platform: Platform.DOUYU,
            roomId: anchorInfo.rid.toString(),
            userName: anchorInfo.nickName,
            roomTitle: anchorInfo.roomName || anchorInfo.description || null,
            avatar: anchorInfo.avatar,
            liveStatus: isReallyLive,
            fansCount: anchorInfo.fansNumStr,
            category: anchorInfo.cateName,
          };
        });
      if (searchResults.value.length === 0) {
        searchError.value = '没有找到相关斗鱼主播。';
      } else {
        searchError.value = null;
      }
    } else {
      searchError.value = '搜索斗鱼主播失败或无结果。';
    }
  } catch (e) {
    isLoadingSearch.value = false;
    searchError.value = '搜索斗鱼主播时发生错误。';
  }
  showResults.value = true;
};

const doSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  isLoadingSearch.value = true;
  performSearchBasedOnInput();
};

const handleBlur = () => {
  setTimeout(() => {
    if (!isLoadingSearch.value && !searchError.value) {
       showResults.value = false;
    }
  }, 300);
};

const selectAnchor = (anchor: SearchResultItem) => {
  emit('selectAnchor', {
    id: anchor.roomId,
    platform: anchor.platform,
    nickname: anchor.userName,
    avatarUrl: anchor.avatar,
  });
  searchQuery.value = '';
  searchResults.value = [];
  searchError.value = null;
  showResults.value = false;
  isLoadingSearch.value = false;
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.body.classList.toggle('dark-mode', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  emit('themeChange', isDark.value);
};

const initTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDark.value = savedTheme === 'dark';
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.body.classList.toggle('dark-mode', isDark.value);
};

const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
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
  font-size: 13px;
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

.search-results-wrapper {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  background: var(--dropdown-bg, #2c2f38);
  border: 1px solid var(--border-color, #3a3f4b);
  border-radius: 10px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.2);
  z-index: 1000;
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb-color, var(--toggle-color, #5a5e6b)) var(--scrollbar-track-color, var(--search-bg, #222429));
}

.search-results-wrapper::-webkit-scrollbar {
  width: 6px;
}

.search-results-wrapper::-webkit-scrollbar-track {
  background: var(--scrollbar-track-color, var(--search-bg, #222429));
  border-radius: 3px;
}

.search-results-wrapper::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb-color, var(--toggle-color, #5a5e6b));
  border-radius: 3px;
  border: 1px solid var(--scrollbar-track-color, var(--search-bg, #222429));
}

.search-results-wrapper::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-hover-color, var(--primary-text, #8c909c));
}

.search-results-list {
}

.search-loading,
.search-error-message,
.search-no-results {
  padding: 12px 16px;
  color: var(--text-secondary-color, #aaa);
  text-align: center;
  font-size: 13px;
  background-color: transparent;
}

.search-error-message {
  color: var(--error-color, #ff6b6b);
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  border-radius: 8px;
  background-color: var(--card-bg-search-item, var(--component-bg));
  margin-bottom: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.search-result-item:last-child {
  margin-bottom: 0;
}

.search-result-item:hover {
  background-color: var(--card-hover-bg-search-item, var(--hover-bg));
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.08);
}

.result-avatar {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  overflow: hidden;
  margin-right: 10px;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--placeholder-bg, #555);
  color: var(--text-color, #fff);
  font-weight: bold;
  font-size: 16px;
}

.result-main-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin-right: 8px;
}

.result-line-1-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-name {
  font-weight: 600;
  color: var(--text-color, #fff);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
}

.styled-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 5px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.3;
}

.platform-tag {
  color: #ffffff;
}

.platform-tag.douyu {
  background-color: #ff7f0e;
}

.platform-tag.douyin {
  background-color: #20c997;
}

.live-status-badge {
  color: var(--text-color-on-badge, #fff);
  background-color: var(--status-offline-bg, #94a3b8);
}

.live-status-badge.is-live {
  background-color: var(--status-live-bg, #10b981);
  color: var(--text-color-on-badge-live, #fff);
}

.result-line-2-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
}

.result-room-title {
  font-size: 12px;
  color: var(--secondary-text, #a0a0a0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  margin-right: 8px;
}

.result-roomid {
  color: var(--secondary-text, #a0a0a0);
  background-color: var(--meta-bg, rgba(128,128,128,0.1));
}

.result-meta-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  text-align: right;
  height: 100%;
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: mini-spin 0.75s linear infinite;
  margin: auto;
}

@keyframes mini-spin {
  to { transform: rotate(360deg); }
}
</style>

<style>
:root {
  --header-bg: #ffffff;
  --main-bg: #f5f7fa;
  --component-bg: #ffffff;
  --card-bg: #ffffff;
  --card-hover-bg: #f8fafc;
  --card-border: #e2e8f0;
  
  --border-color: #e2e8f0;
  
  --text-color: #334155;
  --primary-text: #334155;
  --secondary-text: #64748b;
  
  --search-bg: #f1f5f9;
  --search-focus-bg: #e2e8f0;
  
  --toggle-bg: #f1f5f9;
  --toggle-color: #64748b;
  --toggle-hover-bg: #e2e8f0;
  --toggle-hover-color: #334155;
  
  --result-bg: #ffffff;
  --result-hover-bg: #f8fafc;
  --result-border: #e2e8f0;
  
  --status-offline: #94a3b8;
  --status-live: #10b981;
  
  --button-bg: #f1f5f9;
  --button-hover-bg: #e2e8f0;
  --button-text: #64748b;
  --button-hover-text: #334155;
  
  --shadow-color: rgba(51, 65, 85, 0.08);
  --shadow-lg: 0 4px 12px var(--shadow-color);
  
  --hover-transition: all 0.2s ease;
  --active-state: #e2e8f0;
  
  --badge-bg: rgba(33, 150, 243, 0.1);
  --badge-text: #2196F3;
  
  --meta-bg: #e2e8f0;
  --card-bg-search-item: var(--component-bg);
  --card-hover-bg-search-item: var(--hover-bg);
  --status-offline-bg: #94a3b8;
  --status-live-bg: #10b981;
  --text-color-on-badge: #ffffff;
  --text-color-on-badge-live: #ffffff;
  
  --scrollbar-track-color: var(--search-bg, #f1f5f9);
  --scrollbar-thumb-color: var(--toggle-color, #64748b);
  --scrollbar-thumb-hover-color: var(--primary-text, #334155);
}

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
  --component-bg: #1a1b1e;
  --main-bg: #000000;
  --card-bg: rgba(255, 255, 255, 0.03);
  --card-hover-bg: rgba(255, 255, 255, 0.05);
  --card-border: rgba(255, 255, 255, 0.05);
  --primary-text: #ffffff;
  --status-offline: rgba(255, 255, 255, 0.2);
  --button-bg: rgba(255, 255, 255, 0.05);
  --button-hover-bg: rgba(255, 255, 255, 0.1);
  --button-text: rgba(255, 255, 255, 0.8);
  --button-hover-text: #ffffff;
  --shadow-color: rgba(0, 0, 0, 0.3);
  
  --badge-bg: rgba(33, 150, 243, 0.2);
  --badge-text: #64b5f6;
  
  --meta-bg: rgba(255, 255, 255, 0.05);
  --card-bg-search-item: rgba(255, 255, 255, 0.03);
  --card-hover-bg-search-item: rgba(255, 255, 255, 0.07);
  --status-offline-bg: rgba(148, 163, 184, 0.5);
  --status-live-bg: rgba(16, 185, 129, 0.6);
  --text-color-on-badge: #e5e7eb;
  --text-color-on-badge-live: #ffffff;
  
  --scrollbar-track-color: var(--search-bg, #1a1b1e);
  --scrollbar-thumb-color: #555555;
  --scrollbar-thumb-hover-color: #777777;
}
</style>