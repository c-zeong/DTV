export interface Streamer {
  isLive: boolean;
  roomId: string;
  nickname: string;
  avatarUrl: string;
  roomTitle: string;
}

export interface LiveAnchorItem {
  roomId: string;
  userName: string;
  avatar?: string;
  liveStatus: boolean;
  fansCount?: string;
  category?: string;
  description?: string;
}

export interface RoomInfo {
  room: {
    room_name: string;
    nickname: string;
    show_status: string;
    videoLoop: string;
    avatar_mid: string;
  }
} 