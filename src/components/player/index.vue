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
        <div v-else-if="isLoadingStream" class="loading-player">
          <div class="spinner"></div>
          <p>加载直播流中...</p>
        </div>
        <div v-else-if="streamError" class="error-player">
          <div class="error-icon">
             <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3>加载失败</h3>
          <p>{{ streamError }}</p>
          <button @click="retryInitialization" class="retry-btn">重试</button>
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
            :is-live="props.isLive"
            @follow="$emit('follow', $event)"
            @unfollow="$emit('unfollow', $event)"
            class="streamer-info"
            v-show="!isInWebFullscreen"
            :class="{'hidden-panel': isInWebFullscreen}"
          />
          <div class="video-container">
            <div ref="playerContainerRef" class="video-player"></div>
          </div>
        </div>
      </div>

      <DanmuList 
        v-if="roomId && !isLoadingStream && !streamError" 
        :room-id="props.roomId"
        :messages="danmakuMessages"
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
import Hls from 'hls.js';
// Platform and common types
import { Platform } from '../../platforms/common/types';
import type { DanmakuMessage } from './types'; // Moved to a shared types file

// Platform-specific player helpers
import { getDouyuStreamConfig, startDouyuDanmakuListener, stopDouyuDanmaku, stopDouyuProxy } from '../../platforms/douyu/playerHelper';
import { getDouyinStreamConfig, startDouyinDanmakuListener, stopDouyinDanmaku } from '../../platforms/douyin/playerHelper';

import StreamerInfo from '../StreamerInfo/index.vue';
import DanmuList from '../DanmuList/index.vue';

const props = defineProps<{
  roomId: string | null;
  platform: Platform;
  isFollowed?: boolean;
  streamUrl?: string | null; // Primarily for Douyin direct URL
  title?: string | null;
  anchorName?: string | null;
  avatar?: string | null;
  isLive?: boolean | null;
}>();

const emit = defineEmits<{
  (e: 'follow', streamer: any): void;
  (e: 'unfollow', roomId: string): void;
  (e: 'close-player'): void;
  (e: 'fullscreen-change', isFullscreen: boolean): void;
}>();

const playerContainerRef = ref<HTMLDivElement | null>(null);
const art = shallowRef<Artplayer | null>(null);
const danmakuMessages = ref<DanmakuMessage[]>([]);
const isDanmakuListenerActive = ref(false); // Tracks if a danmaku listener is supposed to be running
let unlistenDanmakuFn: (() => void) | null = null;

const isLoadingStream = ref(true);
const streamError = ref<string | null>(null);

const isInNativeFullscreen = ref(false);
const isInWebFullscreen = ref(false);
const isFullScreen = ref(false); // True if either native or web fullscreen is active

