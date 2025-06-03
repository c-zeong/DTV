<script setup lang="ts">
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import Artplayer from 'artplayer';
import { onMounted, ref, nextTick } from 'vue';
import vueLogo from './assets/vue.svg';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { platform } from '@tauri-apps/plugin-os';

const artplayerInstance = ref<Artplayer | null>(null);
const playerContainerRef = ref<HTMLElement | null>(null);

// Removed originalPlayerContainerStyle, originalVideoWrapperStyle, 
// originalVideoTagStyle, originalControlsBarStyle, otherElementsOriginalStyles

let isPseudoFullscreen = ref(false); // Changed to ref for reactive tracking

const fullscreenIconSVG = '<svg width="22" height="22" viewBox="0 0 22 22"><path fill-rule="evenodd" d="M1.5 1.5H8V3H3v5H1.5V1.5zM1.5 20.5V14H3v5h5v1.5H1.5zm19-19H14V3h5v5h1.5V1.5zm0 19H14v-1.5h5V14h1.5v6.5z"></path></svg>';

onMounted(async () => { // Make onMounted async to use await
  // OS Detection
  try {
    const osPlatform = platform();
    console.log('Current OS Platform:', osPlatform); // Log the actual platform name for more info
    if (osPlatform === 'macos') {
      console.log('mac');
    } else {
      console.log('other');
    }
    console.log('Current OS Platform:', osPlatform); // Log the actual platform name for more info
  } catch (error) {
    console.error('Failed to detect OS platform:', error);
  }

  if (playerContainerRef.value) {
    try {
      const art = new Artplayer({
        container: playerContainerRef.value as HTMLDivElement,
        url: 'https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
        volume: 0.5,
        isLive: false,
        muted: false,
        autoplay: false,
        pip: true,
        setting: true,
        loop: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: false, // Crucial: Disable Artplayer's own element fullscreen
        fullscreenWeb: true, // Crucial: Enable Artplayer's web fullscreen capability
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: true,
        airplay: true,
        theme: '#23ade5',
        controls: [
          {
            name: 'customCombinedFullscreen', // Updated name for clarity
            position: 'right',
            html: fullscreenIconSVG,
            tooltip: '切换全屏',
            click: () => {
              togglePseudoFullscreen();
            }
          }
        ]
      });
      artplayerInstance.value = art;

      art.on('ready', () => {
        console.log('Artplayer is ready. Attempting to hide default web fullscreen button.');
        const controlsParent = (art.template?.$controlsRight || art.template?.$controls) as HTMLElement | undefined;
        if (controlsParent) {
          const defaultWebFullscreenBtn = controlsParent.querySelector('.art_control_fullscreen_web, .art-control-fullscreenWeb');
          if (defaultWebFullscreenBtn && defaultWebFullscreenBtn instanceof HTMLElement) {
            defaultWebFullscreenBtn.style.display = 'none';
            console.log('Default Artplayer web fullscreen button hidden.');
          } else {
            console.warn('Default Artplayer web fullscreen button not found to hide.');
          }
        } else {
            console.warn('Artplayer controls parent for hiding default button not found.');
        }
      });

      // Intentionally not adding 'fullscreenWeb:enter'/'exit' listeners here to avoid potential type issues for now.

    } catch (error) {
      console.error('Failed to initialize Artplayer:', error);
    }
  } else {
    console.error('Player container ref was not found on mount.');
  }
});

async function togglePseudoFullscreen() {
  if (!artplayerInstance.value) {
    console.warn('Artplayer instance is not available for toggling fullscreen.');
    return;
  }

  if (!isPseudoFullscreen.value) {
    // Enter combined fullscreen
    console.log("Entering combined fullscreen: Triggering Artplayer web fullscreen, then Tauri OS fullscreen.");
    artplayerInstance.value.fullscreenWeb = !artplayerInstance.value.fullscreenWeb;
    await nextTick(); // Allow DOM to update if Artplayer's toggle is async or has side effects
    await WebviewWindow.getCurrent().setFullscreen(true); // Then make the window OS fullscreen
    isPseudoFullscreen.value = true;
    console.log("Combined fullscreen entered. isPseudoFullscreen is now:", isPseudoFullscreen.value);
    if (artplayerInstance.value) {
        console.log("Artplayer.fullscreenWeb property state:", artplayerInstance.value.fullscreenWeb);
    }
  } else {
    // Exit combined fullscreen
    console.log("Exiting combined fullscreen: Exiting Tauri OS fullscreen, then Artplayer web fullscreen.");
    await WebviewWindow.getCurrent().setFullscreen(false); // Exit OS fullscreen first
    await nextTick(); // Allow DOM to update
    artplayerInstance.value.fullscreenWeb = !artplayerInstance.value.fullscreenWeb;
    isPseudoFullscreen.value = false;
    console.log("Combined fullscreen exited. isPseudoFullscreen is now:", isPseudoFullscreen.value);
    if (artplayerInstance.value) {
        console.log("Artplayer.fullscreenWeb property state:", artplayerInstance.value.fullscreenWeb);
    }
  }
}

</script>

<template>
  <div class="container">
    <h1>Welcome to Tauri!</h1>
    <div class="row">
      <a href="https://vitejs.dev" target="_blank">
        <img src="/vite.svg" class="logo vite" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank">
        <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
      </a>
      <a href="https://vuejs.org/" target="_blank">
        <img :src="vueLogo" class="logo vue" alt="Vue logo" />
      </a>
    </div>
    <p>Click on the Tauri, Vite, and Vue logos to learn more.</p>
    <p>
      Recommended IDE setup:
      <a href="https://code.visualstudio.com/" target="_blank">VS Code</a>
      +
      <a href="https://github.com/johnsoncodehk/volar" target="_blank">Volar</a>
      +
      <a href="https://github.com/tauri-apps/tauri-vscode" target="_blank">Tauri</a>
      +
      <a href="https://github.com/rust-lang/rust-analyzer" target="_blank">rust-analyzer</a>
    </p>
    <div ref="playerContainerRef" class="artplayer-app" style="width: 600px; height: 400px; margin: 20px auto;">
      <!-- Artplayer will be initialized here -->
    </div>
  </div>
</template>

<style scoped>
/* Styles for .video-js are not needed if not using Video.js */

.logo.vite:hover {
  filter: drop-shadow(0 0 2em #747bff);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #249b73);
}

.container {
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo.tauri:hover {
  filter: drop-shadow(0 0 2em #ffc131);
}
</style>