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
        <div v-else-if="isOfflineError" class="offline-player">
          <!-- Display StreamerInfo if room details are available -->
          <StreamerInfo 
            v-if="props.roomId && props.platform"
            :room-id="props.roomId"
            :platform="props.platform"
            :title="playerTitle"
            :anchor-name="playerAnchorName"
            :avatar="playerAvatar"
            :is-live="false"
            :is-followed="props.isFollowed"
            @follow="$emit('follow', $event)"
            @unfollow="$emit('unfollow', $event)"
            class="streamer-info-offline"
          />
          <div class="offline-message">
            <div class="offline-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 16.427A4.002 4.002 0 0 0 12.005 20a4 4 0 0 0-3.995-3.573M12 12V2M8.5 7L7 5.5M15.5 7l1.5-1.5M5.562 10.223l-1.842.511M18.438 10.223l1.842.511M12 2a3.5 3.5 0 0 1 3.5 3.5V12H8.5V5.5A3.5 3.5 0 0 1 12 2z"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke-width="2"></line> 
              </svg>
            </div>
            <h3>😴 {{ streamError }}</h3>
            <p>主播当前未开播，请稍后再来。</p>
            <button @click="retryInitialization" class="retry-btn">再试一次</button>
          </div>
        </div>
        <div v-else-if="streamError && !isOfflineError" class="error-player">
          <div class="error-icon">
             <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3>加载失败</h3>
          <p>{{ streamError }}</p>
          <button @click="retryInitialization" class="retry-btn">再试一次</button>
        </div>
        <div v-else class="player-container">
          <StreamerInfo
            v-if="props.roomId"
            :room-id="props.roomId"
            :platform="props.platform"
            :title="playerTitle"
            :anchor-name="playerAnchorName"
            :avatar="playerAvatar"
            :is-followed="props.isFollowed"
            :is-live="playerIsLive"
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

import { Platform } from '../../platforms/common/types';
import type { DanmakuMessage } from './types'; // Moved to a shared types file

// Platform-specific player helpers
import { getDouyuStreamConfig, startDouyuDanmakuListener, stopDouyuDanmaku, stopDouyuProxy } from '../../platforms/douyu/playerHelper';
import { fetchAndPrepareDouyinStreamConfig, startDouyinDanmakuListener, stopDouyinDanmaku } from '../../platforms/douyin/playerHelper';

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
  initialError?: string | null; // Added to accept pre-determined errors like "主播未开播"
}>();

const emit = defineEmits<{
  (e: 'follow', streamer: any): void;
  (e: 'unfollow', roomId: string): void;
  (e: 'close-player'): void;
  (e: 'fullscreen-change', isFullscreen: boolean): void;
  (e: 'request-refresh-details'): void;
}>();

const playerContainerRef = ref<HTMLDivElement | null>(null);
const art = shallowRef<Artplayer | null>(null);
const flvPlayerInstance = shallowRef<any>(null);
const danmakuMessages = ref<DanmakuMessage[]>([]);
const isDanmakuListenerActive = ref(false); // Tracks if a danmaku listener is supposed to be running
let unlistenDanmakuFn: (() => void) | null = null;

const isLoadingStream = ref(true);
const streamError = ref<string | null>(null);
const isOfflineError = ref(false); // Added to track '主播未开播' state

// Reactive state for streamer info, initialized by props, potentially updated by internal fetches (for Douyin)
const playerTitle = ref(props.title);
const playerAnchorName = ref(props.anchorName);
const playerAvatar = ref(props.avatar);
const playerIsLive = ref(props.isLive);

const isInNativeFullscreen = ref(false);
const isInWebFullscreen = ref(false);
const isFullScreen = ref(false); // True if either native or web fullscreen is active

