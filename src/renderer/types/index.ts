export interface AnchorInfo {
  rid: number;
  nickName: string;
  avatar: string;
  isLive: number;
  description?: string;
}

export interface FollowedAnchor {
  rid: number;
  nickName: string;
  avatar: string;
  isLive: number;
  roomTitle?: string;
}

export interface CurrentAnchor {
  rid: number;
  nickName: string;
  avatar: string;
  isLive: number;
  description?: string;
} 