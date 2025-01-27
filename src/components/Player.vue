<template>
  <div class="player-container">
    <div v-if="!roomId" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2"/>
          <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 007 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h3>还没有打开直播间</h3>
      <p>通过搜索或关注列表打开一个直播间开始观看</p>
    </div>
    <StreamerInfo 
      v-else
      :roomId="roomId"
      :isFollowed="isFollowed"
      @follow="$emit('follow', $event)"
      @unfollow="$emit('unfollow', $event)"
    />
    <div class="video-wrapper" :class="{ 'hidden': !roomId }">
      <div ref="playerContainer" class="video-player"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, shallowRef } from 'vue';
import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import StreamerInfo from './StreamerInfo.vue';

// 使用 DanmakuList.vue 中的类型
interface DanmakuMessage {
  nickname: string;
  level: string;
  content: string;
  badgeName?: string;
  badgeLevel?: string;
}

const props = defineProps<{
  roomId: string;
  isFollowed?: boolean;
}>();

const playerContainer = ref<HTMLDivElement | null>(null);
const art = shallowRef<Artplayer | null>(null);
let unlistenDanmaku: (() => void) | null = null;

const destroyPlayer = () => {
  if (art.value) {
    art.value.destroy();
    art.value = null;
  }
};

const initPlayer = async () => {
  try {
    // 获取直播流地址
    const streamUrl = await invoke<string>('get_stream_url', { 
      roomId: props.roomId 
    });

    // 设置代理流地址
    await invoke('set_stream_url', { url: streamUrl });
    
    // 获取本地代理URL
    const proxyUrl = await invoke<string>('start_proxy');

    // 销毁现有播放器
    destroyPlayer();

    // 创建新的播放器
    if (playerContainer.value) {
      art.value = new Artplayer({
        container: playerContainer.value,
        url: proxyUrl,
        isLive: true,
        type: 'flv',
        pip: true,
        customType: {
          flv: function(video: HTMLVideoElement, url: string) {
            import('mpegts.js').then(mpegts => {
              if (!mpegts.isSupported()) {
                return;
              }
              // 媒体源配置
              const mediaDataSource = {
                type: 'flv',
                url: url,
                isLive: true,
                hasAudio: true,
                hasVideo: true,
                cors: true
              };
              
              // 播放器配置
              const config = {
                enableWorker: false,
                lazyLoad: false,
                stashInitialSize: 128,
                autoCleanupSourceBuffer: true,
                fixAudioTimestamp: true,
                accurateSeek: false,
              };

              const player = mpegts.createPlayer(mediaDataSource, config);
              player.attachMediaElement(video);
              player.load();
            });
          }
        },
        plugins: [
          artplayerPluginDanmuku({
            danmuku: [], // 初始弹幕列表为空
            speed: 7, // 弹幕速度
            opacity: 1, // 弹幕透明度
            fontSize: 22, // 字体大小
            color: '#FFFFFF', // 默认颜色
            emitter: false,
            mode: 0, // 0-滚动弹幕，1-顶部弹幕，2-底部弹幕
            margin: [10, '25%'], // 弹幕上下边距
            antiOverlap: true, // 防重叠
            synchronousPlayback: false, // 同步播放
            filter: () => true, // 弹幕过滤
            lockTime: 5, // 弹幕锁定时间
            maxLength: 100, // 最大弹幕数量
            theme: 'light', // 主题色
          }),
        ],
        controls: [
          {
            position: 'left',
            index: 15,
            html: '<svg width="24" height="24" viewBox="-1.5 -2.5 24 24" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin" class="jam jam-refresh"><path fill="currentColor" d="M17.83 4.194l.42-1.377a1 1 0 1 1 1.913.585l-1.17 3.825a1 1 0 0 1-1.248.664l-3.825-1.17a1 1 0 1 1 .585-1.912l1.672.511A7.381 7.381 0 0 0 3.185 6.584l-.26.633a1 1 0 1 1-1.85-.758l.26-.633A9.381 9.381 0 0 1 17.83 4.194zM2.308 14.807l-.327 1.311a1 1 0 1 1-1.94-.484l.967-3.88a1 1 0 0 1 1.265-.716l3.828.954a1 1 0 0 1-.484 1.941l-1.786-.445a7.384 7.384 0 0 0 13.216-1.792 1 1 0 1 1 1.906.608 9.381 9.381 0 0 1-5.38 5.831 9.386 9.386 0 0 1-11.265-3.328z"/></svg>',
            tooltip: '刷新直播流',
            click: function() {
              initPlayer();
            },
          }
        ],
        autoplay: true,
        autoSize: true,
        autoMini: true,
        setting: false,
        playbackRate: false,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: true,
        airplay: false,
        theme: '#23ade5',
        lang: 'zh-cn',
        moreVideoAttr: {
          autoplay: true,
          playsInline: true,
        },
      });

      art.value.on('ready', () => {
      });

      art.value.on('play', () => {
      });

      art.value.on('pause', () => {
      });

      art.value.on('error', (error) => {
        console.error('播放器错误:', error);
      });
    }
  } catch (e) {
    console.error('初始化失败:', e);
  }
};

const setupDanmakuListener = async () => {
  // 清理旧的监听器
  if (unlistenDanmaku) {
    unlistenDanmaku();
    unlistenDanmaku = null;
  }
  
  // 设置新的监听器
  unlistenDanmaku = await listen<DanmakuMessage>('danmaku', (event) => {
    if (art.value) {
      const danmuku = art.value.plugins.artplayerPluginDanmuku;
      danmuku.emit({
        text: event.payload.content,
        color: '#FFFFFF',
        border: false,
        mode: 0,
      });
    }
  });
};

onMounted(async () => {
  if (props.roomId) {
    initPlayer();
    await setupDanmakuListener();
  }
});

watch(() => props.roomId, async (newRoomId) => {
  if (newRoomId) {
    initPlayer();
    await setupDanmakuListener();
  }
});

onUnmounted(() => {
  destroyPlayer();
  if (unlistenDanmaku) {
    unlistenDanmaku();
  }
});
</script>

<style scoped>
.player-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  background: var(--component-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  color: var(--secondary-text);
}

.empty-icon {
  margin-bottom: 16px;
  color: var(--secondary-text);
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--primary-text);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.video-wrapper.hidden {
  display: none;
}

.video-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}
</style>