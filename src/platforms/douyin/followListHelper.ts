import { invoke } from '@tauri-apps/api/core';
import type { FollowedStreamer, LiveStreamInfo } from '../common/types';

export async function refreshDouyinFollowedStreamer(
  streamer: FollowedStreamer
): Promise<Partial<FollowedStreamer>> {
  try {
    // The payload for 'get_douyin_live_stream_url' expects { payload: { args: { room_id_str: string } } }
    const payloadData = { args: { room_id_str: streamer.id } };
    const data = await invoke<LiveStreamInfo>('get_douyin_live_stream_url', {
      payload: payloadData,
    });

    // Check if data is valid and there are no errors from the backend
    if (data && !data.error_message) {
      return {
        isLive: data.status === 2, // Douyin: status 2 means live
        nickname: data.anchor_name || streamer.nickname, // Map anchor_name to nickname
        roomTitle: data.title || streamer.roomTitle,      // Map title to roomTitle
        avatarUrl: data.avatar || streamer.avatarUrl,    // Map avatar to avatarUrl
        // The streamer.id is the original ID used for following and should remain consistent.
        // The 'data' object from get_douyin_live_stream_url might not have a room_id_str that matches the input streamer.id
        // if the input streamer.id is a custom identifier like a username rather than a numerical room_id.
        // We assume streamer.id is the correct persistent identifier for the followed item.
      };
    } else {
      if (data && data.error_message) {
        console.warn(
          `[DouyinFollowHelper] Error fetching Douyin room ${streamer.id}: ${data.error_message}`
        );
      } else {
        console.warn(
          `[DouyinFollowHelper] Received no/invalid data for Douyin room ${streamer.id}`,
          data
        );
      }
      return {}; // Return empty object if data is invalid or error occurred
    }
  } catch (e) {
    console.error(
      `[DouyinFollowHelper] Failed to refresh Douyin streamer ${streamer.id}:`,
      e
    );
    return {}; // Return empty object on error
  }
} 