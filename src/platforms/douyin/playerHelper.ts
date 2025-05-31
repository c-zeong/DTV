import { invoke } from '@tauri-apps/api/core';
import { listen, type Event as TauriEvent } from '@tauri-apps/api/event';
import Artplayer from 'artplayer';
import { Ref } from 'vue';
import { Platform } from '../common/types';
import type { DanmakuMessage, RustGetStreamUrlPayload } from '../../components/player/types';
import type { LiveStreamInfo } from '../common/types';

// Specific type for Douyin's raw danmaku payload from Rust event
// This was named RustDanmakuPayload in player/index.vue
export interface DouyinRustDanmakuPayload {
  room_id?: string; 
  user: string;      // Nickname from Rust's DanmakuFrontendPayload
  content: string;
  user_level: number; // from Rust's i64
  fans_club_level: number; // from Rust's i32
}

// Old synchronous function, to be replaced or removed
// export function getDouyinStreamConfig(streamUrlProp: string | undefined | null): { streamUrl: string, streamType: string | undefined } {
//   if (!streamUrlProp) {
//     throw new Error('抖音直播流 URL 未提供。');
//   }
//   const streamType = streamUrlProp.includes('.m3u8') ? 'hls' : (streamUrlProp.includes('.flv') ? 'flv' : undefined);
//   return { streamUrl: streamUrlProp, streamType };
// }

// New asynchronous function to fetch Douyin stream details including URL and metadata
export async function fetchAndPrepareDouyinStreamConfig(roomId: string): Promise<{ 
  streamUrl: string | null;
  streamType: string | undefined; 
  title?: string | null; 
  anchorName?: string | null; 
  avatar?: string | null; 
  isLive: boolean; 
  initialError: string | null; // Made non-optional, will always be string or null
}> {
  console.log('[DouyinPlayerHelper] Fetching Douyin stream details for roomId:', roomId);
  if (!roomId) {
    return { streamUrl: null, streamType: undefined, title: null, anchorName: null, avatar: null, isLive: false, initialError: '房间ID未提供' };
  }

  try {
    const payloadData = { args: { room_id_str: roomId } };
    const result = await invoke<LiveStreamInfo>('get_douyin_live_stream_url', { payload: payloadData });

    if (result.error_message) {
      console.error(`[DouyinPlayerHelper] Error from backend for room ${roomId}: ${result.error_message}`);
      return {
        streamUrl: null,
        streamType: undefined,
        title: result.title,
        anchorName: result.anchor_name,
        avatar: result.avatar,
        isLive: result.status === 2,
        initialError: result.error_message, // string | null from Rust
      };
    }

    const streamAvailable = result.status === 2 && !!result.stream_url;
    let streamType: string | undefined = undefined;
    let uiMessage: string | null = null; 

    if (streamAvailable && result.stream_url) {
      if (result.stream_url.startsWith('http://127.0.0.1') && result.stream_url.endsWith('/live.flv')) {
        streamType = 'flv';
      } else if (result.stream_url.includes('pull-hls') || result.stream_url.endsWith('.m3u8')) {
        streamType = 'hls';
      } else if (result.stream_url.includes('pull-flv') || result.stream_url.includes('.flv')) {
        streamType = 'flv';
      } else {
        console.warn(`[DouyinPlayerHelper] Could not determine stream type for URL: ${result.stream_url}.`);
      }
      // uiMessage remains null if stream is available and no prior error.
    } else {
      if (result.status !== 2) {
        uiMessage = result.title ? `主播 ${result.anchor_name || ''} 未开播。` : '主播未开播或房间不存在。';
      } else {
        uiMessage = '主播在线，但获取直播流失败。';
      }
    }

    return {
      streamUrl: streamAvailable ? (result.stream_url !== undefined ? result.stream_url : null) : null,
      streamType: streamType,
      title: result.title,
      anchorName: result.anchor_name,
      avatar: result.avatar,
      isLive: streamAvailable,
      initialError: uiMessage, // uiMessage is definitely string or null here.
    };

  } catch (e: any) {
    console.error(`[DouyinPlayerHelper] Exception while fetching Douyin stream details for ${roomId}:`, e);
    return { 
        streamUrl: null, 
        streamType: undefined, 
        title: null, 
        anchorName: null, 
        avatar: null, 
        isLive: false, 
        initialError: e.message || '获取直播信息失败: 未知错误' // Ensure string here
    };
  }
}

