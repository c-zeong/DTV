import { useState, useCallback } from 'react';

export function useDanmaku() {
  const [danmakuList, setDanmakuList] = useState<any[]>([]);

  const handleDanmaku = useCallback((danmaku: any) => {
    setDanmakuList(prev => {
      const isDuplicate = prev.some(
        item => 
          item.nickname === danmaku.nickname && 
          item.content === danmaku.content &&
          Math.abs((item.timestamp || 0) - (danmaku.timestamp || Date.now())) < 1000
      );
      
      if (isDuplicate) return prev;
      
      const newDanmaku = { ...danmaku, timestamp: Date.now() };
      return [...prev, newDanmaku].slice(-100);
    });
  }, []);

  const clearDanmaku = useCallback(() => {
    setDanmakuList([]);
  }, []);

  return {
    danmakuList,
    handleDanmaku,
    clearDanmaku
  };
} 