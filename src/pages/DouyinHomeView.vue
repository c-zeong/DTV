<template>
  <div class="douyin-home-view-layout">
    <DouyinCategory 
      @category-selected="onCategorySelected" 
      class="douyin-category-section"
    />
    <DouyinStreamerList 
      :selected-category="currentSelectedCategory" 
      class="douyin-streamer-list-section"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DouyinCategory from '../components/DouyinCategory/index.vue'
import type { DouyinCategorySelectedEvent } from '../components/DouyinCategory/types';
import DouyinStreamerList from '../components/DouyinStreamerList/index.vue';

const currentSelectedCategory = ref<DouyinCategorySelectedEvent | null>(null);

const onCategorySelected = (categoryEvent: DouyinCategorySelectedEvent) => {
  console.log('Douyin category selected in HomeView:', categoryEvent);
  currentSelectedCategory.value = categoryEvent;
}
</script>

<style scoped>
.douyin-home-view-layout {
  display: flex;
  flex-direction: column;
  height: 100%; /* Make sure the layout takes full height */
  overflow: hidden; /* Prevent unintended scrollbars on the layout itself */
}

.douyin-category-section {
  flex-shrink: 0; /* Prevent category section from shrinking */
  /* Add any specific styling for the category section if needed, like a bottom border */
  /* border-bottom: 1px solid var(--border-color, #333); */
}

.douyin-streamer-list-section {
  flex-grow: 1; /* Allow streamer list to take remaining space */
  overflow-y: auto; /* Allow internal scrolling for streamer list if content overflows */
  min-height: 0; /* Important for flex-grow in a flex column */
}
</style> 