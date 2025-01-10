import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableItem from './SortableItem';
import { FollowedAnchor } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface FollowListProps {
  anchors: FollowedAnchor[];
  onSelect: (rid: number) => void;
  onRefresh: (updatedAnchors: FollowedAnchor[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}

const FollowList: React.FC<FollowListProps> = ({ anchors, onSelect, onRefresh, onReorder }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, isDarkMode } = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const updatedAnchors = await Promise.all(
        anchors.map(async (anchor) => {
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
            return anchor;
          }
        })
      );

      onRefresh(updatedAnchors);
    } catch (error) {
      // 静默处理错误
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = anchors.findIndex(anchor => anchor.rid.toString() === active.id);
      const newIndex = anchors.findIndex(anchor => anchor.rid.toString() === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const scrollbarCSS = `
    .follow-list::-webkit-scrollbar {
      width: 3px;
      background: transparent;
    }
    .follow-list::-webkit-scrollbar-track {
      background: transparent;
      margin: 12px 0;
    }
    .follow-list::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      border-radius: 2px;
      transition: all 0.2s ease;
      max-height: 30px;
    }
    .follow-list:hover::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    }
  `;

  return (
    <>
      <style>{scrollbarCSS}</style>
      <div style={{
        height: '100%',
        backgroundColor: theme.cardBg,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px',
          fontSize: '14px',
          fontWeight: '600',
          color: theme.text,
          borderBottom: theme.cardBorder,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.cardBg,
          zIndex: 1
        }}>
          <span>关注列表</span>
          {anchors.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: theme.primaryGradient,
                color: '#fff',
                cursor: isRefreshing ? 'wait' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                opacity: isRefreshing ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="12" 
                height="12" 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="none" 
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
              >
                <path d="M21 12a9 9 0 01-9 9" />
                <path d="M3 12a9 9 0 019-9" />
                <path d="M21 12c0-4.97-4.03-9-9-9" />
                <path d="M3 12c0 4.97 4.03 9 9 9" />
              </svg>
              {isRefreshing ? '刷新中...' : '刷新'}
            </button>
          )}
        </div>

        <div 
          className="follow-list"
          style={{ 
            height: 'calc(100vh - 220px)',
            overflowY: 'auto',
            padding: '12px 8px 16px 8px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {anchors.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.subText,
              fontSize: '14px',
              gap: '8px'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>暂无关注主播</span>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={anchors.map(a => a.rid.toString())}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {anchors.map((anchor) => (
                    <SortableItem
                      key={anchor.rid}
                      id={anchor.rid.toString()}
                      anchor={anchor}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </>
  );
};

export default FollowList; 