async function initializePlayerAndStream(pRoomId: string, pPlatform: Platform, pStreamUrlProp?: string | null) {
  console.log(`[Player] Initialize: Room=${pRoomId}, Platform=${pPlatform}, StreamURLProp=${pStreamUrlProp}`);
  isLoadingStream.value = true;
  streamError.value = null;
  danmakuMessages.value = [];

  if (art.value) {
    console.log('[Player] Destroying existing ArtPlayer instance.');
    await stopCurrentDanmakuListener(props.platform, props.roomId); 
    if (art.value.playing) art.value.pause();
    art.value.destroy(false);
    art.value = null;
  }

  try {
    let streamConfig: { streamUrl: string, streamType: string | undefined };

    if (pPlatform === Platform.DOUYU) {
      streamConfig = await getDouyuStreamConfig(pRoomId);
    } else if (pPlatform === Platform.DOUYIN) {
      streamConfig = getDouyinStreamConfig(pStreamUrlProp);
    } else {
      throw new Error(`不支持的平台: ${pPlatform}`);
    }
    
    isLoadingStream.value = false;
    await nextTick();

    if (!playerContainerRef.value) {
      console.error('[Player] playerContainerRef is null AFTER nextTick. Cannot init Artplayer. This is unexpected.');
      streamError.value = '播放器容器初始化失败。';
      return;
    }

    const artPlayerOptions = {
        container: playerContainerRef.value, 
        url: streamConfig.streamUrl,
        type: streamConfig.streamType,
        isLive: true, pip: true, autoplay: true, autoSize: true, aspectRatio: true,
        fullscreen: true, fullscreenWeb: true, miniProgressBar: true, mutex: true,
        backdrop: false, playsInline: true, autoPlayback: true, theme: '#FB7299', lang: 'zh-cn',
        moreVideoAttr: { playsInline: true },
        plugins: [
            artplayerPluginDanmuku({
            danmuku: [], speed: 7, opacity: 1, fontSize: 20, color: '#FFFFFF',
            mode: 0, margin: [10, '2%'], antiOverlap: true, synchronousPlayback: false,
            }),
        ],
        controls: [],
        customType: {
            ...(streamConfig.streamType === 'flv' ? {
            flv: function(video: HTMLVideoElement, url: string) {
                // Capture pPlatform for logging within this function's scope
                const platformForLog = pPlatform; 
                import('mpegts.js').then(mpegts => {
                if (mpegts.default.isSupported()) {
                    console.log(`[Player ${platformForLog}] mpegts.js is supported. Initializing FLV player for URL:`, url);
                    const flvPlayer = mpegts.default.createPlayer(
                    { type: 'flv', url: url, isLive: true, cors: true, hasAudio: true, hasVideo: true }, 
                    {}
                    );
                    flvPlayer.attachMediaElement(video);
                    flvPlayer.load();
                    video.play().catch(e => console.error(`[Player ${platformForLog}] FLV Auto-play error:`, e));
                    flvPlayer.on('error', (errType, errInfo) => {
                    console.error(`[mpegts ${platformForLog}] Error:`, errType, errInfo);
                    streamError.value = `FLV组件错误: ${errInfo.msg}`;
                    });
                } else {
                    console.error(`[Player ${platformForLog}] Browser does not support FLV playback (mpegts.js).`);
                    streamError.value = '浏览器不支持FLV播放。';
                }
                }).catch((e) => { 
                    console.error(`[Player ${platformForLog}] Failed to load mpegts.js component:`, e);
                    streamError.value = '加载FLV播放组件失败。'; 
                });
            }
            } : {}),
            ...(streamConfig.streamType === 'hls' ? {
              hls: function (video: HTMLVideoElement, url: string) {
                // Capture pPlatform for logging within this function's scope
                const platformForLog = pPlatform; 
                console.log(`[Player ${platformForLog}] Custom HLS type handler called for URL:`, url);
                if (Hls.isSupported()) {
                  console.log(`[Player ${platformForLog}] hls.js is supported.`);
                  const hlsConfig = {
                    debug: true, // Enable hls.js debug logging
                    // --- Optimizations for faster start-up ---
                    startFragPrefetch: true, // Try to prefetch segments aggressively
                    maxBufferLength: 15,     // Reduce target buffer length (default 30s)
                    // maxMaxBufferLength: 30, // Corresponds to maxBufferLength
                    // Consider liveSyncDurationCount or liveMaxLatencyDurationCount for live streams if issues arise
                    // --- End Optimizations ---
                    // Other hls.js specific configurations can be added here if needed
                    // e.g., xhrSetup: function(xhr, url) { xhr.withCredentials = true; } for CORS issues
                  };
                  console.log(`[Player ${platformForLog}] hls.js config:`, hlsConfig);
                  const hls = new Hls(hlsConfig);
                  console.log(`[Player ${platformForLog}] hls.js instance created. Loading source:`, url);
                  hls.loadSource(url);
                  console.log(`[Player ${platformForLog}] Attaching media element.`);
                  hls.attachMedia(video);
                  
                  hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
                    console.log(`[hls.js ${platformForLog}] Manifest parsed successfully. Levels:`, data.levels);
                    video.play().catch(e => console.error(`[Player ${platformForLog}] HLS Auto-play error after manifest parsed:`, e));
                  });

                  hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
                    console.log(`[hls.js ${platformForLog}] Level ${data.level} loaded. Details:`, data.details);
                  });

                  hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                      console.error(`[hls.js ${platformForLog}] Fatal error: `, data);
                      streamError.value = `HLS错误: ${data.details} (type: ${data.type})`;
                    } else {
                      console.warn(`[hls.js ${platformForLog}] Non-fatal error: `, data);
                    }
                  });
                  
                  // It's often better to initiate play after MANIFEST_PARSED or a similar event.
                  // However, Artplayer might handle this, or immediate play might be intended.
                  // video.play().catch(e => console.error(`[Player ${platformForLog}] HLS Auto-play error:`, e));
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  console.log(`[Player ${platformForLog}] Native HLS playback supported (e.g., Safari). Setting src to:`, url);
                  video.src = url;
                  video.addEventListener('loadedmetadata', function() {
                    console.log(`[Player ${platformForLog}] Native HLS metadata loaded. Attempting to play.`);
                    video.play().catch(e => console.error(`[Player ${platformForLog}] Native HLS Auto-play error:`, e));
                  });
                  video.addEventListener('error', function(e) {
                     console.error(`[Player ${platformForLog}] Native HLS video element error:`, e);
                     streamError.value = '浏览器原生HLS播放失败。';
                  });
                } else {
                  console.error(`[Player ${platformForLog}] Browser does not support HLS playback (hls.js or native).`);
                  streamError.value = '浏览器不支持HLS播放。';
                }
              }
            } : {}),
        },
    };
    console.log(`[Player] Creating Artplayer with options:`, artPlayerOptions);
    art.value = new Artplayer(artPlayerOptions);

    art.value.on('ready', async () => {
      console.log('[Player] Artplayer instance ready.');
      if (pRoomId && pPlatform && art.value) { 
        console.log(`[Player] Artplayer ready, starting danmaku for ${pPlatform}/${pRoomId}.`);
        await startCurrentDanmakuListener(pPlatform, pRoomId);
      }
    });
    art.value.on('error', (err: any) => { 
        console.error('[Player] Artplayer error:', err);
        streamError.value = `播放器错误: ${err.message || err}`; 
    });
    art.value.on('fullscreen', (nativeActive: boolean) => {
      // console.log(`[Player] Native fullscreen event: ${nativeActive}`); // Optional
      isInNativeFullscreen.value = nativeActive;

      if (nativeActive && isInWebFullscreen.value) {
        // If entering native fullscreen while web fullscreen is active, turn off web fullscreen.
        // Artplayer might do this automatically, but good to be explicit.
        if (art.value) art.value.fullscreenWeb = false;
        isInWebFullscreen.value = false;
      }
      // When exiting native fullscreen (!nativeActive), Artplayer 5.2.2 should correctly handle its state.
      // We just reflect its state. If it also exits web fullscreen, its own fullscreenWeb event should fire.
      
      isFullScreen.value = isInNativeFullscreen.value || isInWebFullscreen.value;
      emit('fullscreen-change', isFullScreen.value);
      // console.log(`[Player] Native fullscreen handler: Emitted fullscreen-change: ${isFullScreen.value}`); // Optional
    });

    art.value.on('fullscreenWeb', (webActive: boolean) => {
      // console.log(`[Player] Web fullscreen event: ${webActive}`); // Optional
      isInWebFullscreen.value = webActive;

      if (webActive && isInNativeFullscreen.value) {
        // If entering web fullscreen while native fullscreen is active, turn off native fullscreen.
        // This is mainly for our state consistency, as user would need to exit native FS first via ESC.
        isInNativeFullscreen.value = false;
      }
      
      isFullScreen.value = isInNativeFullscreen.value || isInWebFullscreen.value;
      emit('fullscreen-change', isFullScreen.value);
      // console.log(`[Player] Web fullscreen handler: Emitted fullscreen-change: ${isFullScreen.value}`); // Optional
    });

  } catch (e: any) {
    console.error(`[Player] Error initializing player or stream for ${pPlatform}/${pRoomId}:`, e);
    streamError.value = e.message || '初始化播放器或获取直播流失败。';
    isLoadingStream.value = false;
  }
}

