<template>
  <div class="player-page">
    <button @click="$emit('close-player')" class="player-close-btn" title="关闭播放器">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="player-layout">
      <div class="main-content">
        <div v-if="!roomId" class="empty-player">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <circle cx="12" cy="12" r="10"></circle>
               <line x1="12" y1="16" x2="12" y2="12"></line>
               <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <h3>未选择直播间</h3>
          <p>请从首页选择一个直播间开始观看。</p>
        </div>
        <div v-else class="player-container">
          <StreamerInfo
            :roomId="roomId"
            :isFollowed="isFollowed"
            @follow="$emit('follow', $event)"
            @unfollow="$emit('unfollow', $event)"
            class="streamer-info"
          />
          <div class="video-container">
            <div ref="playerContainer" class="video-player"></div>
          </div>
        </div>
      </div>

      <DanmuList 
        v-if="roomId" 
        :room-id="roomId" 
        v-show="!isFullScreen" 
        class="danmu-panel" 
        :class="{'hidden-panel': isFullScreen}"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, shallowRef, nextTick } from 'vue';
import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import StreamerInfo from '../StreamerInfo/index.vue';
import DanmuList from '../DanmuList/index.vue';
import { fetchStreamPlaybackDetails } from '../../platforms/common/apiService';
import type { StreamPlaybackDetails } from '../../platforms/common/types';

interface DanmakuMessage {
  type?: string;
  uid?: string;
  nickname: string;
  level: string;
  content: string;
  badgeName?: string;
  badgeLevel?: string;
  color?: string;
}

const props = defineProps<{
  roomId: string | null;
  isFollowed?: boolean;
}>();

const emit = defineEmits<{
  (e: 'follow', streamer: any): void;
  (e: 'unfollow', roomId: string): void;
  (e: 'close-player'): void;
  (e: 'fullscreen-change', isFullscreen: boolean): void;
}>();

const playerContainer = ref<HTMLDivElement | null>(null);
const art = shallowRef<Artplayer | null>(null);
let unlistenDanmaku: (() => void) | null = null;
const isFullScreen = ref(false);
const isLoadingStream = ref(false);
const streamFetchAttempts = ref(0);
const MAX_STREAM_FETCH_ATTEMPTS = 3;
const streamError = ref<string | null>(null);

const stopProxy = async () => {
  try {
    console.log('[MainPlayer] Attempting to stop proxy server.');
    await invoke('stop_proxy');
    console.log('[MainPlayer] Proxy server stop command issued.');
  } catch (e) {
    console.error('[MainPlayer] Error stopping proxy server:', e);
  }
};

