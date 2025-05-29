<template>
  <div class="douyin-live-list-container">
    <div v-if="isLoading && rooms.length === 0" class="loading-initial-state">
      <p>正在加载抖音主播列表 {{ categoryName ? 'for ' + categoryName : '' }}...</p>
    </div>
    <div v-else-if="!isLoading && rooms.length === 0 && categoryHref" class="no-streamers-state">
      <p>分类 {{ categoryName || categoryHref }} 下暂无主播。</p>
    </div>
    <div v-else-if="!categoryHref && !isLoading" class="no-category-state">
       <p>请先选择一个抖音分类。</p>
    </div>

    <div class="live-grid-scroll-area" ref="scrollComponentRef">
      <div class="live-grid-douyin">
        <div 
          v-for="(room, index) in rooms" 
          :key="room.web_rid + '-' + index" 
          class="streamer-card-douyin"
          @click="goToPlayer(room.web_rid)"
        >
          <div class="card-preview-douyin">
            <img :src="room.room_cover || 'https://via.placeholder.com/320x180.png?text=No+Image'" :alt="room.title" class="preview-image-douyin" />
            <span class="viewers-count-overlay-douyin">
              <svg class="viewers-icon-douyin" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              {{ room.viewer_count_str || 'N/A' }} 
            </span>
          </div>
          <div class="card-info-footer-douyin">
            <img :src="room.avatar || 'https://via.placeholder.com/40.png?text=N/A'" :alt="room.nickname" class="streamer-avatar-douyin" />
            <div class="text-details-douyin">
              <h3 class="room-title-douyin" :title="room.title">{{ room.title }}</h3>
              <p class="nickname-douyin" :title="room.nickname">{{ room.nickname || '抖音主播' }}</p>
            </div>
          </div>
        </div>
      </div>
      <div ref="sentinelRef" class="scroll-sentinel"></div>
      <div v-if="isLoadingMore" class="loading-more-indicator">
        <p>正在加载更多抖音主播...</p>
      </div>
       <div v-if="error" class="error-state-message">
        <p>加载失败: {{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDouyinLiveRooms } from './composables/useDouyinLiveRooms';
import type { DouyinCategorySelectedEvent } from '../DouyinCategory/types'; // Corrected path

const props = defineProps<{
  selectedCategory: DouyinCategorySelectedEvent | null;
}>();

const router = useRouter();
const scrollComponentRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);

const categoryHref = computed(() => props.selectedCategory?.cate2Href || null);
const categoryName = computed(() => props.selectedCategory?.cate2Name || null);

// Douyin: Partition is the last part of href after splitting by '_', Type is the second-to-last.
const douyinPartition = computed(() => { 
  console.log('[DouyinStreamerList DEBUG] Recalculating douyinPartition. cate2Href:', props.selectedCategory?.cate2Href);
  if (!props.selectedCategory?.cate2Href) {
    console.log('[DouyinStreamerList DEBUG] douyinPartition: cate2Href is null or empty.');
    return null;
  }
  const parts = props.selectedCategory.cate2Href.split('_');
  console.log('[DouyinStreamerList DEBUG] douyinPartition - parts:', JSON.stringify(parts), 'length:', parts.length);

  if (parts.length >= 1) { // Check if there's at least one part (for the last part)
      const partitionId = parts[parts.length - 1];
      console.log('[DouyinStreamerList DEBUG] douyinPartition: Parsing successful. Returning:', partitionId);
      return partitionId;
  }
  console.warn('[DouyinStreamerList] Failed to parse douyinPartition from href (not enough parts): ', props.selectedCategory.cate2Href);
  return null; 
});

const douyinPartitionType = computed(() => { 
  console.log('[DouyinStreamerList DEBUG] Recalculating douyinPartitionType. cate2Href:', props.selectedCategory?.cate2Href);
  if (!props.selectedCategory?.cate2Href) {
    console.log('[DouyinStreamerList DEBUG] douyinPartitionType: cate2Href is null or empty.');
    return null;
  }
  const parts = props.selectedCategory.cate2Href.split('_');
  console.log('[DouyinStreamerList DEBUG] douyinPartitionType - parts:', JSON.stringify(parts), 'length:', parts.length);

   if (parts.length >= 2) { // Need at least two parts to get second-to-last
      const typeId = parts[parts.length - 2];
      console.log('[DouyinStreamerList DEBUG] douyinPartitionType: Parsing successful. Returning:', typeId);
      return typeId;
  }
  // If not enough parts for type, it might be a top-level category or malformed, but partition might still be valid for some APIs if it's the only ID needed.
  console.warn('[DouyinStreamerList] Failed to parse douyinPartitionType from href (not enough parts for type): ', props.selectedCategory.cate2Href);
  return null; // Explicitly return null if type cannot be determined
});

