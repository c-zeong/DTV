<template>
  <div class="cate1-list-container">
    <ul class="cate1-list">
      <li
        v-for="cate1 in cate1List"
        :key="cate1.href" 
        class="cate1-item"
        :class="{ selected: cate1.href === selectedCate1Href }"
        @click="selectCate1(cate1)"
      >
        <span class="cate1-name">{{ cate1.title }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { DouyinCategory1 } from '../types'

defineProps<{
  cate1List: DouyinCategory1[]
  selectedCate1Href: string | null
}>()

const emit = defineEmits<{
  (e: 'select', cate1: DouyinCategory1): void
}>()

const selectCate1 = (cate1: DouyinCategory1) => {
  emit('select', cate1)
}
</script>

<style scoped>
.cate1-list-container {
  padding: 12px 0;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  background: #1f1f23; /* Douyu Night Mode: #1f1f23 */
  flex-shrink: 0;
  /* border-bottom: 1px solid var(--border-color); */ /* Removed border */
}

.cate1-list {
  list-style: none;
  padding: 0 12px;
  margin: 0;
  display: flex;
  gap: 12px;
  flex-wrap: nowrap;
}

.cate1-item {
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  border-radius: 20px;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.1); /* Douyu Night Mode Unselected: rgba(255, 255, 255, 0.1) */
  color: var(--primary-text); /* Keep themed text color, or set to #fff if needed */
}

.cate1-item:hover {
  background: rgba(255, 255, 255, 0.2); /* Douyu Night Mode Hover: rgba(255, 255, 255, 0.2) */
}

.cate1-item.selected {
  background: #ff5d23;
  color: #fff;
  font-weight: bold;
}

.cate1-name {
  display: inline-block;
}
</style> 