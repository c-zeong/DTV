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

export function getDouyinStreamConfig(directUrl: string | null | undefined): { streamUrl: string, streamType: string | undefined } {
  if (!directUrl) {
    throw new Error('抖音直播流地址未提供。');
  }
  let streamType: string | undefined = undefined;
  if (directUrl.includes('.flv')) streamType = 'flv';
  else if (directUrl.includes('.m3u8')) streamType = 'hls';
  else if (directUrl.includes('.mp4')) streamType = 'mp4';
  else console.warn('[DouyinPlayerHelper] Could not determine stream type from URL:', directUrl);
  
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