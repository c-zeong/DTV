import { Platform } from '../common/types'; // Adjusted path
import type { StreamerDetails } from '../common/types'; // Adjusted path

interface DouyinProps {
  roomId: string;
  title?: string | null;
  anchorName?: string | null;
  avatar?: string | null;
}

export function getDouyinStreamerDetails(props: DouyinProps): StreamerDetails {
  console.log(`[StreamerInfo/douyinParser.ts] Using props for Douyin details for room ${props.roomId}`); // Log updated
  
  return {
    roomId: props.roomId,
    platform: 'douyin',
    nickname: props.anchorName || '主播昵称加载中...',
    roomTitle: props.title || '直播间标题加载中...',
    avatarUrl: props.avatar ?? null,
    isLive: false, 
    viewerCount: 0,   
    categoryName: 'N/A',
  };
} 