import React, { useState, useRef, useEffect } from 'react';
import SearchResults from '../SearchResults';
import { useTheme } from '../../context/ThemeContext';

interface SearchBarProps {
  onAnchorSelect: (rid: number) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onAnchorSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsLoading(true);
    setShowResults(true);

    try {
      console.log('[搜索] 开始搜索, 关键词:', keyword);
      const data = await window.electron.searchAnchors(keyword);
      console.log('[搜索] 搜索结果:', data);
      
      // 处理搜索结果，只取主播类型的结果
      const anchorList = data.data.relateUser
        .filter((item: any) => item.type === 1)
        .map((item: any) => {
          const anchorInfo = item.anchorInfo;
          return {
            rid: anchorInfo.rid,
            nickname: anchorInfo.nickName,
            avatar: anchorInfo.avatar,
            isLive: anchorInfo.isLive === 1 ? 1 : 0,
            roomName: anchorInfo.description || '',
            fansNumStr: anchorInfo.fansNumStr
          };
        });

      setResults(anchorList);
    } catch (error) {
      console.error('[搜索] 搜索失败:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelect = (rid: number) => {
    onAnchorSelect(rid);
    setShowResults(false);
    setKeyword('');
  };

  return (
    <div ref={searchRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px',
        background: theme.hover,
        borderRadius: '12px',
        border: theme.cardBorder,
        transition: 'all 0.3s ease'
      }}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="搜索主播..."
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            borderRadius: '8px',
            outline: 'none',
            fontSize: '14px',
            backgroundColor: 'transparent',
            color: theme.text
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            background: theme.primaryGradient,
            color: '#fff',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
          }}
        >
          {isLoading ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              搜索
            </>
          )}
        </button>
      </div>

      {showResults && (
        <SearchResults
          results={results}
          onSelect={handleSelect}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default SearchBar; 