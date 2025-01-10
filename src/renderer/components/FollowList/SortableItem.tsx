import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTheme } from '../../context/ThemeContext';

interface SortableItemProps {
  id: string;
  anchor: any;
  onSelect: (rid: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, anchor, onSelect }) => {
  const { theme, isDarkMode } = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const handleClick = () => {
    onSelect(anchor.rid);
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : '',
        transition: transition || 'transform 0.2s ease',
        padding: '12px',
        backgroundColor: isDarkMode ? '#242529' : theme.cardBg,
        borderRadius: '12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: theme.cardBorder,
        userSelect: 'none',
        boxShadow: isDarkMode ? '0 2px 6px rgba(0, 0, 0, 0.2)' : theme.cardShadow,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(4px)';
        e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2b30' : theme.hover;
        e.currentTarget.style.boxShadow = isDarkMode 
          ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
          : theme.cardShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.backgroundColor = isDarkMode ? '#242529' : theme.cardBg;
        e.currentTarget.style.boxShadow = isDarkMode 
          ? '0 2px 6px rgba(0, 0, 0, 0.2)' 
          : theme.cardShadow;
      }}
    >
      {/* 主播信息行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* 拖动手柄 */}
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            color: theme.subText,
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            opacity: 0.6,
            marginLeft: '-6px',
            marginRight: '-4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.backgroundColor = theme.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM8 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM8 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0z"/>
          </svg>
        </div>

        <img
          src={anchor.avatar}
          alt={anchor.nickName}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            flexShrink: 0,
            border: `2px solid ${anchor.isLive ? theme.primary : theme.subText}`
          }}
        />
        
        <div style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '15px',
            fontWeight: '600',
            color: theme.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {anchor.nickName}
          </div>
          
          {/* 直播间标题 */}
          {anchor.roomTitle && (
            <div style={{
              fontSize: '13px',
              color: theme.subText,
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {anchor.roomTitle}
            </div>
          )}
        </div>

        {/* 状态指示器固定在右边 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          marginLeft: 'auto'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: anchor.isLive ? '#10b981' : '#94a3b8'
          }} />
        </div>
      </div>
    </div>
  );
};

export default SortableItem; 