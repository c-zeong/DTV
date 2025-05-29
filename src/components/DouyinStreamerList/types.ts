export interface DouyinStreamer {
  web_rid: string;        // Room ID, from Douyin demo
  title: string;          // Room title, from Douyin demo
  nickname: string;        // Streamer nickname (hoping it comes from the list API)
  avatar?: string;         // Streamer avatar (hoping it comes from the list API)
  room_cover: string;      // Room thumbnail/preview (hoping it comes from the list API)
  viewer_count_str?: string; // Viewer count as string (e.g., "1.2W在线")
  platform: 'douyin';
  // Add any other fields that the fetch_douyin_partition_rooms command might return
  // For example, from Douyin API responses, we often see user_count or similar for viewers.
  // The actual preview image might be in a field like `cover` or `room_cover`.
}

// Updated to reflect a flat structure based on user feedback
export interface DouyinPartitionRoomsResponse {
  rooms: any[]; // Assuming each item in rooms will be mapped by mapRawRoomToDouyinStreamer
  has_more?: boolean;
  next_offset?: number;
  // If there are other top-level properties from the API like status_code or message, add them here.
  // e.g., status_code?: number;
  // e.g., message?: string;
} 