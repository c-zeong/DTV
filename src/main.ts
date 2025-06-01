import { createApp } from 'vue';
import { createPinia } from 'pinia'; // Import Pinia
import App from './App.vue';
import router from './router';
import { useFollowStore } from './store/followStore'; // Import the store
import { useThemeStore } from './stores/theme'; // Import the theme store

const app = createApp(App);
const pinia = createPinia(); // Create the Pinia instance

app.use(pinia); // Use the Pinia instance
app.use(router);

// Initialize stores that need to load data on startup
const followStore = useFollowStore(); // Get the store instance
try {
  followStore.loadFollowedStreamers(); // Load initial data
  console.log('[main.ts] Follow store initialized and data loaded.');
} catch (error) {
  console.error('[main.ts] Error initializing follow store:', error);
}

// Initialize the theme store
const themeStore = useThemeStore();
try {
  themeStore.initTheme(); // Initialize theme settings
  console.log('[main.ts] Theme store initialized.');
} catch (error) {
  console.error('[main.ts] Error initializing theme store:', error);
}

app.mount('#app');