async function startCurrentDanmakuListener(platformToStart: Platform, roomIdToStart: string) {
  if (!art.value || !art.value.plugins.artplayerPluginDanmuku) {
      console.warn('[Player] StartDanmaku: Artplayer or Danmaku plugin not ready.');
      return;
  }
  if (isDanmakuListenerActive.value) {
      console.log('[Player] StartDanmaku: Listener already active.');
      return;
  }
  console.log(`[Player] Starting danmaku for: ${platformToStart}/${roomIdToStart}`);
  try {
    if (unlistenDanmakuFn) {
        console.log('[Player] Cleaning up residual unlistenDanmakuFn before starting new one.');
        unlistenDanmakuFn();
        unlistenDanmakuFn = null;
    }
    danmakuMessages.value = [];

    if (platformToStart === Platform.DOUYU) {
      unlistenDanmakuFn = await startDouyuDanmakuListener(roomIdToStart, art.value, danmakuMessages);
    } else if (platformToStart === Platform.DOUYIN) {
      unlistenDanmakuFn = await startDouyinDanmakuListener(roomIdToStart, art.value, danmakuMessages);
    } else {
      console.warn(`[Player] Danmaku not supported for platform: ${platformToStart}`);
      return;
    }
    isDanmakuListenerActive.value = true;
    console.log(`[Player] Danmaku listener started successfully for ${platformToStart}/${roomIdToStart}.`);
  } catch (e: any) {
    console.error(`[Player] Error starting danmaku for ${platformToStart}/${roomIdToStart}:`, e);
    danmakuMessages.value.push({ nickname: '系统消息', content: `弹幕连接失败: ${e.message}`, level: '0', color: '#FF6347' });
    isDanmakuListenerActive.value = false;
  }
}

