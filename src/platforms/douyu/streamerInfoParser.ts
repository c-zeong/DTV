import { invoke } from '@tauri-apps/api/core';
import type { StreamerDetails, LiveStatus } from '../common/types'; // Import LiveStatus

// This interface should match the DouyuFollowInfo struct returned by Rust
// It's the same as in followListHelper.ts, consider moving to a shared Douyu types file if not already.
interface DouyuRoomInfoFromCommand {
  room_id: string;
  room_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  video_loop?: number | null;
  show_status?: number | null;
  // Include other fields if StreamerDetails needs them, e.g. viewer_count, category_name
  // For now, assuming these are not part of DouyuFollowInfo from Rust.
  // We might need to add them to DouyuFollowInfo in Rust if they are reliably available
  // and needed by StreamerDetails without a second API call.
}

export async function fetchDouyuStreamerDetails(roomId: string): Promise<StreamerDetails> {
  console.log(`[StreamerInfo/douyuParser.ts] Fetching Douyu details for room ${roomId}`);
  try {
    // Now expects the clean DouyuFollowRoomInfo structure from the Rust command
    const roomData = await invoke<DouyuRoomInfoFromCommand>('fetch_douyu_room_info', { roomId });

    if (!roomData) { // Should not happen if invoke succeeds and Rust returns Ok
      console.error('[StreamerInfo/douyuParser.ts] Received null/undefined roomData from invoke for Douyu room:', roomId);
      throw new Error('Failed to retrieve valid room data from backend for Douyu.');
    }
    
    const sStatus = typeof roomData.show_status === 'number' ? roomData.show_status : null;
    const vLoop = typeof roomData.video_loop === 'number' ? roomData.video_loop : null;

    let currentLiveStatus: LiveStatus = 'OFFLINE';
    const isActuallyLive = sStatus === 1; // True if live or looping
    const isCurrentlyLooping = isActuallyLive && vLoop === 1; // Explicitly check for loop

    if (isActuallyLive) {
      if (isCurrentlyLooping) {
        currentLiveStatus = 'REPLAY'; // REPLAY can signify looping for LiveStatus type
      } else {
        currentLiveStatus = 'LIVE';
      }
    } else {
      currentLiveStatus = 'OFFLINE'; // Ensure offline if not sStatus === 1
    }

    // Note: The DouyuFollowInfo struct from Rust currently doesn't include viewerCount or categoryName.
    // If StreamerDetails needs these, fetch_douyu_room_info in Rust must be updated to extract and return them,
    // or another API call specific to StreamerDetails would be needed.
    // For now, they will be undefined or default.

    return {
      roomId: roomData.room_id, // Use room_id from the fetched data
      platform: 'douyu',
      nickname: roomData.nickname ?? 'N/A',
      roomTitle: roomData.room_name ?? 'N/A',
      avatarUrl: roomData.avatar_url ?? null,
      liveStatus: currentLiveStatus,
      isLive: isActuallyLive, // isLive is true if show_status is 1 (live or looping)
      isLooping: isCurrentlyLooping, // new field for explicit loop status
      // viewerCount and categoryName would be undefined if not in DouyuRoomInfoFromCommand
      // and not added to the Rust struct.
      viewerCount: undefined, // Placeholder - needs data source
      categoryName: undefined, // Placeholder - needs data source
    };
  } catch (e: any) {
    console.error(`[StreamerInfo/douyuParser.ts] Error fetching or parsing Douyu details for ${roomId}:`, e);
    // Return a StreamerDetails object with an error message and offline status
    return {
      roomId: roomId,
      platform: 'douyu',
      nickname: '获取失败',
      roomTitle: '信息加载出错',
      avatarUrl: null,
      liveStatus: 'UNKNOWN',
      isLive: false,
      isLooping: false, // Ensure isLooping is present in error case
      errorMessage: typeof e === 'string' ? e : e.message || 'Unknown error loading details',
      viewerCount: 0,
      categoryName: 'N/A',
    };
  }
} 