import { invoke } from '@tauri-apps/api/core';
import { listen, type Event as TauriEvent } from '@tauri-apps/api/event';
import Artplayer from 'artplayer';
import { Ref } from 'vue';
import { Platform } from '../common/types';
import type { DanmakuMessage } from '../../components/player/types'; // Corrected path
import { fetchStreamPlaybackDetails } from '../common/apiService';
import { parseDouyuDanmakuMessage } from './parsers'; // <-- Import the parser

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
  const MAX_STREAM_FETCH_ATTEMPTS = 1; // Changed to 1 attempt

  for (let attempt = 1; attempt <= MAX_STREAM_FETCH_ATTEMPTS; attempt++) {
    try {
      const playbackDetails = await fetchStreamPlaybackDetails(roomId, Platform.DOUYU);
      if (playbackDetails && playbackDetails.primaryUrl) {
        finalStreamUrl = playbackDetails.primaryUrl;
        streamType = playbackDetails.format === 'm3u8' ? 'hls' : playbackDetails.format;
        console.log(`[DouyuPlayerHelper] Stream details acquired on attempt ${attempt}:`, { finalStreamUrl, streamType });
        break; 
      } else {
        // This case might be redundant if fetchStreamPlaybackDetails throws an error for empty/null URLs
        throw new Error('斗鱼直播流地址获取为空。');
      }
    } catch (e: any) {
      console.error(`[DouyuPlayerHelper] 获取斗鱼直播流失败 (尝试 ${attempt}/${MAX_STREAM_FETCH_ATTEMPTS}):`, e.message);
      // Check for specific error messages indicating streamer is offline or room doesn't exist
      // These are examples; actual messages from your Rust backend might differ.
      const offlineOrInvalidRoomMessages = [
        "主播未开播", // Generic offline message
        "房间不存在", // Generic room not found
        "error: 1",   // Example: Douyu API error code 1 (often offline or invalid)
        "error: 102", // Example: Douyu API error code 102 (often room not found or offline)
        "error code 1", // More flexible matching for error codes
        "error code 102"
        // Add other known patterns here from your Rust error messages
      ];

      const errorMessageLowerCase = e.message?.toLowerCase() || '';
      const isDefinitivelyOffline = offlineOrInvalidRoomMessages.some(msg => errorMessageLowerCase.includes(msg.toLowerCase()));

      if (isDefinitivelyOffline) {
        console.warn(`[DouyuPlayerHelper] Streamer for room ${roomId} is definitively offline or room is invalid. Aborting retries.`);
        throw e; // Re-throw the specific error to stop retries
      }

      if (attempt === MAX_STREAM_FETCH_ATTEMPTS) {
        throw new Error(`获取斗鱼直播流失败 (尝试 ${MAX_STREAM_FETCH_ATTEMPTS} 次后): ${e.message}`);
      }
      // Exponential backoff might be better, but simple delay for now
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); 
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
    console.log(`[DouyuPlayerHelper] Event received on ${eventName}:`, JSON.stringify(event.payload)); // Log received event payload

    if (artInstance && artInstance.plugins.artplayerPluginDanmuku && event.payload) {
      // const douyuP = event.payload; // Old raw payload
      // let frontendDanmaku: DanmakuMessage | null = null; // Old logic

      // Call the parser, which handles filtering of 'uenter'
      const commonDanmaku = parseDouyuDanmakuMessage(event.payload);
      console.log(`[DouyuPlayerHelper] Parsed commonDanmaku for ${eventName}:`, commonDanmaku ? JSON.stringify(commonDanmaku) : 'null'); // Log parsed danmaku

      if (commonDanmaku) { // Check if the message was not filtered out
        // Adapt CommonDanmakuMessage to the structure ArtPlayer or DanmuList expects, if necessary
        // For now, assuming CommonDanmakuMessage structure is compatible or direct fields are used.
        // The important part is that 'uenter' messages result in commonDanmaku being null.

        artInstance.plugins.artplayerPluginDanmuku.emit({
          text: commonDanmaku.content, // Use content from parsed message
          color: commonDanmaku.color || '#FFFFFF', // Use color from parsed message
          // ArtPlayer might have other fields, ensure commonDanmaku provides them or defaults are fine
        });

        // Push the parsed and validated CommonDanmakuMessage to the list
        // Ensure the DanmuList component is compatible with CommonDanmakuMessage structure
        // or adapt it here. For simplicity, let's assume direct compatibility for critical fields.
        const displayDanmaku: DanmakuMessage = { // Adapting to DanmuList's expected DanmakuMessage type
            nickname: commonDanmaku.sender.nickname,
            content: commonDanmaku.content,
            level: commonDanmaku.sender.level ? String(commonDanmaku.sender.level) : '0',
            badgeName: commonDanmaku.sender.badgeName,
            badgeLevel: commonDanmaku.sender.badgeLevel ? String(commonDanmaku.sender.badgeLevel) : undefined,
            color: commonDanmaku.color,
            uid: commonDanmaku.sender.uid,
            room_id: roomId, // roomId is available in this scope
            // id and timestamp are part of CommonDanmakuMessage but might not be directly used by DanmuList's item display
        };
        danmakuMessagesRef.value.push(displayDanmaku);
        
        if (danmakuMessagesRef.value.length > 200) { // Manage danmaku array size
            danmakuMessagesRef.value.splice(0, danmakuMessagesRef.value.length - 200);
        }
      }
      // If commonDanmaku is null (e.g., 'uenter' type), it's implicitly skipped here.
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