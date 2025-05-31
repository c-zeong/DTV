<template>
  <div v-if="!isLoading && (cate3List.length > 0 || hasAllOption)" class="cate3-list">
    <!-- 全部选项 -->
    <div
      class="cate3-item"
      :class="{ active: selectedCate3Id === null || selectedCate3Id === 'all' }"
      @click="selectAll"
    >
      全部
    </div>
    
    <!-- 其他三级分类 -->
    <div
      v-for="cate3 in cate3List"
      :key="cate3.id"
      class="cate3-item"
      :class="{ active: selectedCate3Id === cate3.id }"
      @click="$emit('select', cate3)"
    >
      {{ cate3.name }}
    </div>
  </div>
  <div v-if="isLoading" class="loading-cate3">正在加载三级分类...</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Category3 } from '../types'

const props = defineProps<{
  cate3List: Category3[]
  selectedCate3Id: string | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', cate3: Category3): void
}>()

// 计算属性：是否显示全部选项
const hasAllOption = computed(() => {
  return props.cate3List && props.cate3List.length > 0
})

// 选择"全部"
const selectAll = () => {
  // 创建一个特殊的"全部"分类对象
  const allCategory: Category3 = {
    id: 'all',
    name: '全部'
  }
  emit('select', allCategory)
}
</script>

<style scoped>
.cate3-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 16px 4px 16px;
  padding-bottom: 4px;
}

.cate3-item {
  padding: 4px 12px;
  background: rgba(31, 31, 35, 0.8);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid transparent;
}

.cate3-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.cate3-item.active {
  background: #ff5d23;
  color: white;
}

.loading-cate3 {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}
</style>