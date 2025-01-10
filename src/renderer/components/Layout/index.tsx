import React from 'react';
import Header from '../Header';
import Player from '../Player';
import FollowList from '../FollowList';
import { FollowedAnchor } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface LayoutProps {
  streamUrl: string;
  danmakuList: any[];
  onDanmaku: (danmaku: any) => void;
  onAnchorSelect: (rid: number) => void;
  currentAnchor: any;
  followedAnchors: any[];
  onFollow: () => void;
  onFollowListRefresh: (updatedAnchors: FollowedAnchor[]) => void;
  onFollowListReorder: (startIndex: number, endIndex: number) => void;
}

const Layout: React.FC<LayoutProps> = ({
  streamUrl,
  danmakuList,
  onDanmaku,
  onAnchorSelect,
  currentAnchor,
  followedAnchors,
  onFollow,
  onFollowListRefresh,
  onFollowListReorder
}) => {
  const { theme } = useTheme();
  const isFollowed = currentAnchor 
    ? followedAnchors.some(anchor => anchor.rid === currentAnchor.rid)
    : false;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.background,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: 0,
      padding: 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      <Header onAnchorSelect={onAnchorSelect} />
      
      <main style={{
        flex: 1,
        padding: '16px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '16px',
        overflow: 'hidden',
        height: 'calc(100vh - 60px)',
        boxSizing: 'border-box',
        background: theme.gradient
      }}>
        <div style={{ 
          width: '280px',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: theme.cardShadow,
        }}>
          <FollowList 
            anchors={followedAnchors}
            onSelect={onAnchorSelect}
            onRefresh={onFollowListRefresh}
            onReorder={onFollowListReorder}
          />
        </div>

        <div style={{ 
          width: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: theme.cardShadow,
        }}>
          <Player 
            url={streamUrl} 
            onDanmaku={onDanmaku}
            currentAnchor={currentAnchor}
            onFollow={onFollow}
            isFollowed={isFollowed}
          />
        </div>
      </main>
    </div>
  );
};

export default Layout; 