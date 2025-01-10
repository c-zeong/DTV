import React, { useRef, useEffect, useCallback, useState } from 'react';
import Artplayer from 'artplayer';
import mpegts from 'mpegts.js';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import { useTheme } from '../../context/ThemeContext';
import DanmakuList from '../DanmakuList/index';

interface PlayerProps {
  url: string;
  onDanmaku: (danmaku: any) => void;
  currentAnchor: {
    rid: number;
    nickName: string;
    avatar: string;
    isLive: number;
    roomTitle?: string;
  } | null;
  onFollow: () => void;
  isFollowed: boolean;
}

// 添加 Artplayer 事件类型定义
type ArtPlayerEvents = 'play' | 'pause' | 'ready' | 'destroy' | 'resize' | 'error' | 'fullscreen' | 'fullscreenWeb';

const Player: React.FC<PlayerProps> = ({ url, onDanmaku, currentAnchor, onFollow, isFollowed }) => {
  const { theme, isDarkMode } = useTheme();
  const playerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const danmakuHandlerRef = useRef<((data: any) => void) | null>(null);
  const [isDanmakuCollapsed, setIsDanmakuCollapsed] = useState(false);
  const [danmakuList, setDanmakuList] = useState<any[]>([]);

  // 修改 effect 来处理播放器大小调整
  useEffect(() => {
    if (artRef.current) {
      // 使用 setTimeout 让过渡动画完成后触发播放器内部的重新计算
      setTimeout(() => {
        // 触发一个 window resize 事件来让播放器自适应
        window.dispatchEvent(new Event('resize'));
      }, 300);
    }
  }, [isDanmakuCollapsed]);

  // 清理函数
  const cleanup = useCallback(() => {
    try {
      // 移除弹幕处理函数
      if (danmakuHandlerRef.current) {
        window.electron.offDanmaku(danmakuHandlerRef.current);
        danmakuHandlerRef.current = null;
      }

      // 清理 mpegts 播放器
      if (mpegtsPlayerRef.current) {
        mpegtsPlayerRef.current.destroy();
        mpegtsPlayerRef.current = null;
      }

      // 清理 artplayer
      if (artRef.current) {
        if (artRef.current.plugins?.artplayerPluginDanmuku) {
          // 清理弹幕插件
          artRef.current.plugins.artplayerPluginDanmuku.queue = [];
        }
        artRef.current.destroy(false);
        artRef.current = null;
      }

      // 清理容器
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
        containerRef.current = null;
      }

      // 清空播放器容器
      if (playerRef.current) {
        playerRef.current.innerHTML = '';
      }
    } catch (error) {
      console.error('清理资源时出错:', error);
    }
  }, []);

  // 修改刷新流的处理函数
  const handleRefreshStream = useCallback(async () => {
    if (!artRef.current || !currentAnchor) return;

    try {
      // 重新获取直播流地址
      const newUrl = await window.electron.getStreamUrl(currentAnchor.rid.toString());
      console.log('[播放器] 获取到新的直播流地址:', newUrl);

      // 如果存在 mpegts 播放器，先销毁它
      if (mpegtsPlayerRef.current) {
        mpegtsPlayerRef.current.destroy();
        mpegtsPlayerRef.current = null;
      }

      // 设置新的 URL 并播放
      artRef.current.url = newUrl;
      artRef.current.play();

      console.log('[播放器] 已切换到新的直播流');
    } catch (error) {
      console.error('[播放器] 刷新直播流失败:', error);
    }
  }, [currentAnchor]);

  // 初始化播放器
  const initPlayer = useCallback(async () => {
    if (!playerRef.current || !url || !currentAnchor) return;

    // 确保先清理
    cleanup();
    await window.electron.stopDanmaku();

    try {
      // 先启动弹幕服务
      await window.electron.startDanmaku(currentAnchor.rid.toString());

      // 创建新的播放器容器
      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '100%';
      containerRef.current = container;
      playerRef.current.appendChild(container);

      const art = new Artplayer({
        container: container,
        url,
        isLive: true,
        volume: 0.5,
        autoSize: true,
        autoMini: true,
        setting: false,
        playbackRate: false,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoplay: true,
        airplay: false,
        theme: '#23ade5',
        pip: true,
        lang: 'zh-cn',
        fullscreen: true,
        fullscreenWeb: true,
        plugins: [
          artplayerPluginDanmuku({
            danmuku: [],
            speed: 7,
            opacity: 1,
            fontSize: 22,
            margin: [10, '25%'],
            antiOverlap: true,
            mode: 0,
            filter: (danmaku: any) => true,
            lockTime: 0,
            maxLength: 100,
            theme: 'light',
            synchronousPlayback: false,
            visible: true,
            emitter: false
          })
        ],
        controls: [
          
          {
            position: 'left',
            html: `<svg fill="#000000" height="20px" width="20px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
              viewBox="0 0 489.698 489.698" xml:space="preserve">
              <g>
                <g>
                  <path d="M468.999,227.774c-11.4,0-20.8,8.3-20.8,19.8c-1,74.9-44.2,142.6-110.3,178.9c-99.6,54.7-216,5.6-260.6-61l62.9,13.1
                    c10.4,2.1,21.8-4.2,23.9-15.6c2.1-10.4-4.2-21.8-15.6-23.9l-123.7-26c-7.2-1.7-26.1,3.5-23.9,22.9l15.6,124.8
                    c1,10.4,9.4,17.7,19.8,17.7c15.5,0,21.8-11.4,20.8-22.9l-7.3-60.9c101.1,121.3,229.4,104.4,306.8,69.3
                    c80.1-42.7,131.1-124.8,132.1-215.4C488.799,237.174,480.399,227.774,468.999,227.774z"/>
                  <path d="M20.599,261.874c11.4,0,20.8-8.3,20.8-19.8c1-74.9,44.2-142.6,110.3-178.9c99.6-54.7,216-5.6,260.6,61l-62.9-13.1
                    c-10.4-2.1-21.8,4.2-23.9,15.6c-2.1,10.4,4.2,21.8,15.6,23.9l123.8,26c7.2,1.7,26.1-3.5,23.9-22.9l-15.6-124.8
                    c-1-10.4-9.4-17.7-19.8-17.7c-15.5,0-21.8,11.4-20.8,22.9l7.2,60.9c-101.1-121.2-229.4-104.4-306.8-69.2
                    c-80.1,42.6-131.1,124.8-132.2,215.3C0.799,252.574,9.199,261.874,20.599,261.874z"/>
                </g>
              </g>
            </svg>`,
            index: 11,
            style: {
              cursor: 'pointer',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
            tooltip: '刷新',
            click: handleRefreshStream,
          },
        ],
        customType: {
          flv: function (video: HTMLVideoElement, url: string) {
            const player = mpegts.createPlayer({
              type: 'flv',
              url: url,
              isLive: true,
              cors: true,
              hasAudio: true,
              hasVideo: true,
            });
            
            mpegtsPlayerRef.current = player;
            player.attachMediaElement(video);
            player.load();

            player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
              console.error('FLV Player Error:', errorType, errorDetail);
              player.unload();
              player.load();
              player.play();
            });

            video.addEventListener('error', () => {
              console.error('Video Error:', video.error);
              player.unload();
              player.load();
              player.play();
            });
          },
        },
      });

      artRef.current = art;

      // 初始化完成后触发一次 resize 事件
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);

      // 设置弹幕处理函数
      const newDanmakuHandler = (danmaku: any) => {
        onDanmaku(danmaku);
        setDanmakuList(prev => [...prev, danmaku]);
        if (artRef.current?.plugins?.artplayerPluginDanmuku) {
          const plugin = artRef.current.plugins.artplayerPluginDanmuku;
          
          const newDanmakuItem = {
            text: danmaku.content,
            color: '#fff',
            border: false,
            mode: 0,
            time: artRef.current.currentTime,
          };

          plugin.emit(newDanmakuItem);
        }
      };

      // 保存新的处理函数引用并注册监听器
      danmakuHandlerRef.current = newDanmakuHandler;
      window.electron.onDanmaku(newDanmakuHandler);
      console.log('[播放器] 已注册弹幕处理函数');

    } catch (error) {
      console.error('[播放器] 初始化失败:', error);
    }
  }, [url, currentAnchor, onDanmaku, cleanup]);

  useEffect(() => {
    initPlayer();
    return cleanup;
  }, [url, currentAnchor, initPlayer, cleanup]);

  if (!currentAnchor) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.cardBg,
        borderRadius: '12px',
        color: theme.subText,
        gap: '16px'
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15.6 11.6L22 7v10l-6.4-4.5v-1zM4 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2z" />
        </svg>
        <div style={{ fontSize: '16px' }}>
          选择一个主播开始观看直播
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      display: 'flex',
      overflow: 'hidden',
      background: theme.cardBg,
      borderRadius: '12px',
    }}>
      {/* 左侧：信息栏和播放器 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        minWidth: 0,
        position: 'relative',
        flex: 1,
      }}>
        {/* 主播信息栏 */}
        <div style={{
          height: '60px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          background: theme.cardBg,
          borderBottom: theme.cardBorder,
          position: 'relative',
        }}>
          {/* 左侧：头像和基本信息 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flex: 1,
          }}>
            {/* 头像容器 */}
            <div style={{
              position: 'relative',
              padding: '2px',
              background: theme.primaryGradient,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img 
                src={currentAnchor.avatar} 
                alt={currentAnchor.nickName}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: `2px solid ${theme.cardBg}`,
                  objectFit: 'cover',
                }}
              />
            </div>

            {/* 主播信息 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flex: 1,
            }}>
              {/* 标题行 */}
              <div style={{
                fontSize: '15px',
                fontWeight: '600',
                color: theme.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>{currentAnchor.roomTitle || '直播间标题未设置'}</span>
                <div style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: `linear-gradient(45deg, ${theme.primary}20, ${theme.primary}40)`,
                  fontSize: '12px',
                  color: theme.primary,
                  fontWeight: '500',
                }}>
                  直播中
                </div>
              </div>

              {/* 主播信息行 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  fontSize: '13px',
                  color: theme.subText,
                  fontWeight: '500',
                }}>
                  {currentAnchor.nickName}
                </span>

                {/* 房间ID卡片 */}
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                  fontSize: '12px',
                  color: theme.subText,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <svg 
                    width="10" 
                    height="10" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    style={{ opacity: 0.5 }}
                  >
                    <path d="M21 8v13H3V8M1 3h22v5H1z" />
                  </svg>
                  <span style={{ opacity: 0.8 }}>
                    {currentAnchor.rid}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 关注按钮 - 移到最右边 */}
          <button
            onClick={onFollow}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: isFollowed 
                ? isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'
                : theme.primaryGradient,
              color: isFollowed ? theme.subText : '#fff',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: isFollowed 
                ? 'none' 
                : '0 2px 6px rgba(0,0,0,0.1)',
              minWidth: '90px',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              if (!isFollowed) {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              if (!isFollowed) {
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
              }
            }}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              {isFollowed ? (
                <path d="M20 6L9 17l-5-5" />
              ) : (
                <path d="M12 4v16m-8-8h16" />
              )}
            </svg>
            {isFollowed ? '已关注' : '关注'}
          </button>
        </div>

        {/* 播放器区域包装器 */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
        }}>
          {/* 播放器容器 */}
          <div 
            ref={playerRef}
            style={{
              flex: 1,
              position: 'relative',
              zIndex: 1,
              width: '100%',
            }}
          />

          {/* 折叠按钮 */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 3,
          }}>
            <button
              onClick={() => setIsDanmakuCollapsed(!isDanmakuCollapsed)}
              style={{
                width: '24px',
                height: '48px',
                borderRadius: '8px 0 0 8px',
                background: isDarkMode 
                  ? 'rgba(0, 0, 0, 0.6)' 
                  : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: isDarkMode ? '#fff' : '#000',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                boxShadow: isDarkMode 
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                opacity: 0.6,
                border: `1px solid ${isDarkMode 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(255, 255, 255, 0.5)'}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{
                  transform: isDanmakuCollapsed ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s ease',
                  opacity: 0.8
                }}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：弹幕列表 */}
      <div style={{
        width: '260px',
        transform: `translateX(${isDanmakuCollapsed ? '100%' : '0'})`,
        transition: 'transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        background: theme.background,
        zIndex: 2,
        flexShrink: 0,
        marginLeft: isDanmakuCollapsed ? '-260px' : 0,
      }}>
        <DanmakuList 
          danmakuList={danmakuList} 
          onCollapsedChange={setIsDanmakuCollapsed}
        />
      </div>
    </div>
  );
};

export default Player; 