async function initializePlayerAndStream(pRoomId: string, pPlatform: Platform, pStreamUrlProp?: string | null, isRefresh: boolean = false) {
  console.log(`[Player] Initialize: Room=${pRoomId}, Platform=${pPlatform}, StreamURLProp=${pStreamUrlProp}, isRefresh=${isRefresh}, InitialErrorFromProps=${props.initialError}`);
  
  // Reset states at the beginning of every initialization attempt
  isLoadingStream.value = true;
  streamError.value = null; // Clear previous general errors
  isOfflineError.value = false; // Clear previous offline state
  
  if (!isRefresh) {
    danmakuMessages.value = [];
  }

  // Handle initialError from props (e.g., Douyin pre-check says "主播未开播")
  if (props.initialError && props.initialError.includes('主播未开播')) {
    console.log(`[Player] Handling initialError from props: ${props.initialError}`);
    streamError.value = props.initialError;
    isOfflineError.value = true;
    // Update reactive player info based on props if offline state is from props
    playerTitle.value = props.title;
    playerAnchorName.value = props.anchorName;
    playerAvatar.value = props.avatar;
    playerIsLive.value = false; // Explicitly set to false if error indicates offline

    isLoadingStream.value = false;
    return; // Skip further initialization if streamer is known to be offline
  }

  if (art.value) {
    console.log('[Player] Destroying existing ArtPlayer instance.');
    await stopCurrentDanmakuListener(props.platform, props.roomId); 
    
    // 销毁 mpegts.js 实例
    if (flvPlayerInstance.value) {
        try {
            flvPlayerInstance.value.destroy();
            console.log('[Player] Destroyed mpegts.js player instance before new Artplayer.');
        } catch (e) {
            console.error('[Player] Error destroying mpegts.js player:', e);
        }
        flvPlayerInstance.value = null;
    }

    if (art.value.playing) art.value.pause();
    art.value.destroy(false); 
    art.value = null;
  }

  try {
    let streamConfig: { streamUrl: string, streamType: string | undefined };

    if (pPlatform === Platform.DOUYU) {
      // playerIsLive should be updated by the watcher from props.isLive from DouyuPlayerView
      if (playerIsLive.value === false) { // Explicitly check for false, as null/undefined might mean info not yet loaded
        console.log(`[Player] Douyu platform: Streamer is explicitly offline (playerIsLive.value is false). Skipping stream fetch.`);
        streamError.value = streamError.value || '主播未开播。'; // Preserve specific error if already set by initialError prop
        isOfflineError.value = true;
        isLoadingStream.value = false;
        return; // Stop further execution for stream fetching and player init
      }
      // If playerIsLive is true or undefined (meaning DouyuPlayerView might not have passed it, or we assume live by default if prop absent)
      // then proceed to get stream config.
      console.log('[Player] Douyu platform: Attempting to get stream config.');
      streamConfig = await getDouyuStreamConfig(pRoomId);
      // After getting streamConfig, we might get an error or no URL, which will be handled by subsequent checks.
      // If getDouyuStreamConfig itself determines offline and throws/returns error, it will be caught by the main try-catch.

    } else if (pPlatform === Platform.DOUYIN) {
      const douyinConfig = await fetchAndPrepareDouyinStreamConfig(pRoomId);
      
      // Update internal reactive state with fetched Douyin info
      playerTitle.value = douyinConfig.title;
      playerAnchorName.value = douyinConfig.anchorName;
      playerAvatar.value = douyinConfig.avatar;
      playerIsLive.value = douyinConfig.isLive;
      
      if (douyinConfig.initialError || !douyinConfig.isLive || !douyinConfig.streamUrl) {
        streamError.value = douyinConfig.initialError || '主播未开播或无法获取直播流。';
        isOfflineError.value = true; // Assume offline or error state
        isLoadingStream.value = false;
        // Ensure playerIsLive is false if there's an error making it unplayable
        playerIsLive.value = false; 
        console.warn(`[Player] Douyin config error or not live: ${streamError.value}`);
        return; // Stop if not playable
      }
      streamConfig = { streamUrl: douyinConfig.streamUrl, streamType: douyinConfig.streamType };
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

    // Determine final stream type, ensuring .m3u8 URLs are treated as HLS
    let finalArtPlayerStreamType = streamConfig.streamType;
    if (streamConfig.streamUrl && streamConfig.streamUrl.includes('.m3u8')) {
      if (finalArtPlayerStreamType !== 'hls') {
        console.log(`[Player] URL contains .m3u8. Overriding streamType from '${finalArtPlayerStreamType}' to 'hls'.`);
        finalArtPlayerStreamType = 'hls';
      }
    }

    const artPlayerOptions: any = {
        container: playerContainerRef.value, 
        url: streamConfig.streamUrl,
        type: finalArtPlayerStreamType || 'flv', // Use the potentially overridden type, fallback to 'flv'
        isLive: true, pip: true, autoplay: true, autoSize: false, aspectRatio: false,
        fullscreen: true, fullscreenWeb: true, miniProgressBar: true, mutex: true,
        backdrop: false, playsInline: true, autoPlayback: true, theme: '#FB7299', lang: 'zh-cn',
        moreVideoAttr: { playsInline: true },
        plugins: [
            artplayerPluginDanmuku({
            danmuku: [], speed: 7, opacity: 1, fontSize: 20, color: '#FFFFFF',
            mode: 0, margin: [10, '2%'], antiOverlap: true, synchronousPlayback: false, emitter:false
            }),
        ],
        controls: [
          {             
            name: 'streamRefresh', 
            position: 'left',     
            index: 15, // Placed immediately after play/pause
            html: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></svg>',
            tooltip: '刷新',
            click: async () => {
              console.log('[Player] Stream Refresh button clicked (from controls option).');
              if (props.roomId && props.platform) {
                await initializePlayerAndStream(props.roomId, props.platform, props.streamUrl, true);
              } else {
                console.warn('[Player] Refresh clicked but no roomId/platform available.');
              }
            }
          }, // Volume control, far right
        ],
        customType: {
            flv: function(video: HTMLVideoElement, url: string) {
                const platformForLog = pPlatform; 
                import('mpegts.js').then(mpegts => {
                    if (mpegts.default.isSupported()) {
                        // 如果之前有实例，再次检查并销毁 (双重保险，主要销毁点在 Artplayer 销毁前)
                        if (flvPlayerInstance.value) {
                            try {
                                flvPlayerInstance.value.destroy();
                                console.log('[Player] Destroyed previous mpegts.js player instance within customType.flv.');
                            } catch (e) {
                                console.error('[Player] Error destroying previous mpegts.js player in customType.flv:', e);
                            }
                            flvPlayerInstance.value = null;
                        }

                        console.log(`[Player ${platformForLog}] mpegts.js is supported. Initializing FLV player for URL:`, url);
                        const flvPlayer = mpegts.default.createPlayer(
                            { type: 'flv', url: url, isLive: true, cors: true, hasAudio: true, hasVideo: true }, 
                            {}
                        );
                        flvPlayerInstance.value = flvPlayer; // <--- 保存新实例
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
    art.value.on('error', (error: any, _reconnectTime: number) => { 
        console.error('[Player] Artplayer error:', error);
        streamError.value = `播放器错误: ${error.message || error}`; 
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

  } catch (error: any) {
    console.error(`[Player] Error initializing stream for ${pPlatform} room ${pRoomId}:`, error);
    const errorMessage = error.message || '加载直播流失败，请稍后再试。';
    if (errorMessage.includes('主播未开播')) {
      streamError.value = errorMessage; // Store the specific "主播未开播" message
      isOfflineError.value = true;       // Set the flag for custom display
    } else {
      streamError.value = errorMessage;
      isOfflineError.value = false;
    }
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
    
    if (props.platform === Platform.DOUYU) {
      console.log('[Player] Douyu platform: Emitting request-refresh-details to parent.');
      // Set loading state immediately to give user feedback
      isLoadingStream.value = true; 
      streamError.value = null; // Clear previous errors
      isOfflineError.value = false; // Clear offline state
      emit('request-refresh-details');
      // For Douyu, we now rely on the parent (DouyuPlayerView) to re-fetch details.
      // When DouyuPlayerView updates the props (like `isLive`), 
      // the watcher in MainPlayer (that listens to prop changes)
      // will automatically call `initializePlayerAndStream`.
    } else {
      // For other platforms like Douyin, MainPlayer handles its own fetching 
      // directly within initializePlayerAndStream.
      initializePlayerAndStream(props.roomId, props.platform, props.streamUrl);
    }
  } else {
    console.warn('[Player] Retry initialization called but no roomId or platform.');
  }
};

watch([() => props.roomId, () => props.platform, () => props.streamUrl, () => props.avatar, () => props.title, () => props.anchorName, () => props.isLive], 
  async ([newRoomId, newPlatform, newStreamUrl, _newAvatar, _newTitle, _newAnchorName, _newIsLive], [oldRoomId, oldPlatform, _oldStreamUrl, _oldAvatar, _oldTitle, _oldAnchorName, _oldIsLive]) => {
    // Update internal reactive streamer info when props change
    // For Douyin, these props might be initially undefined, and then MainPlayer fetches them.
    // For Douyu, props are the source of truth for this info.
    if (newPlatform === Platform.DOUYU) { // Only update from props if Douyu
      playerTitle.value = _newTitle;
      playerAnchorName.value = _newAnchorName;
      playerAvatar.value = _newAvatar;
      if (_newIsLive !== undefined) {
          playerIsLive.value = _newIsLive;
      }
    }

    // Initial error from props (e.g., DouyuPlayerView determined offline before MainPlayer rendered)
    if (newRoomId && newPlatform) {
      // Always reset isOfflineError when props change significantly unless initialError prop dictates it
      if (!(props.initialError && props.initialError.includes('主播未开播'))) {
        isOfflineError.value = false; 
      }
      if (newRoomId !== oldRoomId || newPlatform !== oldPlatform || (newPlatform === Platform.DOUYIN && newStreamUrl !== _oldStreamUrl)) {
         console.log(`[Player] Props changed. Re-initializing player for ${newPlatform} room ${newRoomId}.`);
        initializePlayerAndStream(newRoomId, newPlatform, newStreamUrl); // Douyin will ignore newStreamUrl now
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
      
      // 销毁 mpegts.js 实例 (当房间关闭导致播放器清理时)
      if (flvPlayerInstance.value) {
          try {
              flvPlayerInstance.value.destroy();
              console.log('[Player] Destroyed mpegts.js player instance in watcher (room closed).');
          } catch (e) {
              console.error('[Player] Error destroying mpegts.js player in watcher:', e);
          }
          flvPlayerInstance.value = null;
      }

      if (art.value.playing) art.value.pause();
      art.value.destroy(false); // art.value.destroy(true) on unmount for full cleanup
      art.value = null;
      isLoadingStream.value = false;
      danmakuMessages.value = [];
      streamError.value = null;
      isOfflineError.value = false; // Clear offline error state
    }

    // If props.roomId and props.platform are present at mount.
    // No need to call it explicitly here again.
    if (!props.roomId || !props.platform) {
      console.log('[Player] Mounted without RoomID/Platform. Player will be empty.');
      // If initialError is present from props even without roomId/platform (e.g. a general error page routing here)
      // Ensure isLoading is false and error states are reflected.
      if (props.initialError) {
        if (props.initialError.includes('主播未开播')) {
            streamError.value = props.initialError;
            isOfflineError.value = true;
        } else {
            streamError.value = props.initialError;
            isOfflineError.value = false; // Ensure it's not marked as offline for other errors
        }
      }
      isLoadingStream.value = false;
    }
}, 
{ immediate: true }
);

onMounted(async () => {
  console.log(`[Player] Mounted. RoomID: ${props.roomId}, Platform: ${props.platform}, URL: ${props.streamUrl}`);
  // The immediate watcher should handle the initial call to initializePlayerAndStream
  // if props.roomId and props.platform are present at mount.
  // No need to call it explicitly here again.
  if (!props.roomId || !props.platform) {
    console.log('[Player] Mounted without RoomID/Platform. Player will be empty.');
    // If initialError is present from props even without roomId/platform (e.g. a general error page routing here)
    // Ensure isLoading is false and error states are reflected.
    if (props.initialError) {
      if (props.initialError.includes('主播未开播')) {
          streamError.value = props.initialError;
          isOfflineError.value = true;
      } else {
          streamError.value = props.initialError;
          isOfflineError.value = false; // Ensure it's not marked as offline for other errors
      }
    }
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

  // 销毁 mpegts.js 实例
  if (flvPlayerInstance.value) {
      try {
          flvPlayerInstance.value.destroy();
          console.log('[Player] Destroyed mpegts.js player instance on unmount.');
      } catch (e) {
          console.error('[Player] Error destroying mpegts.js player on unmount:', e);
      }
      flvPlayerInstance.value = null;
  }

  if (art.value) {
    console.log('[Player] Unmounting: Destroying ArtPlayer instance.');
    if (art.value.playing) art.value.pause();
    art.value.destroy(true); // true to remove video element and all listeners
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

.error-player .retry-btn, 
.offline-player .retry-btn { /* Ensure .offline-player .retry-btn also uses these styles */
  margin-top: 25px; /* Increased margin-top slightly */
  padding: 12px 28px; 
  background-color: #FB7299; 
  color: white;
  border: none;
  border-radius: 10px; 
  cursor: pointer;
  font-size: 1.05em; 
  font-weight: 500;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.2);
}

.error-player .retry-btn:hover,
.offline-player .retry-btn:hover {
  background-color: #e06387; 
  transform: translateY(-2px); 
  box-shadow: 0 6px 16px rgba(251, 114, 153, 0.3);
}

.error-player .retry-btn:active,
.offline-player .retry-btn:active {
  transform: translateY(0px);
  box-shadow: 0 3px 10px rgba(251, 114, 153, 0.15);
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

.offline-player {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 40px;
  height: 100%;
  box-sizing: border-box;
}

.offline-message {
  margin-top: 20px;
}

.offline-icon svg {
  color: #727272; /* A softer color for the icon */
  margin-bottom: 16px;
}

.offline-player h3 {
  font-size: 1.4em;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.offline-player p {
  font-size: 1em;
  color: #a0a0a0;
}

.streamer-info-offline {
  width: 100%;
  max-width: 700px; /* Limit width of streamer info bar */
  margin-bottom: 30px;
  /* Add styles to ensure it looks good above the offline message */
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 20px;
}
</style>