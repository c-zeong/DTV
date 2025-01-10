import React, { useRef, useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface DanmakuListProps {
  danmakuList: any[];
  onCollapsedChange: (collapsed: boolean) => void;
}

const DanmakuList: React.FC<DanmakuListProps> = ({ danmakuList, onCollapsedChange }) => {
  const { theme, isDarkMode } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const scrollToBottom = () => {
      if (contentRef.current) {
        const scrollHeight = contentRef.current.scrollHeight;
        const clientHeight = contentRef.current.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        contentRef.current.scrollTo({
          top: maxScroll,
          behavior: 'smooth'
        });
      }
    };

    requestAnimationFrame(scrollToBottom);
  }, [danmakuList]);

  const scrollbarCSS = `
    .danmaku-list::-webkit-scrollbar {
      width: 3px;
      background: transparent;
    }
    .danmaku-list::-webkit-scrollbar-track {
      background: transparent;
      margin: 12px 0;
    }
    .danmaku-list::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      border-radius: 2px;
      transition: all 0.2s ease;
      max-height: 30px;
    }
    .danmaku-list:hover::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    }
  `;

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange(newCollapsed);
  };

  return (
    <>
      <style>{scrollbarCSS}</style>
      {/* 弹幕列表容器 */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.cardBg,
        height: '100%',
      }}>
        {/* 标题栏 */}
        <div style={{
          height: '60px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: theme.cardBorder,
          backgroundColor: theme.cardBg,
          fontSize: '14px',
          fontWeight: '600',
          color: theme.text,
        }}>
          弹幕列表
        </div>

        {/* 弹幕列表内容 */}
        <div
          ref={contentRef}
          className="danmaku-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            backgroundColor: theme.background,
          }}
        >
          {danmakuList.length === 0 ? (
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>暂无弹幕消息</span>
            </div>
          ) : (
            <div style={{ minHeight: '100%' }}>
              {danmakuList.map((danmaku, index) => (
                <div 
                  key={index} 
                  style={{ 
                    marginBottom: '8px',
                  }}
                >
                  {/* 用户信息行 */}
                  <div style={{
                    background: isDarkMode ? '#242529' : theme.cardGradient,
                    borderRadius: '12px',
                    padding: '8px 12px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isDarkMode 
                      ? '0 2px 6px rgba(0, 0, 0, 0.2)' 
                      : (danmaku.badgeLevel > 0 ? '0 0 10px rgba(59, 130, 246, 0.2)' : 'none'),
                  }}>
                    {/* 用户信息 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}>
                      {/* 用户等级 */}
                      <div style={{
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: theme.subText,
                        flexShrink: 0,
                      }}>
                        Lv.{danmaku.level}
                      </div>

                      {/* 用户昵称 */}
                      <span style={{
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.6)',
                        fontSize: '12px',
                        fontWeight: '600',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {danmaku.nickname}
                      </span>

                      {/* 粉丝牌 */}
                      {danmaku.badgeLevel > 0 && (
                        <div style={{
                          marginLeft: 'auto',
                          background: theme.primaryGradient,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: isDarkMode 
                            ? '0 2px 4px rgba(35, 173, 229, 0.15)' 
                            : '0 2px 4px rgba(59, 130, 246, 0.2)',
                          flexShrink: 0,
                        }}>
                          <span>{danmaku.badgeName}</span>
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            padding: '1px 4px',
                            borderRadius: '3px',
                          }}>{danmaku.badgeLevel}</span>
                        </div>
                      )}
                    </div>

                    {/* 弹幕内容 */}
                    <div style={{
                      position: 'relative',
                      background: isDarkMode ? '#2a2b30' : 'rgba(59, 130, 246, 0.08)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: isDarkMode ? '#e8e8e9' : theme.text,
                      fontWeight: '600',
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '-6px',
                        width: '10px',
                        height: '10px',
                        background: isDarkMode ? '#2a2b30' : 'rgba(59, 130, 246, 0.08)',
                        transform: 'rotate(45deg)',
                      }} />
                      {danmaku.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DanmakuList; 