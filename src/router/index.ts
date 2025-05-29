import { createRouter, createWebHistory } from 'vue-router'
import DouyuHomeView from '../pages/DouyuHomeView.vue'
import DouyinHomeView from '../pages/DouyinHomeView.vue'
// import PlayerView from '../pages/PlayerView.vue' // Removed old PlayerView import
import DouyuPlayerView from '../pages/DouyuPlayerView.vue'; // Added
import DouyinPlayerView from '../pages/DouyinPlayerView.vue'; // Added

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'DouyuHome',
      component: DouyuHomeView
    },
    // {
    //   path: '/player/:roomId', // Old generic player route - REMOVED
    //   name: 'player',
    //   component: PlayerView,
    //   props: true
    // },
    {
      path: '/player/douyu/:roomId', // New Douyu specific player route
      name: 'douyuPlayer',
      component: DouyuPlayerView,
      props: true
    },
    {
      path: '/player/douyin/:roomId', // New Douyin specific player route
      name: 'douyinPlayer',
      component: DouyinPlayerView,
      props: true
    },
    {
      path: '/douyin',
      name: 'DouyinHome',
      component: DouyinHomeView
    }
    // Add other routes, e.g., for a generic home, settings, etc.
    // {
    //   path: '/settings',
    //   name: 'settings',
    //   // component: () => import('../pages/SettingsPage.vue') // Example for lazy loading
    // }
  ]
})

export default router