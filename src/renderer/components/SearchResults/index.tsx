import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface SearchResultsProps {
  results: any[];
  onSelect: (rid: number) => void;
  isLoading: boolean;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect, isLoading }) => {
  const { theme, isDarkMode } = useTheme();

  const baseCardStyle = {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    background: theme.background,
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    border: theme.cardBorder,
    padding: '16px',
    zIndex: 1000,
  };

  // 自定义滚动条样式
  const scrollbarStyle = {
    overflowY: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
  };

  const scrollbarCSS = `
    .search-results::-webkit-scrollbar {
      width: 3px;
      background: transparent;
    }
    .search-results::-webkit-scrollbar-track {
      background: transparent;
      margin: 12px 0;
    }
    .search-results::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      border-radius: 2px;
      transition: all 0.2s ease;
      max-height: 30px;
    }
    .search-results:hover::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    }
  `;

  if (isLoading) {
    return (
      <div style={baseCardStyle}>
        <div style={{ 
          textAlign: 'center', 
          color: theme.subText,
          padding: '20px'
        }}>
          <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={baseCardStyle}>
        <div style={{ 
          textAlign: 'center', 
          color: theme.subText,
          padding: '20px'
        }}>
          未找到相关主播
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{scrollbarCSS}</style>
      <div 
        className="search-results"
        style={{
          ...baseCardStyle,
          maxHeight: '400px',
          padding: '8px',
          ...scrollbarStyle,
        } as const}
      >
        {results.map((result, index) => (
          <div
            key={result.rid}
            onClick={() => onSelect(result.rid)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              borderRadius: '8px',
              marginBottom: index === results.length - 1 ? 0 : '4px',
              backgroundColor: theme.cardBg,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.hover;
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.cardBg;
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <img
              src={result.avatar}
              alt={result.nickname}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `2px solid ${result.isLive ? theme.primary : theme.subText}`,
                flexShrink: 0,
              }}
            />
            
            <div style={{ 
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {result.nickname}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: theme.subText,
                  backgroundColor: theme.hover,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap'
                }}>
                  {result.fansNumStr}粉丝
                </span>
              </div>
              
              {result.roomName && (
                <div style={{
                  fontSize: '13px',
                  color: theme.subText,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {result.roomName}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: result.isLive ? '#10b981' : theme.subText,
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'currentColor'
              }} />
              {result.isLive ? '直播中' : '未开播'}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default SearchResults; 