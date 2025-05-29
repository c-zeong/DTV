<template>
  <div class="cate1-list">
    <div 
      v-for="cate1 in cate1List" 
      :key="cate1.cate1Id"
      class="cate1-item"
      :class="{ active: selectedCate1Id === cate1.cate1Id }"
      @click="$emit('select', cate1.cate1Id)"
    >
      <span class="cate1-name">{{ cate1.cate1Name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Category1 } from '../types'

defineProps<{
  cate1List: Category1[]
  selectedCate1Id: number | null
}>()

defineEmits<{
  (e: 'select', cate1Id: number): void
}>()
</script>

<style scoped>
.cate1-list {
  padding: 12px;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  background: #1f1f23;
  flex-shrink: 0;
}

.cate1-item {
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  border-radius: 20px;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.1);
}

.cate1-item:hover {
  background: rgba(255, 255, 255, 0.2);
}

.cate1-item.active {
  background: #ff5d23;
  color: #fff;
}
</style>