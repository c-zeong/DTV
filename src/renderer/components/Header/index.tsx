import React from 'react';
import SearchBar from '../SearchBar';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  onAnchorSelect: (rid: number) => void;
}

const Header: React.FC<HeaderProps> = ({ onAnchorSelect }) => {
  const { isDarkMode, toggleTheme, theme } = useTheme();

  return (
    <div style={{
      padding: '12px 24px',
      background: theme.cardGradient,
      borderBottom: theme.cardBorder,
      position: 'relative',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      boxShadow: theme.cardShadow,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    }}>
      <div style={{ width: '280px' }} />

      <div style={{ 
        flex: 1,
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '500px' }}>
          <SearchBar onAnchorSelect={onAnchorSelect} />
        </div>
      </div>

      <div style={{ width: '280px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={toggleTheme}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.hover;
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.text,
            transition: 'all 0.3s ease'
          }}
        >
          {isDarkMode ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default Header; 