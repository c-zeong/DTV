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
  streamUrl: string | null; // Null if not live or error
  streamType: string | undefined; 
  title?: string | null; 
  anchorName?: string | null; 
  avatar?: string | null; 
  isLive: boolean; 
  initialError?: string | null; 
}> {
  console.log('[DouyinPlayerHelper] Fetching Douyin stream details for roomId:', roomId);
  if (!roomId) {
    // This case should ideally be caught before calling, but as a safeguard:
    return { streamUrl: null, streamType: undefined, title: null, anchorName: null, avatar: null, isLive: false, initialError: '房间ID未提供' };
  }

  try {
    const payloadData = { args: { room_id_str: roomId } };
    // Assuming LiveStreamInfo is the correct type returned by this invoke call
    const result = await invoke<LiveStreamInfo>('get_douyin_live_stream_url', { payload: payloadData });

    if (result.error_message) {
      console.error(`[DouyinPlayerHelper] Error from backend for room ${roomId}: ${result.error_message}`);
      return { 
        streamUrl: null, 
        streamType: undefined, 
        title: result.title, // Still return title/anchor/avatar if available
        anchorName: result.anchor_name,
        avatar: result.avatar,
        isLive: result.status === 2, // Reflect reported status if available
        initialError: result.error_message 
      };
    }

    const isActuallyLive = result.status === 2 && !!result.stream_url;
    let streamType: string | undefined = undefined;

    if (isActuallyLive && result.stream_url) {
      // Determine stream type from URL
      if (result.stream_url.includes('pull-hls') || result.stream_url.endsWith('.m3u8')) {
        streamType = 'hls';
      } else if (result.stream_url.includes('pull-flv') || result.stream_url.includes('.flv')) { // .flv might not be in path for some direct FLV urls
        streamType = 'flv';
      } else {
        // Fallback or default if type cannot be determined but URL exists
        console.warn(`[DouyinPlayerHelper] Could not determine stream type for URL: ${result.stream_url}. Defaulting to undefined.`);
        // streamType = 'flv'; // Or some other default if applicable
      }
    }
    
    return {
      streamUrl: isActuallyLive ? result.stream_url : null,
      streamType: streamType,
      title: result.title,
      anchorName: result.anchor_name,
      avatar: result.avatar,
      isLive: isActuallyLive, // More accurate liveness based on URL presence
      initialError: !isActuallyLive && result.status !== 2 ? (result.title ? `主播 ${result.anchor_name || ''} 未开播。` : '主播未开播。') : null,
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
        initialError: `获取直播信息失败: ${e.message || '未知错误'}` 
    };
  }
}

export async function startDouyinDanmakuListener(
  roomId: string,
  artInstance: Artplayer, // For emitting danmaku to player
  danmakuMessagesRef: Ref<DanmakuMessage[]> // For updating DanmuList
): Promise<() => void> {
  console.log('[DouyinPlayerHelper] Invoking start_douyin_danmu_listener for room:', roomId);
  const rustPayload: RustGetStreamUrlPayload = { 
    args: { room_id_str: roomId }, 
    platform: Platform.DOUYIN, 
  };
  await invoke('start_douyin_danmu_listener', { payload: rustPayload });
  
  const eventName = 'danmaku-message'; // Douyin uses a generic event name
  console.log(`[DouyinPlayerHelper] Setting up event listener for: ${eventName}`);

  const unlisten = await listen<DouyinRustDanmakuPayload>(eventName, (event: TauriEvent<DouyinRustDanmakuPayload>) => {
    if (artInstance && artInstance.plugins.artplayerPluginDanmuku && event.payload) {
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
      console.log('[DouyinPlayerHelper] Danmaku received, but Artplayer or plugin not ready or no payload.');
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