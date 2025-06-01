import { defineStore } from 'pinia';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'; // Changed import to WebviewWindow

interface ThemeState {
  userPreference: 'light' | 'dark' | 'system';
  currentSystemTheme: 'light' | 'dark';
  // effectiveTheme is not stored as state, but applied directly
}

const STORE_KEY = 'theme_preference';

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    userPreference: 'system', // Default to 'system'
    currentSystemTheme: 'light', // Will be updated
  }),
  actions: {
    async initTheme() {
      // Load user preference from localStorage
      const storedPreference = localStorage.getItem(STORE_KEY);
      if (storedPreference && ['light', 'dark', 'system'].includes(storedPreference)) {
        this.userPreference = storedPreference as ThemeState['userPreference'];
      } else {
        this.userPreference = 'system'; // Default if nothing stored or invalid
      }
      console.log(`[ThemeStore] Initial userPreference: ${this.userPreference}`);

      // Listen to system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.currentSystemTheme = mediaQuery.matches ? 'dark' : 'light';
      console.log(`[ThemeStore] Initial currentSystemTheme: ${this.currentSystemTheme}`);

      mediaQuery.addEventListener('change', (e) => {
        this.currentSystemTheme = e.matches ? 'dark' : 'light';
        console.log(`[ThemeStore] System theme changed to: ${this.currentSystemTheme}`);
        this._applyTheme();
      });

      this._applyTheme();
    },

    setUserPreference(preference: 'light' | 'dark' | 'system') {
      if (this.userPreference === preference) return;
      this.userPreference = preference;
      localStorage.setItem(STORE_KEY, preference);
      console.log(`[ThemeStore] User preference set to: ${this.userPreference}`);
      this._applyTheme();
    },

    async _applyTheme() {
      let themeToApply: 'light' | 'dark';
      if (this.userPreference === 'system') {
        themeToApply = this.currentSystemTheme;
      } else {
        themeToApply = this.userPreference;
      }

      console.log(`[ThemeStore] Applying effective theme: ${themeToApply}`);
      document.documentElement.setAttribute('data-theme', themeToApply);

      try {
        const win = WebviewWindow.getCurrent(); // Using WebviewWindow.getCurrent()
        await win.setTheme(themeToApply);
        console.log(`[ThemeStore] Tauri window theme set to: ${themeToApply}`);
      } catch (error) {
        console.error('[ThemeStore] Error setting Tauri window theme:', error);
      }
    },

    // Getter to easily access the currently active theme in components
    getEffectiveTheme(): 'light' | 'dark' {
      if (this.userPreference === 'system') {
        return this.currentSystemTheme;
      }
      return this.userPreference;
    }
  },
}); 