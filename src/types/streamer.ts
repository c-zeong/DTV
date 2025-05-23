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
  avatar: string | null;  
  liveStatus: boolean;
  fansCount: string | null;  
  category: string | null;  
  description: string | null; 
}

export interface RoomInfo {
  room: {
    room_name: string;
    nickname: string;
    show_status: string;
    videoLoop: string;
    avatar_mid: string;
    cate_name?: string;
    online_num?: string;
  }
}