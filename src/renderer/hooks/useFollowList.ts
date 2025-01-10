import { useState, useEffect, useCallback } from 'react';
import { FollowedAnchor, CurrentAnchor } from '../types';

const STORAGE_KEY = 'followedAnchors';
const ORDER_KEY = 'followedAnchorsOrder';

export function useFollowList() {
  const [followedAnchors, setFollowedAnchors] = useState<FollowedAnchor[]>(() => {
    // 从本地存储加载关注列表和排序顺序
    const stored = localStorage.getItem(STORAGE_KEY);
    const orderStored = localStorage.getItem(ORDER_KEY);
    const anchors = stored ? JSON.parse(stored) : [];
    const order = orderStored ? JSON.parse(orderStored) : [];
    
    // 如果有排序信息，按照保存的顺序排序
    if (order.length > 0) {
      return anchors.sort((a: FollowedAnchor, b: FollowedAnchor) => {
        const indexA = order.indexOf(a.rid);
        const indexB = order.indexOf(b.rid);
        return indexA - indexB;
      });
    }
    
    return anchors;
  });

  // 保存到本地存储
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(followedAnchors));
    // 保存排序顺序
    const order = followedAnchors.map(anchor => anchor.rid);
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }, [followedAnchors]);

  const handleFollow = useCallback((currentAnchor: CurrentAnchor | null) => {
    if (!currentAnchor) return;

    setFollowedAnchors(prev => {
      const isFollowed = prev.some(anchor => anchor.rid === currentAnchor.rid);
      if (isFollowed) {
        return prev.filter(anchor => anchor.rid !== currentAnchor.rid);
      } else {
        // 新关注的主播添加到列表末尾
        return [...prev, currentAnchor];
      }
    });
  }, []);

  const handleFollowListRefresh = useCallback(async (updatedAnchors: FollowedAnchor[]) => {
    // 先按照直播状态排序
    const sortedByLive = [...updatedAnchors].sort((a, b) => {
      if (a.isLive !== b.isLive) {
        return b.isLive - a.isLive;
      }
      // 如果直播状态相同，保持原有顺序
      const currentOrder = followedAnchors.map(anchor => anchor.rid);
      const indexA = currentOrder.indexOf(a.rid);
      const indexB = currentOrder.indexOf(b.rid);
      return indexA - indexB;
    });
    
    setFollowedAnchors(sortedByLive);
  }, [followedAnchors]);

  const handleReorder = useCallback((startIndex: number, endIndex: number) => {
    setFollowedAnchors(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  return {
    followedAnchors,
    handleFollow,
    handleFollowListRefresh,
    handleReorder
  };
} 