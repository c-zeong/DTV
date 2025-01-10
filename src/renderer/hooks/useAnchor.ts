import { useState, useCallback } from 'react';
import { CurrentAnchor, FollowedAnchor } from '../types';

export function useAnchor() {
  const [roomId, setRoomId] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [currentAnchor, setCurrentAnchor] = useState<CurrentAnchor | null>(null);

  const handleAnchorSelect = useCallback(async (
    rid: number, 
    followedAnchors: FollowedAnchor[],
    clearDanmaku: () => void
  ) => {
    const newRoomId = rid.toString();
    
    if (newRoomId !== roomId) {
      clearDanmaku();
    }
    
    setRoomId(newRoomId);
    setStreamUrl('');

    try {
      // 获取主播信息
      const followedAnchor = followedAnchors.find(anchor => anchor.rid === rid);
      
      if (followedAnchor) {
        setCurrentAnchor(followedAnchor);
      } else {
        const data = await window.electron.searchAnchors(newRoomId);
        const anchorInfo = data.data.relateUser
          .find((item: any) => item.type === 1 && item.anchorInfo.rid === rid)
          ?.anchorInfo;

        if (anchorInfo) {
          setCurrentAnchor(anchorInfo);
        }
      }

      // 获取直播流地址
      const url = await window.electron.getStreamUrl(newRoomId);
      setStreamUrl(url || '');

    } catch (error) {
      console.error('获取主播信息或直播流失败:', error);
    }
  }, [roomId]);

  return {
    roomId,
    streamUrl,
    currentAnchor,
    handleAnchorSelect
  };
} 