async function stopCurrentDanmakuListener(platformToStop: Platform, roomIdToStop: string | null) {
  if (!isDanmakuListenerActive.value && !unlistenDanmakuFn) {
    console.log('[Player] StopDanmaku: No active listener or unlisten function to stop.');
    return;
  }
  console.log(`[Player] Attempting to stop danmaku for: ${platformToStop}/${roomIdToStop}`);
  
  const currentUnlisten = unlistenDanmakuFn;
  unlistenDanmakuFn = null;
  isDanmakuListenerActive.value = false;

  try {
    if (platformToStop === Platform.DOUYU && roomIdToStop) {
      await stopDouyuDanmaku(roomIdToStop, currentUnlisten);
    } else if (platformToStop === Platform.DOUYIN) {
      await stopDouyinDanmaku(currentUnlisten);
    } else {
      console.warn(`[Player] No specific danmaku stop logic for platform: ${platformToStop} or room ID missing/invalid (${roomIdToStop}).`);
      if (currentUnlisten) {
          console.log('[Player] Calling generic unlisten function as a fallback.');
          currentUnlisten();
      }
    }
    console.log(`[Player] Danmaku stop process potentially completed for ${platformToStop}/${roomIdToStop}.`);
  } catch (e: any) {
    console.error(`[Player] Error stopping danmaku for ${platformToStop}/${roomIdToStop}:`, e);
  }
}

const retryInitialization = () => {
  if (props.roomId && props.platform) {
    console.log('[Player] Retrying initialization...');
    initializePlayerAndStream(props.roomId, props.platform, props.streamUrl);
  }
};

