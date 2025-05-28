import { ref, computed, Ref, watch } from 'vue'
import type { Category2 } from '../types'

// 常量定义
// const COLLAPSED_ROWS = 2; // No longer used here, Cate2Grid handles its collapsed row display
const EXPANDED_ROWS = 7   // 展开状态下显示的行数
// const MIN_ITEMS_FOR_EXPAND = 10; // No longer used here, button logic is in Cate2Grid

export function useExpand(sortedCate2List: Ref<Category2[]>) {
  const isExpanded = ref(false)
  
  // 计算是否有足够多的分类，使得展开时可能需要滚动（基于总行数估算）
  const hasMoreRows = computed(() => {
    const estimatedItemsPerRow = 5; // 估计每行平均显示5个 (This is a rough estimate)
    return sortedCate2List.value.length > EXPANDED_ROWS * estimatedItemsPerRow
  })
  
  // 切换展开状态
  const toggleExpand = () => {
    // The button visibility is now handled by Cate2Grid, 
    // so this toggle can always be called if the button is present and clicked.
    isExpanded.value = !isExpanded.value
    console.log('展开状态已切换 (useExpand):', isExpanded.value)
  }
  
  // 重置展开状态为折叠
  const resetExpand = () => {
    isExpanded.value = false
  }
  
  // 监听分类列表变化，如果项目数变得很少，可能不再需要展开状态
  watch(sortedCate2List, (newList) => {
    // If there are very few items (e.g., less than what would fill 2 rows, which is now Cate2Grid's domain to check for button)
    // we might want to force collapse if it was expanded. But Cate2Grid will hide button anyway.
    // For now, just ensure if it's expanded and list becomes empty, it might make sense to collapse, though not strictly necessary.
    // Current logic: if shouldShowExpandButton (which is now in Cate2Grid) becomes false and it is expanded, then collapse.
    // This watch might not be strictly necessary anymore if Cate2Grid handles its display fully.
    // For safety, if it's expanded and there are no items to show, probably collapse.
    if (newList.length === 0 && isExpanded.value) {
      isExpanded.value = false
    }
  })
  
  return {
    isExpanded,
    hasMoreRows,
    // shouldShowExpandButton, // Removed
    toggleExpand,
    resetExpand,
    // COLLAPSED_ROWS, // Removed
    EXPANDED_ROWS
  }
}