import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface DanmakuMessage {
  nickname: string;
  content: string;
  level: string;
  badgeName: string;
  badgeLevel: string;
}

class DanmakuClient extends EventEmitter {
  private roomId: string;
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly heartbeatInterval_ms: number = 45000;
  private readonly wsBaseUrl = 'wss://danmuproxy.douyu.com:';
  private readonly port = 8503;
  private isDestroyed: boolean = false;
  private isConnecting: boolean = false;
  private readonly connectionTimeout_ms: number = 4000;

  constructor(roomId: string) {
    super();
    this.roomId = roomId;
  }

  private encodeMsg(msg: string): Buffer {
    const msgBytes = Buffer.from(msg);
    const packetLen = msgBytes.length + 9;
    
    const header = Buffer.alloc(12);
    header.writeInt32LE(packetLen, 0);
    header.writeInt32LE(packetLen, 4);
    header.writeInt16LE(689, 8);
    header.writeInt8(0, 10);
    header.writeInt8(0, 11);

    return Buffer.concat([header, msgBytes, Buffer.from([0])]);
  }

  private decodeMsg(data: Buffer): Record<string, string> | null {
    try {
      const content = data.slice(12, -1).toString('utf-8');
      const result: Record<string, string> = {};
      
      content.split('/').forEach(item => {
        if (!item) return;
        const [key, value] = item.split('@=');
        if (key && value) {
          result[key] = value.replace(/@S/g, '/').replace(/@A/g, '@');
        }
      });
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private getWsUrl(): string {
    return `${this.wsBaseUrl}${this.port}/`;
  }

  public async start(): Promise<void> {
    if (this.isDestroyed || this.isConnecting) {
      return;
    }

    try {
      const wsUrl = this.getWsUrl();
      this.isConnecting = true;

      this.ws = new WebSocket(wsUrl);
      let timeoutHandle: NodeJS.Timeout | null = null;

      timeoutHandle = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          try {
            this.ws.removeAllListeners();
            this.ws.terminate();
          } catch (error) {
            // 忽略错误
          }
          
          this.ws = null;
          this.isConnecting = false;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              this.start().catch(() => {});
            }, 1000);
          }
        }
      }, this.connectionTimeout_ms);

      this.ws.on('open', () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (this.isDestroyed || !this.ws) return;

        this.isConnecting = false;
        this.reconnectAttempts = 0;

        const loginMsg = `type@=loginreq/roomid@=${this.roomId}/`;
        this.ws.send(this.encodeMsg(loginMsg));

        const joinMsg = `type@=joingroup/rid@=${this.roomId}/gid@=1/`;
        this.ws.send(this.encodeMsg(joinMsg));

        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(() => {
          if (this.isDestroyed || !this.ws) return;
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(this.encodeMsg('type@=mrkl/'));
          }
        }, this.heartbeatInterval_ms);
      });

      this.ws.on('message', (data: Buffer) => {
        if (this.isDestroyed) return;

        const msg = this.decodeMsg(data);
        if (!msg || msg.type !== 'chatmsg') return;

        const danmaku: DanmakuMessage = {
          nickname: msg.nn || 'unknown',
          content: msg.txt || '',
          level: msg.level || '0',
          badgeName: msg.bnn || '',
          badgeLevel: msg.bl || '0'
        };

        this.emit('danmaku', danmaku);
      });

      this.ws.on('close', () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (!this.isDestroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.start().catch(() => {});
          }, 1000);
        }
      });

      this.ws.on('error', (error) => {
        // 不在这里处理错误，让 close 事件处理重连
      });

    } catch (error) {
      this.isConnecting = false;
      if (!this.isDestroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          this.start().catch(() => {});
        }, 1000);
      }
    }
  }

  public stop(): void {
    this.isDestroyed = true;
    this.isConnecting = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.ws) {
      this.ws.removeAllListeners();
      
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.close();
        } catch (error) {
          // 忽略错误
        }
      }
      
      this.ws = null;
    }
    
    this.removeAllListeners();
    this.reconnectAttempts = 0;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.removeAllListeners();
    this.reconnectAttempts = 0;
  }
}

export default DanmakuClient; 