const { 
  rooms,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  loadInitialRooms,
  loadMoreRooms
} = useDouyinLiveRooms(douyinPartition, douyinPartitionType);

let observer: IntersectionObserver | null = null;

const setupIntersectionObserver = () => {
  if (observer) observer.disconnect();
  const options = { root: scrollComponentRef.value, rootMargin: '0px', threshold: 0.1 };

  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && hasMore.value && !isLoading.value && !isLoadingMore.value) {
      loadMoreRooms();
    }
  }, options);

  if (sentinelRef.value) observer.observe(sentinelRef.value);
};

onMounted(() => {
  nextTick(() => setupIntersectionObserver());
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
});

watch(() => props.selectedCategory, (newCategory, oldCategory) => { 
  console.log('[DouyinStreamerList DEBUG] props.selectedCategory changed.');
  console.log('[DouyinStreamerList DEBUG] Old category:', JSON.stringify(oldCategory));
  console.log('[DouyinStreamerList DEBUG] New category:', JSON.stringify(newCategory));

  if (newCategory && newCategory.cate2Href) {
    console.log('[DouyinStreamerList] Category selected, calling loadInitialRooms. cate2Href:', newCategory.cate2Href);
    console.log('[DouyinStreamerList DEBUG] Computed douyinPartition before load:', douyinPartition.value);
    console.log('[DouyinStreamerList DEBUG] Computed douyinPartitionType before load:', douyinPartitionType.value);
    loadInitialRooms(); 
  } else {
    console.log('[DouyinStreamerList DEBUG] Category deselected or href missing. Clearing rooms.');
    rooms.value = [];
    hasMore.value = false;
    error.value = null;
  }
  nextTick(() => {
    if (scrollComponentRef.value && sentinelRef.value) setupIntersectionObserver();
  });
}, { immediate: true, deep: true });

const goToPlayer = (roomId: string) => {
  if (!roomId) return;
  // Navigate to the new Douyin specific player route
  router.push({ name: 'douyinPlayer', params: { roomId } }); 
};

</script>

<style scoped>
/* Styles adapted from Douyu StreamerList/index.vue - use theme variables */
.douyin-live-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  background-color: var(--component-bg, #18181b);
  overflow: hidden;
}

.loading-initial-state,
.no-streamers-state,
.no-category-state,
.loading-more-indicator,
.error-state-message {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  color: var(--secondary-text, #888);
  font-size: 15px;
  text-align: center;
}
.loading-initial-state, .no-streamers-state, .no-category-state {
    flex-grow: 1; 
}
.loading-more-indicator, .error-state-message {
    min-height: 60px; 
}

.live-grid-scroll-area {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 24px;
  position: relative; 
  scrollbar-width: thin; 
  scrollbar-color: var(--scrollbar-thumb-color, #444) var(--scrollbar-track-color, #18181b);
}

.live-grid-scroll-area::-webkit-scrollbar {
  width: 8px;
}
.live-grid-scroll-area::-webkit-scrollbar-track {
  background: var(--scrollbar-track-color, #18181b);
}
.live-grid-scroll-area::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb-color, #444);
  border-radius: 4px;
  border: 2px solid var(--scrollbar-track-color, #18181b);
}

.live-grid-douyin {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* Douyu style */
  gap: 24px; /* Douyu style */
  width: 100%;
}

.streamer-card-douyin {
  background-color: var(--card-bg, #202023); 
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  cursor: pointer;
  border: 1px solid transparent; 
}

.streamer-card-douyin:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 12px rgba(0,0,0, 0.2);
  border-color: var(--card-border-hover-color, #35353a);
}

.card-preview-douyin {
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: var(--card-preview-bg, #333);
  position: relative;
  overflow: hidden;
}

.preview-image-douyin {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.viewers-count-overlay-douyin {
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
}

.viewers-icon-douyin {
  margin-right: 4px;
}

.card-info-footer-douyin {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--card-footer-bg, var(--card-bg, #202023));
}

.streamer-avatar-douyin {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.text-details-douyin {
  overflow: hidden; /* For text ellipsis */
  flex-grow: 1;
}

.room-title-douyin,
.nickname-douyin {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  color: var(--primary-text, #fff);
}

.room-title-douyin {
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 2px;
  color: var(--primary-text, #e0e0e0);
}

.nickname-douyin {
  font-size: 0.8rem;
  color: var(--secondary-text, #aaa);
}

.scroll-sentinel {
  height: 1px;
  width: 100%;
}
</style> 