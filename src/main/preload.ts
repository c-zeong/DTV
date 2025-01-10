import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electron', {
  getStreamUrl: (roomId: string) => ipcRenderer.invoke('get-stream-url', roomId),
  startDanmaku: (roomId: string) => ipcRenderer.invoke('start-danmaku', roomId),
  stopDanmaku: () => ipcRenderer.invoke('stop-danmaku'),
  onDanmaku: (callback: (danmaku: any) => void) => {
    // 先移除所有已存在的监听器
    ipcRenderer.removeAllListeners('danmaku');
    // 添加新的监听器
    ipcRenderer.on('danmaku', (_, data) => callback(data));
  },
  offDanmaku: (callback: (danmaku: any) => void) => {
    ipcRenderer.removeListener('danmaku', callback);
  },
  searchAnchors: (keyword: string) => ipcRenderer.invoke('search-anchors', keyword),
  getAnchorStatus: (rid: string) => ipcRenderer.invoke('get-anchor-status', rid),
});

// 声明全局类型
declare global {
  interface Window {
    electron: {
      getStreamUrl: (roomId: string) => Promise<string>;
      startDanmaku: (roomId: string) => Promise<void>;
      stopDanmaku: () => Promise<void>;
      onDanmaku: (callback: (danmaku: any) => void) => void;
      offDanmaku: (callback: (danmaku: any) => void) => void;
      searchAnchors: (keyword: string) => Promise<any>;
      getAnchorStatus: (rid: string) => Promise<any>;
    }
  }
} 