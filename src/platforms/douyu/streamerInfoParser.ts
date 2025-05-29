import { invoke } from '@tauri-apps/api/core';
import { Platform } from '../common/types'; // Adjusted path
import type { StreamerDetails } from '../common/types'; // Adjusted path

export async function fetchDouyuStreamerDetails(roomId: string): Promise<StreamerDetails> {
  console.log(`[StreamerInfo/douyuParser.ts] Fetching Douyu details for room ${roomId}`); // Log updated
  try {
    const rawDetails = await invoke<any>('fetch_douyu_room_info', { roomId });
    
    const roomData = rawDetails.data?.room ?? rawDetails.room ?? rawDetails.data ?? rawDetails;

    if (!roomData || Object.keys(roomData).length === 0) {
      console.error('[StreamerInfo/douyuParser.ts] Douyu rawDetails or roomData is empty/undefined:', rawDetails); // Log updated
      throw new Error('Received empty room data from API for Douyu');
    }
    
    const showStatus = Number(roomData.show_status);
    const videoLoop = Number(roomData.videoLoop ?? roomData.video_loop ?? 0);
    const isReallyLive = showStatus === 1 && videoLoop !== 1;

    return {
      roomId: roomId,
      platform: 'douyu',
      nickname: roomData.nickname || 'N/A',
      roomTitle: roomData.room_name || roomData.roomName || 'N/A',
      avatarUrl: roomData.avatar_mid || roomData.avatar || roomData.owner_avatar || null,
      isLive: isReallyLive,
      viewerCount: Number(roomData.hn || roomData.online_num || roomData.onlineNum || 0),
      categoryName: roomData.cate2_name || roomData.cate_name || roomData.game_name || 'N/A',
    };
  } catch (e: any) {
    console.error(`[StreamerInfo/douyuParser.ts] Error fetching or parsing Douyu details for ${roomId}:`, e); // Log updated
    throw new Error(`Failed to load Douyu streamer details: ${e.message || 'Unknown error'}`);
  }
} 