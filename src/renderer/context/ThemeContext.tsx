import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  theme: {
    // 背景色
    background: string;
    gradient: string;
    glassEffect: string;
    // 卡片样式
    cardBg: string;
    cardGradient: string;
    cardBorder: string;
    cardShadow: string;
    // 文字颜色
    text: string;
    subText: string;
    highlightText: string;
    // 主题色
    primary: string;
    primaryGradient: string;
    secondary: string;
    // 交互
    hover: string;
    active: string;
    // 特殊效果
    glow: string;
    overlay: string;
    scrollbarTrack: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
  };
}

const themes = {
  light: {
    // 背景色
    background: '#f8fafc',
    gradient: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    glassEffect: 'rgba(255, 255, 255, 0.9)',
    // 卡片样式
    cardBg: '#ffffff',
    cardGradient: 'rgba(255, 255, 255, 0.9)',
    cardBorder: '1px solid #eaeaea',
    cardShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    // 文字颜色
    text: '#000000',
    subText: '#666666',
    highlightText: '#23ade5',
    // 主题色
    primary: '#23ade5',
    primaryGradient: 'linear-gradient(45deg, #23ade5, #2389e5)',
    secondary: '#94a3b8',
    // 交互
    hover: 'rgba(0, 0, 0, 0.03)',
    active: 'rgba(0, 0, 0, 0.05)',
    // 特殊效果
    glow: '0 2px 8px rgba(35, 173, 229, 0.25)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    // 滚动条
    scrollbarTrack: '#f1f1f1',
    scrollbarThumb: '#c1c1c1',
    scrollbarThumbHover: '#a8a8a8'
  },
  dark: {
    // 背景色 - 更柔和的深色
    background: '#202124',
    gradient: 'linear-gradient(180deg, #202124 0%, #27282b 100%)',
    glassEffect: 'rgba(39, 40, 43, 0.95)',

    // 卡片样式 - 稍微亮一点的灰色
    cardBg: '#2e2f33',
    cardGradient: 'rgba(46, 47, 51, 0.95)',
    cardBorder: '1px solid #383a3f',
    cardShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',

    // 文字颜色 - 柔和的灰白色
    text: '#e8e8e9',
    subText: '#a0a0a4',
    highlightText: '#23ade5',

    // 主题色 - 保持原来的蓝色
    primary: '#23ade5',
    primaryGradient: 'linear-gradient(45deg, #23ade5, #2389e5)',
    secondary: '#8f95b2',

    // 交互 - 柔和的hover效果
    hover: 'rgba(255, 255, 255, 0.04)',
    active: 'rgba(255, 255, 255, 0.06)',

    // 特殊效果
    glow: '0 2px 8px rgba(35, 173, 229, 0.25)',
    overlay: 'rgba(0, 0, 0, 0.6)',

    // 滚动条 - 柔和的灰色
    scrollbarTrack: '#2e2f33',
    scrollbarThumb: '#383a3f',
    scrollbarThumbHover: '#404248'
  }
};

const THEME_STORAGE_KEY = 'theme-preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 从本地存储初始化主题状态
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    
    if (savedTheme) {
      // 如果有保存的主题偏好，使用保存的主题
      return savedTheme === 'dark';
    } else {
      // 如果没有保存的主题偏好，使用系统主题
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  });

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有在没有保存的主题偏好时才跟随系统
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    // 保存用户的主题偏好
    localStorage.setItem(THEME_STORAGE_KEY, newTheme ? 'dark' : 'light');
  };

  const theme = isDarkMode ? themes.dark : themes.light;

  return (
    <ThemeContext.Provider value={{ 
      isDarkMode, 
      toggleTheme, 
      theme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 