watch(() => [props.roomId, props.platform, props.streamUrl], async ([newRoomId, newPlatform, newStreamUrl], [oldRoomId, oldPlatformValue, oldStreamUrl]) => {
  console.log(`[Player] Watch: New=${newRoomId}(${newPlatform}), URL=${newStreamUrl}. Old=${oldRoomId}(${oldPlatformValue})`);
  
  const oldPlatform = oldPlatformValue as Platform;

  if (newRoomId && newPlatform) {
    if (newRoomId !== oldRoomId || newPlatform !== oldPlatform || (newPlatform === Platform.DOUYIN && newStreamUrl !== oldStreamUrl && newStreamUrl)) {
      console.log('[Player] Critical props changed. Stopping old resources and re-initializing.');
      if (oldRoomId && oldPlatform) { 
        await stopCurrentDanmakuListener(oldPlatform, oldRoomId);
        if (oldPlatform === Platform.DOUYU) {
          console.log('[Player] Watcher: old platform was Douyu, stopping proxy.');
          await stopDouyuProxy();
        }
      }
      await initializePlayerAndStream(newRoomId, newPlatform as Platform, newStreamUrl); 
    }
  } else if (!newRoomId && art.value) { 
    console.log('[Player] No newRoomId, stopping and clearing player.');
    if (oldRoomId && oldPlatform) { 
        await stopCurrentDanmakuListener(oldPlatform, oldRoomId);
        if (oldPlatform === Platform.DOUYU) {
            console.log('[Player] Watcher clearing player: old platform was Douyu, stopping proxy.');
            await stopDouyuProxy(); 
        }
    } else {
        console.log('[Player] No oldRoomId/oldPlatform to stop danmaku/proxy for.');
    }
    if (art.value.playing) art.value.pause();
    art.value.destroy(false);
    art.value = null;
    isLoadingStream.value = false;
    danmakuMessages.value = [];
    streamError.value = null;
  }
}, { immediate: false });

onMounted(async () => {
  console.log(`[Player] Mounted. RoomID: ${props.roomId}, Platform: ${props.platform}, URL: ${props.streamUrl}`);
  if (props.roomId && props.platform) {
    await initializePlayerAndStream(props.roomId, props.platform, props.streamUrl);
  } else {
    console.log('[Player] Mounted without RoomID/Platform. Player will be empty.');
    isLoadingStream.value = false;
  }
});

onUnmounted(async () => {
  console.log('[Player] Component unmounted. Cleaning up...');
  const platformToStop: Platform = props.platform;
  const roomIdToStop: string | null = props.roomId;
  await stopCurrentDanmakuListener(platformToStop, roomIdToStop);

  if (props.platform === Platform.DOUYU) {
      console.log('[Player] Unmounting: Ensuring Douyu proxy is stopped if it was the active platform.');
      await stopDouyuProxy();
  }

  if (art.value) {
    console.log('[Player] Unmounting: Destroying ArtPlayer instance.');
    if (art.value.playing) art.value.pause();
    art.value.destroy(true);
    art.value = null;
  }
  danmakuMessages.value = []; 
  console.log('[Player] Cleanup on unmount finished.');
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
.empty-player, .loading-player, .error-player {
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

.empty-player .empty-icon, .loading-player .spinner, .error-player .error-icon {
  margin-bottom: 20px;
  color: #666;
  opacity: 0.7;
}

.loading-player .spinner {
  width: 48px;
  height: 48px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #FB7299;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-player h3, .loading-player h3, .error-player h3 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
  color: #e0e0e0;
}

.empty-player p, .loading-player p, .error-player p {
  margin: 0;
  font-size: 16px;
  opacity: 0.8;
}

.error-player .retry-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #FB7299;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s ease;
}
.error-player .retry-btn:hover {
  background-color: #e06387;
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