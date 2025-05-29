// import type { LiveStreamer } from "./types"; // Removed self-import

// Moved from apiService.ts
export type SupportedPlatform = 'douyu' | 'bilibili' | 'douyin'; // Add other platforms as needed

// Common platform types placeholder 

export enum Platform {
  DOUYU = 'DOUYU',
  DOUYIN = 'DOUYIN',
  // Add other platforms here
}

export interface BaseStreamer {
  platform: Platform;
  id: string; // Platform-specific ID, e.g., roomId
  nickname: string;
  avatarUrl: string;
  displayName?: string; // Optional, if different from nickname
}

export interface LiveStreamer extends BaseStreamer {
  roomTitle: string;
  isLive: boolean;
  viewerCount?: number;
  categoryName?: string;
  previewImageUrl?: string; // For live list previews
}

export interface FollowedStreamer extends BaseStreamer {
  roomTitle?: string; // May not always be available or up-to-date for offline followed streamers
  isLive?: boolean;   // Can be updated periodically
  // Add any other specific fields for followed streamers
}

// This can be a union type if details vary significantly between platforms
// or a generic one if they are mostly similar after parsing.
export interface StreamRoomDetails extends LiveStreamer {
  // Add more detailed fields if needed when inside a room
  streamUrl?: string; // If fetched
  danmakuServerInfo?: any; // Platform-specific danmaku details
}

// Common Streamer Details for UI components
export interface StreamerDetails {
  roomId: string; // Always good to have the original ID
  platform: SupportedPlatform; // To know the source
  roomTitle: string;
  nickname: string;
  avatarUrl: string | null; // Changed to allow null
  isLive: boolean;
  isReplay?: boolean; // Optional, as not all platforms might explicitly state this
  categoryName?: string;
  viewerCount?: number;
  // Add any other fields commonly used by UI components
}

export interface CommonDanmakuMessage {
  id?: string; // Optional unique ID for the message for keying in lists
  platform: SupportedPlatform;
  type: 'chat' | 'gift' | 'system' | 'enter' | 'other'; // General categories
  sender: {
    uid?: string;
    nickname: string;
    level?: number | string; // User level
    badgeName?: string;    // Fan badge name
    badgeLevel?: number;   // Fan badge level
    // Add other sender details if common across platforms
  };
  content: string; // The main text of the danmaku
  timestamp?: number; // Optional: when the message was sent/received
  color?: string; // Danmaku text color, if specified
  // Platform-specific raw data can be included if needed for advanced use cases
  rawData?: any; 
}

export interface StreamQuality {
  quality: string; // e.g., 'source', '1080p', '720p'
  description: string; // e.g., '原画', '高清', '标清'
  url: string;
}

export interface StreamPlaybackDetails {
  platform: SupportedPlatform;
  roomId: string;
  primaryUrl: string; // The main URL to play (e.g., highest quality or default)
  format?: 'm3u8' | 'flv' | 'mp4' | 'other'; // Optional: format of the primaryUrl
  qualityOptions?: StreamQuality[]; // Optional: if multiple qualities are available
  // Add other relevant playback info, e.g., headers, drm info if needed later
}

export interface CommonPlatformCategory {
  id: string; // Platform-specific category ID
  name: string;
  platform: SupportedPlatform;
  iconUrl?: string; // Optional icon for the category
  parentId?: string; // Optional, if categories are hierarchical
  // any other common fields like game_type, short_name etc.
}

export interface CommonCategoryGroup {
  groupName: string; // e.g., "热门游戏", "娱乐推荐"
  platform: SupportedPlatform;
  categories: CommonPlatformCategory[];
}

// Added for stream details fetched by platform-specific commands
export interface LiveStreamInfo {
  title?: string | null;
  anchor_name?: string | null; // Douyin uses this
  avatar?: string | null;      // Douyin uses this
  stream_url?: string | null;
  error_message?: string | null;
  // Potentially other platform-specific fields if not covered by StreamRoomDetails
} 