export async function startDouyinDanmakuListener(
  roomId: string,
  artInstance: Artplayer, // For emitting danmaku to player
  danmakuMessagesRef: Ref<DanmakuMessage[]> // For updating DanmuList
): Promise<() => void> {
  console.log('[DouyinPlayerHelper] Invoking start_douyin_danmu_listener for room:', roomId);
  console.log('[DouyinPlayerHelper] Received artInstance:', artInstance); // Log artInstance
  if (artInstance && artInstance.plugins) {
    console.log('[DouyinPlayerHelper] artInstance.plugins:', artInstance.plugins); // Log plugins object
    console.log('[DouyinPlayerHelper] artInstance.plugins.artplayerPluginDanmuku:', artInstance.plugins.artplayerPluginDanmuku); // Log danmuku plugin
  } else {
    console.log('[DouyinPlayerHelper] artInstance or artInstance.plugins is NULL/UNDEFINED.');
  }

  const rustPayload: RustGetStreamUrlPayload = { 
    args: { room_id_str: roomId }, 
    platform: Platform.DOUYIN, 
  };
  await invoke('start_douyin_danmu_listener', { payload: rustPayload });
  
  const eventName = 'danmaku-message'; // Douyin uses a generic event name
  console.log(`[DouyinPlayerHelper] Setting up event listener for: ${eventName}`);

  const unlisten = await listen<DouyinRustDanmakuPayload>(eventName, (event: TauriEvent<DouyinRustDanmakuPayload>) => {
    // Add detailed logging here, inside the callback
    console.log('[DouyinPlayerHelper] INSIDE CALLBACK - Checking artInstance state:');
    if (!artInstance) {
      console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance is NULL or UNDEFINED.');
    } else {
      console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance exists.');
      if (!artInstance.plugins) {
        console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance.plugins is NULL or UNDEFINED.');
      } else {
        console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance.plugins exists:', artInstance.plugins);
        if (artInstance.plugins.artplayerPluginDanmuku === undefined) {
          console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance.plugins.artplayerPluginDanmuku is UNDEFINED.');
        } else if (artInstance.plugins.artplayerPluginDanmuku === null) {
          console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance.plugins.artplayerPluginDanmuku is NULL.');
        } else {
          console.log('[DouyinPlayerHelper] INSIDE CALLBACK - artInstance.plugins.artplayerPluginDanmuku exists:', artInstance.plugins.artplayerPluginDanmuku);
        }
      }
    }
    console.log('[DouyinPlayerHelper] INSIDE CALLBACK - event.payload exists?:', !!event.payload);

    if (artInstance && artInstance.plugins && artInstance.plugins.artplayerPluginDanmuku && event.payload) {
      const rustP = event.payload;
      const frontendDanmaku: DanmakuMessage = {
        nickname: rustP.user || '未知用户',
        content: rustP.content || '',
        level: String(rustP.user_level || 0),
        badgeLevel: rustP.fans_club_level > 0 ? String(rustP.fans_club_level) : undefined,
        room_id: rustP.room_id || roomId, // Ensure room_id is present
      };

      artInstance.plugins.artplayerPluginDanmuku.emit({
        text: frontendDanmaku.content,
        color: frontendDanmaku.color || '#FFFFFF', 
      });
      danmakuMessagesRef.value.push(frontendDanmaku);
      if (danmakuMessagesRef.value.length > 200) { // Manage danmaku array size
        danmakuMessagesRef.value.splice(0, danmakuMessagesRef.value.length - 200);
      }
    } else {
      console.log('[DouyinPlayerHelper] Danmaku received, but Artplayer instance, its plugins, the danmuku plugin, or event payload was not valid/ready. Check preceding logs for details.'); // Enhanced log message
    }
  });
  
  console.log(`[DouyinPlayerHelper] Danmaku listener started for ${eventName}.`);
  return unlisten;
}

export async function stopDouyinDanmaku(currentUnlistenFn: (() => void) | null): Promise<void> {
  console.log('[DouyinPlayerHelper] Attempting to stop danmaku for Douyin.');
  if (currentUnlistenFn) {
    console.log('[DouyinPlayerHelper] Calling unlistenDanmaku function.');
    currentUnlistenFn();
  }
  try {
    console.log('[DouyinPlayerHelper] Invoking start_douyin_danmu_listener with stop_listening signal.');
    const rustPayload: RustGetStreamUrlPayload = { 
      args: { room_id_str: "stop_listening" }, 
      platform: Platform.DOUYIN, 
    };
    await invoke('start_douyin_danmu_listener', { payload: rustPayload });
  } catch (error) {
    console.error('[DouyinPlayerHelper] Error stopping Douyin danmaku listener:', error);
  }
} 