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
            v-if="props.roomId"
            :room-id="props.roomId"
            :platform="props.platform"
            :title="props.title"
            :anchor-name="props.anchorName"
            :avatar="props.avatar"
            :is-followed="props.isFollowed"
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
import { Platform } from '../../platforms/common/types';
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
  platform: Platform;
  isFollowed?: boolean;
  streamUrl?: string | null;
  title?: string | null;
  anchorName?: string | null;
  avatar?: string | null;
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
  console.log(`[MainPlayer] initPlayer called for platform: ${props.platform}, roomId: ${props.roomId}`);

  if (art.value) {
    console.log('[MainPlayer] Destroying existing ArtPlayer instance before new init.');
    await destroyPlayer();
  }

  if (!props.roomId) {
    console.warn('[MainPlayer] initPlayer: No roomId provided.');
    streamError.value = '未提供房间ID。';
    isLoadingStream.value = false;
    return;
  }

  if (!playerContainer.value) {
    console.error('[MainPlayer] initPlayer: playerContainer is null. Cannot init Artplayer.');
    streamError.value = '播放器容器不存在。';
    isLoadingStream.value = false;
    return;
  }

  isLoadingStream.value = true;
  streamError.value = null;
  streamFetchAttempts.value = 0;

  const artPlayerOptionsBase = {
      isLive: true,
      pip: true,
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
  };

  if (props.platform === Platform.DOUYIN) {
    if (props.streamUrl) {
      console.log('[MainPlayer] Initializing for Douyin with direct stream URL:', props.streamUrl);
      let streamType = determineStreamType(props.streamUrl);
      
      try {
        const playerUrl = props.streamUrl;
        console.log('[MainPlayer] Douyin player URL (direct):', playerUrl);

        art.value = new Artplayer({
          ...artPlayerOptionsBase,
          container: playerContainer.value!,
          url: playerUrl, 
          type: streamType,
          customType: {
            ...(streamType === 'flv' ? {
              flv: function(video: HTMLVideoElement, url: string, art: Artplayer) {
                import('mpegts.js').then(mpegts => {
                  if (mpegts.default.isSupported()) {
                    const player = mpegts.default.createPlayer({ type: 'flv', url: url, isLive: true, hasAudio: true, hasVideo: true, cors: true, fixAudioTimestampGap: false, autoCleanupSourceBuffer: true }, 
                                                      { enableWorker: true, lazyLoad: false, stashInitialSize: 1024, liveBufferLatencyChasing: true, liveSync: true });
                    player.attachMediaElement(video);
                    player.load();
                    video.play().catch(e => console.error('[MainPlayer] Douyin FLV Auto-play error:', e));
                    player.on('error', (errorType, errorInfo) => {
                      console.error('[mpegts Douyin] Error:', errorType, errorInfo);
                      // if(art && art.notice) art.notice.show('抖音FLV播放错误');
                    });
                  } else {
                     console.error('[MainPlayer] mpegts.js is not supported for Douyin.');
                     // if(art && art.notice) art.notice.show('浏览器不支持抖音FLV');
                  }
                }).catch(err => {
                  console.error('[MainPlayer] Error loading mpegts.js for Douyin:', err);
                  // if(art && art.notice) art.notice.show('加载FLV组件失败');
                });
              }
            } : {}),
          },
        });
        art.value.on('play', () => console.log('[MainPlayer Douyin] Play event'));
        art.value.on('error', (err: any) => {
            console.error('[MainPlayer Douyin] ArtPlayer error:', err);
            // if(art.value && art.value.notice) art.value.notice.show(err.message || '抖音播放核心错误');
            streamError.value = `播放失败: ${err.message}`;
        });
      } catch (e: any) {
        console.error('[MainPlayer] Error setting up Douyin player (direct or proxied):', e);
        streamError.value = `设置抖音播放失败: ${e.message || '未知错误'}`;
        // if (art.value && art.value.notice && streamError.value) art.value.notice.show(streamError.value ?? '设置抖音播放失败');
      }
    } else {
      streamError.value = '抖音直播流地址未在props中提供。';
      console.error(streamError.value); 
    }
    isLoadingStream.value = false;

  } else if (props.platform === Platform.DOUYU) {
    console.log('[MainPlayer] Initializing for Douyu, fetching details for roomId:', props.roomId);
    let playbackDetails: StreamPlaybackDetails | null = null;
    for (let attempt = 1; attempt <= MAX_STREAM_FETCH_ATTEMPTS; attempt++) {
      try {
        console.log(`[MainPlayer] Attempt ${attempt} to fetch Douyu stream playback details for room:`, props.roomId);
        playbackDetails = await fetchStreamPlaybackDetails(props.roomId!, Platform.DOUYU);
        if (playbackDetails && playbackDetails.primaryUrl) {
          console.log('[MainPlayer] Douyu stream playback details received:', playbackDetails);
          streamError.value = null;
          break;
        } else {
          console.warn('[MainPlayer] Douyu: Received no/empty primary URL in playbackDetails:', playbackDetails);
          streamError.value = '斗鱼直播流地址获取为空。';
        }
      } catch (e: any) {
        console.error(`[MainPlayer] Douyu: Attempt ${attempt} failed to fetch stream playback details:`, e);
        streamError.value = `获取斗鱼直播流失败 (尝试 ${attempt}/${MAX_STREAM_FETCH_ATTEMPTS}): ${e.message || '未知错误'}`;
        if (attempt === MAX_STREAM_FETCH_ATTEMPTS) {
          isLoadingStream.value = false;
          // if (art.value && art.value.notice && streamError.value) art.value.notice.show(streamError.value ?? '获取斗鱼流失败', 0);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    if (!playbackDetails || !playbackDetails.primaryUrl) {
      console.error('[MainPlayer] Douyu: Failed to get valid playback details. Aborting player init.');
      // if (art.value && art.value.notice && !streamError.value) art.value.notice.show('无法加载斗鱼直播流', 0);
      // else if (art.value && art.value.notice && streamError.value) art.value.notice.show(streamError.value ?? '无法加载斗鱼直播流', 0);
      isLoadingStream.value = false;
      return;
    }

    try {
      await stopProxy(); 
      const streamUrl = playbackDetails.primaryUrl;
      let streamType = determineStreamType(streamUrl);
      if (playbackDetails.format) {
          streamType = playbackDetails.format === 'm3u8' ? 'hls' : playbackDetails.format as 'flv' | 'hls' | 'mp4'; 
      }

      await invoke('set_stream_url_cmd', { url: streamUrl });
      const proxyUrl = await invoke<string>('start_proxy');
      console.log('[MainPlayer] Douyu Proxy URL for ArtPlayer:', proxyUrl);

      art.value = new Artplayer({
        ...artPlayerOptionsBase,
        container: playerContainer.value!,
        url: proxyUrl,
        type: streamType,
        customType: {
          ...(streamType === 'flv' ? {
            flv: function(video: HTMLVideoElement, url: string, art: Artplayer) {
              import('mpegts.js').then(mpegts => {
                 if (mpegts.default.isSupported()) {
                    const player = mpegts.default.createPlayer({ type: 'flv', url: url, isLive: true, hasAudio: true, hasVideo: true, cors: true, fixAudioTimestampGap: false, autoCleanupSourceBuffer: true }, 
                                                      { enableWorker: true, lazyLoad: false, stashInitialSize: 1024, liveBufferLatencyChasing: true, liveSync: true });
                    player.attachMediaElement(video);
                    player.load();
                    video.play().catch(e => console.error('[MainPlayer] Douyu FLV Auto-play error:', e));
                    player.on('error', (errorType, errorInfo) => {
                      console.error('[mpegts Douyu] Error:', errorType, errorInfo);
                      // if(art && art.notice) art.notice.show('斗鱼FLV播放错误');
                    });
                  } else {
                     console.error('[MainPlayer] mpegts.js is not supported for Douyu.');
                     // if(art && art.notice) art.notice.show('浏览器不支持斗鱼FLV');
                  }
              }).catch(err => {
                  console.error('[MainPlayer] Error loading mpegts.js for Douyu:', err);
                  // if(art && art.notice) art.notice.show('加载FLV组件失败');
              });
            }
          } : {}),
        },
      });
      art.value.on('play', () => console.log('[MainPlayer Douyu] Play event'));
      art.value.on('error', (err: any) => {
        console.error('[MainPlayer Douyu] ArtPlayer error:', err);
        // if(art.value && art.value.notice) art.value.notice.show(err.message || '斗鱼播放核心错误');
        streamError.value = `播放失败: ${err.message}`;
      });

    } catch (e:any) {
      console.error('[MainPlayer] Error setting up Douyu player:', e);
      streamError.value = `设置斗鱼播放器失败: ${e.message || '未知错误'}`;
      // if (art.value && art.value.notice && streamError.value) art.value.notice.show(streamError.value ?? '设置斗鱼播放失败');
    }
    isLoadingStream.value = false;

  } else {
    console.error('[MainPlayer] Unknown platform provided:', props.platform);
    streamError.value = `不支持的平台: ${props.platform}`;
    isLoadingStream.value = false;
  }
  
  setupDanmakuListener();

  if (art.value) {
    // Common ArtPlayer event listeners for fullscreen
    art.value.on('fullscreen', (status: boolean) => {
      isFullScreen.value = status;
      emit('fullscreen-change', status);
      console.log(`[MainPlayer] Fullscreen status: ${status}`);
    });
    art.value.on('fullscreenWeb', (status: boolean) => {
      isFullScreen.value = status;
      emit('fullscreen-change', status);
      console.log(`[MainPlayer] Web Fullscreen status: ${status}`);
    });

    if (!art.value.plugins.artplayerPluginDanmuku) {
        console.warn("[MainPlayer] Danmaku plugin not initialized on artplayer instance. Re-checking plugins array.");
    }
  }
};

const setupDanmakuListener = async () => {
  if (unlistenDanmaku) {
    console.log('[MainPlayer] Clearing previous danmaku listener.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }

  if (!props.roomId || !art.value || !art.value.plugins.artplayerPluginDanmuku) {
    console.log('[MainPlayer] Conditions not met for danmaku listener setup (no roomId, art, or danmaku plugin).', { hasRoomId: !!props.roomId, hasArt: !!art.value, hasPlugin: !!(art.value && art.value.plugins.artplayerPluginDanmuku) });
    return;
  }

  if (props.platform === Platform.DOUYU) {
    console.log('[MainPlayer] Setting up Douyu danmaku listener for roomId:', props.roomId);
    try {
      await invoke('start_danmaku_listener', { roomId: props.roomId });
      unlistenDanmaku = await listen<DanmakuMessage>(`danmaku-${props.roomId}`, event => {
        if (art.value && art.value.plugins.artplayerPluginDanmuku && event.payload) {
          const danmaku = event.payload;
          art.value.plugins.artplayerPluginDanmuku.emit({
            text: danmaku.content,
            color: danmaku.color || '#fff',
            border: !!danmaku.color, 
          });
        }
      });
      console.log('[MainPlayer] Douyu danmaku listener started.');
    } catch (e) {
      console.error('[MainPlayer] Error starting Douyu danmaku listener:', e);
    }
  } else if (props.platform === Platform.DOUYIN) {
    console.log('[MainPlayer] Douyin danmaku listener setup placeholder for roomId:', props.roomId);
  } else {
    console.log('[MainPlayer] Danmaku listener not applicable for platform:', props.platform);
  }
};

watch(() => [props.roomId, props.platform], ([newRoomId, newPlatform], [oldRoomId, oldPlatform]) => {
  if ((newRoomId && newRoomId !== oldRoomId) || (newPlatform && newPlatform !== oldPlatform) || (newRoomId && !art.value)) {
    console.log(`[MainPlayer] roomId or platform prop changed. Old: ${oldPlatform}/${oldRoomId}, New: ${newPlatform}/${newRoomId}. Re-initializing player.`);
    initPlayer();
  } else if (!newRoomId && art.value) {
    console.log('[MainPlayer] roomId prop became null. Destroying player.');
    destroyPlayer();
  }
});

watch(() => props.streamUrl, (newUrl, oldUrl) => {
  if (props.platform === Platform.DOUYIN && newUrl && newUrl !== oldUrl && art.value) {
    console.log(`[MainPlayer] Douyin streamUrl prop changed to ${newUrl}. Re-initializing player.`);
    initPlayer(); 
  }
});

onMounted(async () => {
  console.log('[MainPlayer] Component mounted. Initializing player...');
  await nextTick();
  if (props.roomId) {
    initPlayer();
  } else {
    console.log('[MainPlayer] No roomId on mount, player not initialized.');
    isLoadingStream.value = false;
  }
});

onUnmounted(async () => {
  console.log('[MainPlayer] Component unmounted. Destroying player and listeners.');
  await destroyPlayer();
});

function determineStreamType(url: string): 'flv' | 'hls' | 'mp4' | 'm3u8' {
    if (!url) return 'flv';
    if (url.includes('.flv')) return 'flv';
    if (url.includes('.m3u8')) return 'm3u8';
    if (url.includes('.mp4')) return 'mp4';
    console.warn('[MainPlayer] Could not determine stream type from URL, defaulting to flv for URL:', url);
    return 'flv'; 
}
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