const destroyPlayer = async () => {
  console.log('[MainPlayer] destroyPlayer called.');
  await stopProxy();
  if (unlistenDanmaku) {
    console.log('[MainPlayer] Cleaning up ArtPlayer danmaku listener during destroyPlayer.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }
  if (art.value) {
    console.log('[MainPlayer] Destroying ArtPlayer instance.');
    art.value.destroy();
    art.value = null;
  }
};

const initPlayer = async () => {
  console.log('[MainPlayer] initPlayer called for roomId:', props.roomId);

  if (art.value) {
    console.log('[MainPlayer] Destroying existing ArtPlayer instance before new init.');
    await destroyPlayer();
  }

  if (!props.roomId) {
    console.warn('[MainPlayer] initPlayer: No roomId provided.');
    return;
  }

  if (!playerContainer.value) {
    console.error('[MainPlayer] initPlayer: playerContainer is null. Cannot init Artplayer.');
    return;
  }

  isLoadingStream.value = true;
  streamError.value = null;
  streamFetchAttempts.value = 0;

  let playbackDetails: StreamPlaybackDetails | null = null;

  for (let attempt = 1; attempt <= MAX_STREAM_FETCH_ATTEMPTS; attempt++) {
    try {
      console.log(`[MainPlayer] Attempt ${attempt} to fetch stream playback details for room:`, props.roomId);
      playbackDetails = await fetchStreamPlaybackDetails(props.roomId!);
      if (playbackDetails && playbackDetails.primaryUrl) {
        console.log('[MainPlayer] Stream playback details received:', playbackDetails);
        streamError.value = null;
        break;
      } else {
        console.warn('[MainPlayer] Received no/empty primary URL in playbackDetails:', playbackDetails);
        streamError.value = '直播流地址获取为空，可能是主播未开播或平台接口问题。';
      }
    } catch (e: any) {
      console.error(`[MainPlayer] Attempt ${attempt} failed to fetch stream playback details:`, e);
      streamError.value = `获取直播流失败 (尝试 ${attempt}/${MAX_STREAM_FETCH_ATTEMPTS}): ${e.message || '未知错误'}`;
      if (attempt === MAX_STREAM_FETCH_ATTEMPTS) {
        isLoadingStream.value = false;
        if (art.value) art.value.notice.show(streamError.value, 0);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  isLoadingStream.value = false;

  if (!playbackDetails || !playbackDetails.primaryUrl) {
    console.error('[MainPlayer] Failed to get valid playback details after retries. Aborting player init.');
    if (art.value && !streamError.value) {
        art.value.notice.show('无法加载直播流，请稍后重试或检查房间号。', 0);
    }
    return;
  }

  try {
    console.log('[MainPlayer] Ensuring any previous proxy is stopped before starting new one.');
    await stopProxy();

    const streamUrl = playbackDetails.primaryUrl;
    console.log('[MainPlayer] Stream URL to be used:', streamUrl);

    let streamType = 'flv';
    if (playbackDetails.format) {
        streamType = playbackDetails.format === 'm3u8' ? 'hls' : playbackDetails.format; 
    } else if (streamUrl.includes('.m3u8')) {
        streamType = 'hls';
    } else if (streamUrl.includes('.mp4')) {
        streamType = 'mp4';
    }
    if (streamType === 'm3u8') streamType = 'hls';

    console.log(`[MainPlayer] Determined stream type: ${streamType}`);

    await invoke('set_stream_url_cmd', { url: streamUrl });
    const proxyUrl = await invoke<string>('start_proxy');
    console.log('[MainPlayer] Proxy URL for ArtPlayer:', proxyUrl);

    console.log('[MainPlayer] Creating new ArtPlayer instance.');
    art.value = new Artplayer({
      container: playerContainer.value,
      url: proxyUrl,
      isLive: true,
      type: streamType,
      pip: true,
      customType: {
        ...(streamType === 'flv' ? {
          flv: function(video: HTMLVideoElement, url: string) {
            import('mpegts.js').then(mpegts => {
              if (!mpegts.isSupported()) {
                console.error('[MainPlayer] mpegts.js is not supported.');
                if(art.value) art.value.notice.show('当前浏览器不支持播放该FLV格式的直播流。');
                return;
              }
              console.log('[MainPlayer] Creating mpegts player for video element:', video);
              
              const player = mpegts.createPlayer({ 
                type: 'flv', 
                url: url,
                isLive: true, 
                hasAudio: true, 
                hasVideo: true, 
                cors: true,
                fixAudioTimestampGap: false,
                autoCleanupSourceBuffer: true,
              }, { 
                enableWorker: true,
                lazyLoad: false, 
                stashInitialSize: 1024,
                liveBufferLatencyChasing: true,
                liveSync: true
              });
              
              player.attachMediaElement(video);
              player.load();
              
              video.play().catch(e => {
                  console.error('[MainPlayer] Auto-play error:', e);
                  if(art.value) art.value.notice.show('自动播放失败，请尝试手动播放。');
              });
              
              console.log('[MainPlayer] mpegts.js player loaded and attached.');
              
              player.on('error', (errorType, errorInfo) => {
                console.error('[mpegts] Error:', errorType, errorInfo);
                if(art.value) art.value.notice.show(`播放器遇到错误: ${errorType}`);
              });
              
              player.on('media_info', (mediaInfo) => {
                console.log('[mpegts] Media info:', mediaInfo);
              });

            }).catch(err => {
              console.error('[MainPlayer] Error loading mpegts.js:', err);
              if(art.value) art.value.notice.show('加载播放器核心组件失败。');
            });
          }
        } : {}),
      },
      plugins: [
        artplayerPluginDanmuku({
          danmuku: [],
          speed: 7,
          opacity: 1,
          fontSize: 20,
          color: '#FFFFFF',
          mode: 0,
          margin: [10, '2%'],
          antiOverlap: true,
          synchronousPlayback: false,
        }),
      ],
      controls: [],
      autoplay: true,
      autoSize: false,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: false,
      playsInline: true,
      autoPlayback: true,
      theme: '#FB7299',
      lang: 'zh-cn',
      moreVideoAttr: { playsInline: true },
    });

    art.value.on('ready', () => console.log('[MainPlayer] ArtPlayer ready.'));
    art.value.on('error', (error) => console.error('[MainPlayer] ArtPlayer error:', error));
    
    art.value.on('fullscreen', (isFullscreen) => {
      console.log('[MainPlayer] Fullscreen changed:', isFullscreen);
      isFullScreen.value = isFullscreen;
      emit('fullscreen-change', isFullscreen);
    });
    
    art.value.on('fullscreenWeb', (isFullscreenWeb) => {
      console.log('[MainPlayer] Web Fullscreen changed:', isFullscreenWeb);
      isFullScreen.value = isFullscreenWeb;
      emit('fullscreen-change', isFullscreenWeb);
    });
    
    await setupDanmakuListener();

  } catch (e) {
    console.error('[MainPlayer] initPlayer failed:', e);
    await stopProxy();
  }
};

const setupDanmakuListener = async () => {
  if (unlistenDanmaku) {
    console.log('[MainPlayer] Cleaning up previous ArtPlayer danmaku listener.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }
  
  if (!props.roomId) {
    console.log('[MainPlayer] setupDanmakuListener: No room ID.');
    return;
  }
  if (!art.value || !art.value.plugins || !art.value.plugins.artplayerPluginDanmuku) {
    console.warn('[MainPlayer] setupDanmakuListener: ArtPlayer or danmaku plugin not available.');
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!art.value || !art.value.plugins || !art.value.plugins.artplayerPluginDanmuku) {
       console.error('[MainPlayer] setupDanmakuListener: ArtPlayer still not ready after delay. Aborting listener setup.');
       return;
    }
  }

  console.log('[MainPlayer] Setting up ArtPlayer danmaku listener for event "danmaku".');
  try {
    unlistenDanmaku = await listen<DanmakuMessage>('danmaku', (event) => {
      if (art.value && art.value.plugins && art.value.plugins.artplayerPluginDanmuku) {
        const danmukuPlugin = art.value.plugins.artplayerPluginDanmuku;
        let danmakuColor = '#FFFFFF';
        if (event.payload.color) {
          const numColor = parseInt(event.payload.color, 10);
          if (!isNaN(numColor) && numColor >= 0 && numColor <= 16777215) {
            danmakuColor = '#' + numColor.toString(16).padStart(6, '0');
          }
        }
        
        danmukuPlugin.emit({
          text: event.payload.content || '',
          color: danmakuColor,
          mode: 0,
        });
      }
    });
    console.log('[MainPlayer] Successfully listening for "danmaku" for ArtPlayer.');
  } catch (error) {
    console.error('[MainPlayer] Error setting up ArtPlayer danmaku listener:', error);
  }
};

onMounted(async () => {
  console.log('[MainPlayer] Mounted. Initial roomId:', props.roomId);
  if (props.roomId) {
    await nextTick();
    await initPlayer();
  }
});

watch(() => props.roomId, async (newRoomId, oldRoomId) => {
  console.log(`[MainPlayer] Watcher: Room ID changed from ${oldRoomId} to ${newRoomId}`);
  if (newRoomId === oldRoomId && art.value) return;

  await destroyPlayer();

  if (newRoomId) {
    await nextTick();
    await initPlayer();
  }
}, { immediate: false });

onUnmounted(async () => {
  console.log('[MainPlayer] Unmounted. Destroying player.');
  await destroyPlayer();
});
</script>

<style scoped>
/* 整体布局 */
.player-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1b1f 0%, #2d2f39 100%);
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

/* 主体布局 */
.player-layout {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 20px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

/* 播放器容器 */
.player-container {
  display: flex;
  flex-direction: column;
  background-color: rgba(35, 37, 46, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  height: 100%;
  gap: 36px;
  padding: 28px 16px 16px 16px;
}

/* 确保全屏时播放器容器也能正确显示 */
:deep(.art-fullscreen) .player-container,
:deep(.art-fullscreen-web) .player-container {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 28px 16px 16px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100vh !important;
  width: 100vw !important;
}

/* 全屏模式下播放器内容的显示 */
:deep(.art-fullscreen) .streamer-info,
:deep(.art-fullscreen-web) .streamer-info {
  display: block !important;
  margin-bottom: 36px !important;
  opacity: 1 !important;
  visibility: visible !important;
  z-index: 10000 !important;
}

/* 全屏模式下视频容器样式 */
:deep(.art-fullscreen) .video-container,
:deep(.art-fullscreen-web) .video-container {
  flex: 1 !important;
  height: auto !important;
  min-height: auto !important;
}

/* 视频播放器 */
.video-container {
  position: relative;
  width: 100%;
  flex-grow: 1;
  border-radius: 12px;
  overflow: hidden;
  background-color: #000;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  min-height: 250px;
}

.video-player {
  width: 100%;
  height: 100%;
}

/* 主播信息 */
.streamer-info {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* 弹幕面板 */
.danmu-panel {
  width: 250px;
  height: 100%;
  background-color: rgba(35, 37, 46, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  transition: transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease;
}

.danmu-panel:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
}

.hidden-panel {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

/* 处理网页全屏模式 - 更强的选择器 (保留作为备份方案) */
:deep(.art-fullscreen) ~ .danmu-panel,
:deep(.art-fullscreen-web) ~ .danmu-panel,
:deep(.art-video-player.art-fullscreen) ~ .danmu-panel,
:deep(.art-video-player.art-fullscreen-web) ~ .danmu-panel,
:deep(.art-fullscreen) + .danmu-panel,
:deep(.art-fullscreen-web) + .danmu-panel,
.player-layout:has(:deep(.art-fullscreen)) .danmu-panel,
.player-layout:has(:deep(.art-fullscreen-web)) .danmu-panel {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

/* 播放器全屏模式下 */
:deep(.art-video-player.art-fullscreen),
:deep(.art-video-player.art-fullscreen-web),
:deep(.art-fullscreen),
:deep(.art-fullscreen-web) {
  width: 100vw !important;
  height: 100vh !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 9999 !important;
  background-color: #000 !important;
}

/* 全屏模式下的播放器容器样式优化 */
:deep(.art-video-player.art-fullscreen) .art-video,
:deep(.art-video-player.art-fullscreen-web) .art-video {
  width: 100% !important;
  height: 100% !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  object-fit: contain !important;
}

/* 关闭按钮 */
.player-close-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.player-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.player-close-btn:active {
  transform: scale(0.95);
}

.player-close-btn svg {
  width: 16px;
  height: 16px;
}

/* 空播放器状态 */
.empty-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  background-color: rgba(35, 37, 46, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  padding: 40px;
  color: #bec0c7;
}

.empty-player .empty-icon {
  margin-bottom: 20px;
  color: #666;
  opacity: 0.7;
}

.empty-player h3 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
  color: #e0e0e0;
}

.empty-player p {
  margin: 0;
  font-size: 16px;
  opacity: 0.8;
}

/* 视频元素样式 */
:deep(.art-video-player) {
  border-radius: 10px;
  background: #000;
}

:deep(.art-video-player .art_video),
:deep(.video-player .art_video),
:deep(video.art_video) {
  object-fit: contain;
  width: 100%;
  height: 100%;
  opacity: 1;
  visibility: visible;
  display: block;
  position: relative;
  z-index: 10;
}

/* 响应式样式 */
@media (max-width: 1024px) {
  .player-layout {
    flex-direction: column;
    gap: 16px;
  }

  .danmu-panel {
    width: 100%;
    height: 250px;
  }
}

@media (max-width: 768px) {
  .player-page {
    padding: 15px;
  }

  .player-close-btn {
    top: 20px;
    left: 20px;
    width: 36px;
    height: 36px;
  }

  .player-container {
    padding: 12px;
    gap: 12px;
  }

  .video-container {
    min-height: 220px;
    border-radius: 10px;
  }

  .danmu-panel {
    height: 200px;
    border-radius: 12px;
  }
}
</style>