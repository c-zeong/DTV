import { invoke } from '@tauri-apps/api/core';
import { listen, type Event as TauriEvent } from '@tauri-apps/api/event';
import Artplayer from 'artplayer';
import { Ref } from 'vue';
import { Platform } from '../common/types';
import type { DanmakuMessage } from '../../components/player/types'; // Corrected path
import { fetchStreamPlaybackDetails } from '../common/apiService';

// Specific type for Douyu's raw danmaku payload from Rust event
export interface DouyuRustDanmakuPayload {
  type: "chatmsg" | "uenter";
  room_id: string;
  nickname: string;
  content: string; // only for chatmsg
  level: string;
  badgeName?: string;
  badgeLevel?: string;
  color?: string;
  uid?: string; // only for uenter
}

export async function getDouyuStreamConfig(roomId: string): Promise<{ streamUrl: string, streamType: string | undefined }> {
  console.log('[DouyuPlayerHelper] Fetching Douyu stream details for roomId:', roomId);
  let finalStreamUrl: string | null = null;
  let streamType: string | undefined = undefined;
  const MAX_STREAM_FETCH_ATTEMPTS = 3; // Consider making this configurable or a constant elsewhere

  for (let attempt = 1; attempt <= MAX_STREAM_FETCH_ATTEMPTS; attempt++) {
    try {
      const playbackDetails = await fetchStreamPlaybackDetails(roomId, Platform.DOUYU);
      if (playbackDetails && playbackDetails.primaryUrl) {
        finalStreamUrl = playbackDetails.primaryUrl;
        streamType = playbackDetails.format === 'm3u8' ? 'hls' : playbackDetails.format;
        break; 
      } else {
        throw new Error('斗鱼直播流地址获取为空。');
      }
    } catch (e: any) {
      console.error(`[DouyuPlayerHelper] 获取斗鱼直播流失败(${attempt}): ${e.message}`);
      if (attempt === MAX_STREAM_FETCH_ATTEMPTS) {
        throw new Error(`获取斗鱼直播流失败 (尝试 ${MAX_STREAM_FETCH_ATTEMPTS} 次后): ${e.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff might be better
    }
  }

  if (!finalStreamUrl) {
    throw new Error('未能获取有效的斗鱼直播流地址。');
  }

  try {
    // Assuming stopProxy is handled separately or before calling this if needed
    await invoke('set_stream_url_cmd', { url: finalStreamUrl });
    const proxyUrl = await invoke<string>('start_proxy');
    console.log('[DouyuPlayerHelper] Douyu Proxy URL:', proxyUrl);
    return { streamUrl: proxyUrl, streamType };
  } catch (e: any) {
    throw new Error(`设置斗鱼代理失败: ${e.message}`);
  }
}

export async function startDouyuDanmakuListener(
  roomId: string,
  artInstance: Artplayer, // For emitting danmaku to player
  danmakuMessagesRef: Ref<DanmakuMessage[]> // For updating DanmuList
): Promise<() => void> {
  console.log('[DouyuPlayerHelper] Invoking start_danmaku_listener for room:', roomId);
  await invoke('start_danmaku_listener', { roomId });
  
  const eventName = `danmaku-${roomId}`;
  console.log(`[DouyuPlayerHelper] Setting up event listener for: ${eventName}`);

  const unlisten = await listen<DouyuRustDanmakuPayload>(eventName, (event: TauriEvent<DouyuRustDanmakuPayload>) => {
    if (artInstance && artInstance.plugins.artplayerPluginDanmuku && event.payload) {
      const douyuP = event.payload;
      let frontendDanmaku: DanmakuMessage | null = null;

      if (douyuP.type === "chatmsg") {
        frontendDanmaku = {
          nickname: douyuP.nickname || '未知用户',
          content: douyuP.content || '',
          level: String(douyuP.level || '0'),
          badgeName: douyuP.badgeName || undefined,
          badgeLevel: douyuP.badgeLevel && douyuP.badgeLevel !== "0" ? String(douyuP.badgeLevel) : undefined,
          color: douyuP.color || '#FFFFFF',
          uid: douyuP.uid,
          room_id: douyuP.room_id,
        };
      } else if (douyuP.type === "uenter") {
        frontendDanmaku = {
          nickname: '系统消息',
          content: `${douyuP.nickname || '用户'} 进入直播间`,
          level: '0',
          color: '#A9A9A9',
          uid: douyuP.uid,
          room_id: douyuP.room_id,
        };
      }

      if (frontendDanmaku) {
        artInstance.plugins.artplayerPluginDanmuku.emit({
          text: frontendDanmaku.content,
          color: frontendDanmaku.color || '#FFFFFF',
        });
        danmakuMessagesRef.value.push(frontendDanmaku);
        if (danmakuMessagesRef.value.length > 200) { // Manage danmaku array size
            danmakuMessagesRef.value.splice(0, danmakuMessagesRef.value.length - 200);
        }
      }
    } else {
      console.log('[DouyuPlayerHelper] Danmaku received, but Artplayer or plugin not ready or no payload.');
    }
  });
  
  console.log(`[DouyuPlayerHelper] Danmaku listener started for ${eventName}.`);
  return unlisten;
}

export async function stopDouyuDanmaku(roomId: string, currentUnlistenFn: (() => void) | null): Promise<void> {
  console.log('[DouyuPlayerHelper] Attempting to stop danmaku for Douyu room:', roomId);
  if (currentUnlistenFn) {
    console.log('[DouyuPlayerHelper] Calling unlistenDanmaku function.');
    currentUnlistenFn();
  }
  try {
    if (roomId) { // Ensure roomId is present
        console.log('[DouyuPlayerHelper] Invoking stop_danmaku_listener for Douyu room:', roomId);
        await invoke('stop_danmaku_listener', { roomId: roomId });
    }
  } catch (error) {
    console.error('[DouyuPlayerHelper] Error invoking stop_danmaku_listener for Douyu:', error);
    // Potentially re-throw or handle as per application's error strategy
  }
}

export async function stopDouyuProxy(): Promise<void> {
  try {
    console.log('[DouyuPlayerHelper] Attempting to stop proxy server.');
    await invoke('stop_proxy');
    console.log('[DouyuPlayerHelper] Proxy server stop command issued.');
  } catch (e) {
    console.error('[DouyuPlayerHelper] Error stopping proxy server:', e);
  }
} 