import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useDanmaku } from './hooks/useDanmaku';
import { useFollowList } from './hooks/useFollowList';
import { useAnchor } from './hooks/useAnchor';
import { ThemeProvider } from './context/ThemeContext';

const App: React.FC = () => {
  const { danmakuList, handleDanmaku, clearDanmaku } = useDanmaku();
  const { followedAnchors, handleFollow, handleFollowListRefresh, handleReorder } = useFollowList();
  const { streamUrl, currentAnchor, handleAnchorSelect } = useAnchor();

  useEffect(() => {
    const refreshFollowList = async () => {
      if (followedAnchors.length > 0) {
        try {
          console.log('[自动刷新] 开始刷新关注列表状态');
          const updatedAnchors = await Promise.all(
            followedAnchors.map(async (anchor) => {
              try {
                const data = await window.electron.getAnchorStatus(anchor.rid.toString());
                const room = data.room || {};
                
                return {
                  ...anchor,
                  nickName: room.nickname || anchor.nickName,
                  avatar: room.avatar_mid || anchor.avatar,
                  isLive: room.show_status === 1 && room.videoLoop !== 1 ? 1 : 0,
                  roomTitle: room.room_name || ''
                };
              } catch (error) {
                console.error(`[自动刷新] 获取主播 ${anchor.rid} 状态失败:`, error);
                return anchor;
              }
            })
          );
          
          handleFollowListRefresh(updatedAnchors);
          console.log('[自动刷新] 关注列表刷新完成');
        } catch (error) {
          console.error('[自动刷新] 刷新关注列表失败:', error);
        }
      }
    };

    refreshFollowList();
  }, []);

  const onAnchorSelect = (rid: number) => {
    handleAnchorSelect(rid, followedAnchors, clearDanmaku);
  };

  return (
    <ThemeProvider>
      <Layout
        streamUrl={streamUrl}
        danmakuList={danmakuList}
        onDanmaku={handleDanmaku}
        onAnchorSelect={onAnchorSelect}
        currentAnchor={currentAnchor}
        followedAnchors={followedAnchors}
        onFollow={() => handleFollow(currentAnchor)}
        onFollowListRefresh={handleFollowListRefresh}
        onFollowListReorder={handleReorder}
      />
    </ThemeProvider>
  );
};

export default App; 