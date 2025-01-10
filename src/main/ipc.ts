import { ipcMain } from 'electron';
import { getStreamUrl } from '../services/douyu';
import DouYu from '../services/douyu';
import DanmakuClient from '../services/danmaku';
import fetch from 'node-fetch';
import { Agent as HttpsAgent } from 'https';

// 创建 HTTPS agent，强制使用 IPv4
const agent = new HttpsAgent({
  family: 4,
  keepAlive: true,
  rejectUnauthorized: false
});

let currentDanmakuClient: DanmakuClient | null = null;
let currentSender: Electron.WebContents | null = null;

// 清理函数
export function cleanup() {
  return new Promise<void>((resolve) => {
    if (currentDanmakuClient) {
      currentDanmakuClient.stop();
      currentDanmakuClient = null;
    }
    currentSender = null;
    setTimeout(resolve, 1000);
  });
}

export function setupIPC() {
  // 获取直播流地址
  ipcMain.handle('get-stream-url', async (_, roomId: string) => {
    try {
      return await getStreamUrl(roomId);
    } catch (error) {
      throw error;
    }
  });

  // 修改弹幕启动处理器
  ipcMain.handle('start-danmaku', async (event, roomId: string) => {
    try {
      await cleanup();

      currentDanmakuClient = new DanmakuClient(roomId);
      currentSender = event.sender;
      
      currentDanmakuClient.on('danmaku', (data) => {
        if (currentSender && currentSender === event.sender && !event.sender.isDestroyed()) {
          currentSender.send('danmaku', data);
        }
      });

      await currentDanmakuClient.start();
    } catch (error) {
      await cleanup();
      throw error;
    }
  });

  // 停止弹幕客户端
  ipcMain.handle('stop-danmaku', async () => {
    await cleanup();
  });

  // 添加搜索处理器
  ipcMain.handle('search-anchors', async (event, keyword: string) => {
    try {
      const response = await fetch(
        `https://www.douyu.com/japi/search/api/searchUser?kw=${encodeURIComponent(keyword)}&page=1&pageSize=20&filterType=0`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          agent
        }
      );

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  });

  // 添加获取主播状态的处理器
  ipcMain.handle('get-anchor-status', async (_, rid: string) => {
    try {
      const response = await fetch(`https://www.douyu.com/betard/${rid}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Referer': 'https://www.douyu.com/'
        },
        agent: agent
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  });
} 