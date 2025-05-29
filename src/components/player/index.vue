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
        :messages="danmakuMessages"
        v-show="!isFullScreen" 
        class="danmu-panel" 
        :class="{'hidden-panel': isFullScreen}"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, shallowRef, nextTick, computed } from 'vue';
import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import { invoke } from '@tauri-apps/api/core';
import { listen, type Event as TauriEvent } from '@tauri-apps/api/event';
import StreamerInfo from '../StreamerInfo/index.vue';
import DanmuList from '../DanmuList/index.vue';
import { fetchStreamPlaybackDetails } from '../../platforms/common/apiService';
import { Platform } from '../../platforms/common/types';
import type { StreamPlaybackDetails } from '../../platforms/common/types';

// Interface for the payload structure coming DIRECTLY from Rust via the event
interface RustDanmakuPayload {
  room_id?: string; 
  user: string;      // This is the nickname from Rust's DanmakuFrontendPayload
  content: string;
  user_level: number; // from Rust's i64
  fans_club_level: number; // from Rust's i32
  // color is not typically sent from this backend payload struct for danmaku content
}

// This interface represents the Rust struct: crate::platforms::common::GetStreamUrlPayload
// It is used as the type for the value of the 'payload' key when invoking 'start_douyin_danmu_listener'
interface RustGetStreamUrlPayload {
  args: {
    room_id_str: string;
  };
  platform: Platform; // Platform enum from common/types
}

