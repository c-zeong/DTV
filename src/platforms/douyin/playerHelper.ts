import { invoke } from '@tauri-apps/api/core';
import { listen, type Event as TauriEvent } from '@tauri-apps/api/event';
import Artplayer from 'artplayer';
import { Ref } from 'vue';
import { Platform } from '../common/types';
import type { DanmakuMessage, RustGetStreamUrlPayload } from '../../components/player/types';

// Specific type for Douyin's raw danmaku payload from Rust event
// This was named RustDanmakuPayload in player/index.vue
export interface DouyinRustDanmakuPayload {
  room_id?: string; 
  user: string;      // Nickname from Rust's DanmakuFrontendPayload
  content: string;
  user_level: number; // from Rust's i64
  fans_club_level: number; // from Rust's i32
}

export function getDouyinStreamConfig(directUrl: string | null | undefined): { streamUrl: string, streamType: string } {
  console.log('[DouyinPlayerHelper] getDouyinStreamConfig called with directUrl:', directUrl);
  if (!directUrl) {
    console.error('[DouyinPlayerHelper] Error: directUrl is null or undefined.');
    throw new Error('抖音直播流地址未提供。');
  }
  
  let streamType: string = 'flv'; // Default to FLV
  console.log('[DouyinPlayerHelper] Initial streamType set to:', streamType);

  // Check if the hostname contains 'pull-hls' or if path ends with .m3u8
  try {
    const urlObj = new URL(directUrl);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    console.log(`[DouyinPlayerHelper] Parsed URL: hostname='${hostname}', pathname='${pathname}'`);

    if (hostname.includes('pull-hls') || pathname.toLowerCase().endsWith('.m3u8')) {
      console.warn(`[DouyinPlayerHelper] Condition met for HLS: hostname includes 'pull-hls' (${hostname.includes('pull-hls')}) OR pathname ends with .m3u8 (${pathname.toLowerCase().endsWith('.m3u8')}). Setting streamType to 'hls'.`);
      streamType = 'hls';
    } else {
      console.log(`[DouyinPlayerHelper] Condition for HLS not met. hostname='${hostname}', pathname='${pathname}'. Keeping streamType as 'flv'.`);
      streamType = 'flv'; // Explicitly set for clarity, though it's the default
    }
  } catch (e) {
    console.error('[DouyinPlayerHelper] Failed to parse URL or check hostname/pathname:', directUrl, e);
    // Fallback to FLV if URL parsing or checks fail
    streamType = 'flv';
    console.log('[DouyinPlayerHelper] Error during URL parsing, falling back to streamType:', streamType);
  }
  
  console.log('[DouyinPlayerHelper] Final determined streamConfig:', { streamUrl: directUrl, streamType });
  return { streamUrl: directUrl, streamType };
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