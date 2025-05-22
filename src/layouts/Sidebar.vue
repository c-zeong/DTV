<template>
  <aside class="app-sidebar">
    <nav class="navigation">
      <router-link 
        v-for="item in navItems" 
        :key="item.name"
        :to="item.path" 
        class="nav-item"
        :class="{ 'is-active': $route.path === item.path }"
        @click="() => emit('navigate', item.path)"
      >
        <span class="nav-label">{{ item.name }}</span>
      </router-link>
    </nav>
    
    <FollowList 
      :followedAnchors="sortedFollowedAnchors"
      @selectAnchor="handleSelectAnchor"
      @unfollow="handleUnfollow"
      @reorderList="handleReorderList"
      class="follow-list-component"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Streamer } from '../types/streamer';
import FollowList from '../components/FollowList.vue';

const emit = defineEmits(['selectAnchor', 'unfollow', 'navigate', 'reorderList']);
const router = useRouter();

const navItems = ref([
  { name: '斗鱼直播', path: '/' },
  { name: '抖音直播', path: '/settings' },
]);

const props = withDefaults(defineProps<{
  followedAnchors?: Streamer[];
}>(), {
  followedAnchors: () => []
});

// 保存自定义排序列表
const customSortedAnchors = ref<Streamer[]>([]);

// 按直播状态排序
const sortedFollowedAnchors = computed(() => {
  if (!props.followedAnchors?.length) return [];
  
  // 如果有自定义排序且包含所有当前主播，则使用自定义排序
  if (customSortedAnchors.value.length > 0 && 
      customSortedAnchors.value.length === props.followedAnchors.length &&
      props.followedAnchors.every(anchor => 
        customSortedAnchors.value.some(custom => custom.roomId === anchor.roomId))) {
    return customSortedAnchors.value;
  }
  
  // 否则按直播状态排序（直播中的排在前面）
  return [...props.followedAnchors].sort((a, b) => {
    // 直播中的主播优先显示（降序）
    return (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0);
  });
});

const handleSelectAnchor = (anchor: Streamer) => {
  emit('selectAnchor', anchor);
};

const handleUnfollow = (anchorRoomId: string) => {
  emit('unfollow', anchorRoomId);
};

// 处理列表重新排序
const handleReorderList = (reorderedList: Streamer[]) => {
  customSortedAnchors.value = reorderedList;
  emit('reorderList', reorderedList);
};

defineExpose({ router });
</script>

<style scoped>
.app-sidebar {
  width: 240px;
  background: var(--component-bg);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  padding: 16px 0;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.navigation {
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  margin-bottom: 16px;
  gap: 8px;
  margin-top: 20px;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 16px;
  border-radius: 10px;
  color: var(--secondary-text);
  text-decoration: none;
  transition: all 0.25s ease;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.03);
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: transparent;
  transition: all 0.25s ease;
}

.nav-item:hover {
  background: var(--card-hover-bg);
  color: var(--primary-text);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.nav-item:hover::before {
  background: rgba(80, 130, 255, 0.2);
}

.nav-item.is-active {
  background: rgba(255, 255, 255, 0.05);
  color: #5b84ff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-item.is-active::before {
  background: #5b84ff;
  box-shadow: 0 0 10px rgba(91, 132, 255, 0.5);
}

.follow-list-component {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
    margin-right: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--secondary-text);
  }
}

.app-sidebar {
  color: var(--text-color);
}
</style> 