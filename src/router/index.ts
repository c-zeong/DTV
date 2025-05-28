import { createRouter, createWebHistory } from 'vue-router'
import DouyuHomeView from '../pages/DouyuHomeView.vue' 
import PlayerView from '../pages/PlayerView.vue' 

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'DouyuHome',
      component: DouyuHomeView
    },
    {
      path: '/player/:roomId',
      name: 'player',
      component: PlayerView,
      props: true
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