interface DanmakuMessage { // This is the structure used in danmakuMessages array and for DanmuList
  type?: string;
  uid?: string;
  nickname: string;
  level: string;       // String for display
  content: string;
  badgeName?: string;   // Douyin doesn't have this
  badgeLevel?: string;  // String for display, from fans_club_level
  color?: string;       // For UI customization
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
const danmakuMessages = ref<DanmakuMessage[]>([]);
const isLoadingDanmaku = ref(false);
const isDanmakuStopped = ref(false);
let unlistenDanmaku: (() => void) | null = null;
const isFullScreen = ref(false);
const isLoadingStream = ref(true);
const streamFetchAttempts = ref(0);
const MAX_STREAM_FETCH_ATTEMPTS = 3;
const streamError = ref<string | null>(null);

function determineStreamType(url: string): 'flv' | 'hls' | 'mp4' | 'm3u8' | undefined {
  if (!url) return undefined;
  if (url.includes('.flv')) return 'flv';
  if (url.includes('.m3u8')) return 'hls';
  if (url.includes('.mp4')) return 'mp4';
  console.warn('[Player] Could not determine stream type from URL:', url);
  return undefined;
}

const stopProxy = async () => {
  try {
    console.log('[Player] Attempting to stop proxy server.');
    await invoke('stop_proxy');
    console.log('[Player] Proxy server stop command issued.');
  } catch (e) {
    console.error('[Player] Error stopping proxy server:', e);
  }
};

const startDanmaku = async () => {
  if (!props.roomId) {
    console.log('[Player] startDanmaku: No roomId, exiting.');
    return;
  }
  if (!art.value || !art.value.plugins.artplayerPluginDanmuku) {
    console.log('[Player] startDanmaku: Artplayer or Danmaku plugin not ready. Aborting.');
    isLoadingDanmaku.value = false;
    isDanmakuStopped.value = true;
    return;
  }
  console.log(`[Player] Starting danmaku for room: ${props.roomId}, platform: ${props.platform}`);
  if (unlistenDanmaku) {
    console.log('[Player] Clearing previous danmaku listener.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }
  danmakuMessages.value = [];
  isLoadingDanmaku.value = true;
  isDanmakuStopped.value = false;
  try {
    let eventName = '';
    if (props.platform === Platform.DOUYIN) {
      console.log('[Player] Invoking start_douyin_danmu_listener for room:', props.roomId);
      const rustPayload: RustGetStreamUrlPayload = { 
        args: { room_id_str: props.roomId! }, 
        platform: props.platform, 
      };
      await invoke('start_douyin_danmu_listener', { payload: rustPayload });
      eventName = 'danmaku-message';
    } else if (props.platform === Platform.DOUYU) {
      console.log('[Player] Invoking start_danmaku_listener for room:', props.roomId);
      await invoke('start_danmaku_listener', { roomId: props.roomId });
      eventName = `danmaku-${props.roomId}`;
    } else {
      console.warn(`[Player] Danmaku not supported for platform: ${props.platform}`);
      isLoadingDanmaku.value = false;
      isDanmakuStopped.value = true;
      return;
    }
    console.log(`[Player] Setting up event listener for: ${eventName}`);
    // Listen for the raw payload from Rust
    unlistenDanmaku = await listen<RustDanmakuPayload>(eventName, (event: TauriEvent<RustDanmakuPayload>) => {
      if (art.value && art.value.plugins.artplayerPluginDanmuku && event.payload) {
        const rustP = event.payload;

        // Transform RustDanmakuPayload to DanmakuMessage for frontend use
        const frontendDanmaku: DanmakuMessage = {
          nickname: rustP.user || '未知用户', // Provide default for nickname
          content: rustP.content || '',       // Provide default for content
          level: String(rustP.user_level || 0), // Convert number to string, provide default
          // badgeName: undefined, // Douyin doesn't have badgeName, so omit or undefined
          badgeLevel: rustP.fans_club_level > 0 ? String(rustP.fans_club_level) : undefined, // Convert fans_club_level to string if > 0
          // color: undefined, // Color can be assigned later or by specific logic if needed
          // type and uid can be added if they are part of rustP and needed
        };

        art.value.plugins.artplayerPluginDanmuku.emit({
          text: frontendDanmaku.content,
          color: frontendDanmaku.color || '#FFFFFF', // Use transformed data's color or default
        });
        danmakuMessages.value.push(frontendDanmaku); // Push the transformed, frontend-ready danmaku object
        if (danmakuMessages.value.length > 200) {
          danmakuMessages.value.splice(0, danmakuMessages.value.length - 200);
        }
      } else {
        console.log('[Player] Danmaku received, but Artplayer or plugin not ready or no payload.');
      }
    });
    console.log(`[Player] Danmaku listener started for ${eventName}.`);
    isLoadingDanmaku.value = false;
  } catch (e) {
    console.error('[Player] Error starting danmaku:', e);
    isLoadingDanmaku.value = false;
    isDanmakuStopped.value = true;
    danmakuMessages.value.push({
      nickname: '系统消息',
      content: `弹幕连接失败: ${(e as Error).message}`,
      color: '#FF6347',
      level: '0',
    });
  }
};

const stopDanmaku = async () => {
  console.log(`[Player] Attempting to stop danmaku for room: ${props.roomId}, platform: ${props.platform}`);
  if (unlistenDanmaku) {
    console.log('[Player] Calling unlistenDanmaku function.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }
  if (props.platform === Platform.DOUYU && props.roomId) {
      try {
        console.log('[Player] Invoking stop_danmaku_listener for Douyu room:', props.roomId);
        await invoke('stop_danmaku_listener', { roomId: props.roomId });
      } catch (error) {
        console.error('[Player] Error invoking stop_danmaku_listener:', error);
      }
  }
  isDanmakuStopped.value = true;
  isLoadingDanmaku.value = false;
  console.log(`[Player] Danmaku stopped for room: ${props.roomId}.`);
};

const initializePlayerAndStream = async (roomId: string, platform: Platform, directUrl?: string | null) => {
  console.log(`[Player] initializePlayerAndStream for platform: ${platform}, roomId: ${roomId}, directUrl: ${directUrl}`);
  if (art.value) {
    console.log('[Player] Destroying existing ArtPlayer instance.');
    await stopDanmaku();
    if (platform !== Platform.DOUYU) {
        console.log('[Player] New platform is not Douyu, attempting to stop any existing proxy from a previous session.');
        await stopProxy(); 
    }
    art.value.destroy();
    art.value = null;
  }
  if (!playerContainer.value) {
    console.error('[Player] playerContainer is null. Cannot init Artplayer.');
    streamError.value = '播放器容器不存在。';
    isLoadingStream.value = false;
    return;
  }
  isLoadingStream.value = true;
  streamError.value = null;
  streamFetchAttempts.value = 0;
  let finalStreamUrl: string | null = null;
  let streamType: string | undefined = undefined;

  const artPlayerOptionsBase = {
    container: playerContainer.value!,
    isLive: true, pip: true, autoplay: true, autoSize: false, aspectRatio: false,
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
  };

  const currentPlatform: Platform = platform;

  if (currentPlatform === Platform.DOUYIN) {
    if (directUrl) {
      finalStreamUrl = directUrl;
      streamType = determineStreamType(finalStreamUrl);
    } else {
      streamError.value = '抖音直播流地址未提供。';
      isLoadingStream.value = false; return;
    }
  } else if (currentPlatform === Platform.DOUYU) {
    console.log('[Player] Fetching Douyu stream details for roomId:', roomId);
    for (let attempt = 1; attempt <= MAX_STREAM_FETCH_ATTEMPTS; attempt++) {
      try {
        const playbackDetails = await fetchStreamPlaybackDetails(roomId, Platform.DOUYU);
        if (playbackDetails && playbackDetails.primaryUrl) {
          finalStreamUrl = playbackDetails.primaryUrl;
          streamType = playbackDetails.format === 'm3u8' ? 'hls' : playbackDetails.format;
          streamError.value = null; break;
        } else {
          streamError.value = '斗鱼直播流地址获取为空。';
        }
      } catch (e: any) {
        streamError.value = `获取斗鱼直播流失败(${attempt}): ${e.message}`;
        if (attempt === MAX_STREAM_FETCH_ATTEMPTS) { isLoadingStream.value = false; return; }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    if (!finalStreamUrl) { isLoadingStream.value = false; return; }
    try {
      await stopProxy();
      await invoke('set_stream_url_cmd', { url: finalStreamUrl });
      finalStreamUrl = await invoke<string>('start_proxy');
      console.log('[Player] Douyu Proxy URL:', finalStreamUrl);
    } catch (e: any) {
      streamError.value = `设置斗鱼代理失败: ${e.message}`;
      isLoadingStream.value = false; return;
    }
  } else {
    streamError.value = `不支持的平台: ${platform}`;
    isLoadingStream.value = false; return;
  }
  if (!finalStreamUrl) {
    streamError.value = streamError.value || '未能获取有效的直播流地址。';
    isLoadingStream.value = false; return;
  }
  try {
    console.log(`[Player] Creating Artplayer: URL=${finalStreamUrl}, Type=${streamType}`);
    art.value = new Artplayer({
      ...artPlayerOptionsBase, url: finalStreamUrl, type: streamType,
      customType: {
        ...(streamType === 'flv' ? {
          flv: function(video: HTMLVideoElement, url: string, artInst: Artplayer) {
            import('mpegts.js').then(mpegts => {
              if (mpegts.default.isSupported()) {
                const flvPlayer = mpegts.default.createPlayer(
                  { type: 'flv', url: url, isLive: true, hasAudio: true, hasVideo: true, cors: true, fixAudioTimestampGap: false, autoCleanupSourceBuffer: true }, 
                  { enableWorker: true, lazyLoad: false, stashInitialSize: 1024*2, liveBufferLatencyChasing: true, liveSync: true }
                );
                flvPlayer.attachMediaElement(video);
                flvPlayer.load();
                const platformStr = String(platform);
                video.play().catch(e => console.error(`[Player ${platformStr}] FLV Auto-play error:`, e));
                flvPlayer.on('error', (errType, errInfo) => {
                  console.error(`[mpegts ${platformStr}] Error:`, errType, errInfo);
                  streamError.value = `FLV组件错误: ${errInfo.msg}`;
                });
              } else {
                streamError.value = '浏览器不支持FLV播放。';
              }
            }).catch(err => { streamError.value = '加载FLV播放组件失败。'; });
          }
        } : {}),
      },
    });
    art.value.on('ready', () => {
      console.log('[Player] Artplayer instance ready.');
      if (props.roomId && props.platform) {
        console.log('[Player] Artplayer ready, starting danmaku.');
        startDanmaku(); 
      } else {
        console.log('[Player] Artplayer ready, but no roomId/platform. Danmaku not started.');
      }
    });
    art.value.on('error', (err: any) => { streamError.value = `播放器错误: ${err.message}`; isLoadingStream.value = false; });
    art.value.on('fullscreen', (s: boolean) => { isFullScreen.value = s; emit('fullscreen-change', s); });
    art.value.on('fullscreenWeb', (s: boolean) => { isFullScreen.value = s; emit('fullscreen-change', s); });
  } catch (e: any) {
    streamError.value = `初始化播放器失败: ${e.message}`;
  }
  isLoadingStream.value = false;
};

watch(() => [props.roomId, props.platform, props.streamUrl], async ([newRoomId, newPlatform, newStreamUrl], [oldRoomId, oldPlatform, oldStreamUrl]) => {
  console.log(`[Player] Watch: New=${newRoomId}(${newPlatform}), URL=${newStreamUrl}. Old=${oldRoomId}(${oldPlatform}), URL=${oldStreamUrl}`);
  if (newRoomId && newPlatform) {
    if (newRoomId !== oldRoomId || newPlatform !== oldPlatform || (newPlatform === Platform.DOUYIN && newStreamUrl !== oldStreamUrl && newStreamUrl)) {
      console.log('[Player] Critical props changed. Re-initializing.');
      const urlToPass = newPlatform === Platform.DOUYIN ? newStreamUrl : undefined;
      await initializePlayerAndStream(newRoomId, newPlatform, urlToPass);
    } else {
      console.log('[Player] Props changed but no re-initialization deemed necessary.');
    }
  } else if (!newRoomId && art.value) {
    console.log('[Player] No newRoomId, stopping and clearing player.');
    await stopDanmaku();
    if (oldPlatform === Platform.DOUYU) {
        console.log('[Player] Watcher clearing player: old platform was Douyu, stopping proxy.');
        await stopProxy(); 
    }
    art.value.destroy();
    art.value = null;
    isLoadingStream.value = false;
    danmakuMessages.value = [];
    streamError.value = null;
  }
}, { immediate: false });

onMounted(async () => {
  console.log(`[Player] Mounted. RoomID: ${props.roomId}, Platform: ${props.platform}, URL: ${props.streamUrl}`);
  if (props.roomId && props.platform) {
    const urlToPass = props.platform === Platform.DOUYIN ? props.streamUrl : undefined;
    await initializePlayerAndStream(props.roomId, props.platform, urlToPass);
  } else {
    console.warn('[Player] Mounted without RoomID/Platform.');
    isLoadingStream.value = false;
    if (playerContainer.value && !art.value) {
        console.log('[Player] No stream to play on mount.');
    }
  }
});

onUnmounted(async () => {
  console.log('[Player] Component unmounted. Cleaning up...');
  
  if (unlistenDanmaku) {
    console.log('[Player] Unmounting: Clearing generic danmaku listener.');
    unlistenDanmaku();
    unlistenDanmaku = null;
  }

  if (props.platform === Platform.DOUYIN) {
    console.log('[Player] Unmounting: Stopping Douyin danmaku listener via specific command.');
    try {
      const rustPayload: RustGetStreamUrlPayload = { 
        args: { room_id_str: "stop_listening" }, 
        platform: props.platform, 
      };
      await invoke('start_douyin_danmu_listener', { payload: rustPayload });
    } catch (error) {
      console.error('[Player] Error stopping Douyin danmaku listener on unmount:', error);
    }
  } else if (props.platform === Platform.DOUYU && props.roomId) {
    try {
      console.log('[Player] Unmounting: Invoking stop_danmaku_listener for Douyu room:', props.roomId);
      await invoke('stop_danmaku_listener', { roomId: props.roomId });
    } catch (error) {
      console.error('[Player] Error invoking stop_danmaku_listener for Douyu on unmount:', error);
    }
  }

  if (props.platform === Platform.DOUYU) { // Only stop proxy if it was a Douyu stream
      await stopProxy();
  }

  if (art.value) {
    console.log('[Player] Unmounting: Destroying ArtPlayer instance.');
    art.value.destroy();
    art.value = null;
  }
  danmakuMessages.value = []; // Clear danmaku list
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