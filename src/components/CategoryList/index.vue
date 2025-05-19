<template>
  <div class="category-list" :class="{ 'is-expanded': isExpanded }" ref="categoryListRootRef">
    <!-- 加载状态显示 -->
    <div v-if="isLoading && !hasError" class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载分类数据...</div>
    </div>
    
    <!-- 正常显示分类内容 -->
    <template v-if="!isLoading && cate1List.length > 0">
      <Cate1List
        :cate1-list="cate1List"
        :selected-cate1-id="selectedCate1Id"
        @select="selectCate1"
      />
      <Cate2Grid
        v-if="sortedCate2List.length > 0"
        :cate2-list="sortedCate2List"
        :selected-cate2-id="selectedCate2Id"
        :is-expanded="isExpanded"
        :has-more-rows="hasMoreRows"
        @select="handleCate2Click"
        @toggle-expand="toggleExpand"
        @height-changed="handleCate2HeightChanged"
      />
      <Cate3List
        v-if="currentCate3List.length > 0"
        :cate3-list="currentCate3List"
        :selected-cate3-id="selectedCate3Id"
        :is-loading="isLoadingCate3"
        @select="handleCate3Click"
      />
    </template>
    
    <!-- 错误状态显示 -->
    <div v-if="hasError" class="error-state">
      <div class="error-message">加载分类失败，请重试</div>
      <button @click="reloadCategories" class="reload-btn">重新加载</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, nextTick, ref, defineExpose, onBeforeUnmount } from 'vue'
import Cate1List from './components/Cate1List.vue'
import Cate2Grid from './components/Cate2Grid.vue'
import Cate3List from './components/Cate3List.vue'
import { useCategories } from './composables/useCategories'
import { useSelection } from './composables/useSelection'
import { useExpand } from './composables/useExpand'
import type { CategorySelectedEvent } from './types'

const emit = defineEmits<{
  (e: 'category-selected', category: CategorySelectedEvent): void
  (e: 'expanded-state-changed', isExpanded: boolean): void
  (e: 'category-section-height-settled'): void
}>()

const categoryListRootRef = ref<HTMLElement | null>(null)

const hasError = ref(false)
const isLoading = ref(true)

const {
  selectedCate1Id,
  selectedCate2Id,
  selectedCate3Id,
  selectCate1,
  handleCate2Click,
  handleCate3Click,
  resetSelection
} = useSelection(emit)

const {
  cate1List,
  cate2List,
  isLoadingCate3,
  fetchCategories,
  fetchThreeCate,
  sortedCate2List,
  currentCate3List
} = useCategories(selectedCate1Id, selectedCate2Id)

const {
  isExpanded,
  hasMoreRows,
  toggleExpand,
  resetExpand
} = useExpand(sortedCate2List)

// 监听isExpanded变化
watch(isExpanded, (newVal) => {
  console.log('展开状态变化 (CategoryList):', newVal)
  emit('expanded-state-changed', newVal)
})

// 设置动画事件监听器 - 在组件挂载时添加
onMounted(() => {
  // 监听分类区域展开和折叠的状态变化事件
  const handleExpanding = () => console.log('分类区域正在展开')
  const handleCollapsing = () => console.log('分类区域正在折叠')
  
  const handleExpanded = () => {
    console.log('分类区域已完全展开')
    nextTick(() => {
      const event = new CustomEvent('category-height-change')
      window.dispatchEvent(event)
    })
  }
  
  const handleCollapsed = () => {
    console.log('分类区域已完全折叠')
    nextTick(() => {
      const event = new CustomEvent('category-height-change')
      window.dispatchEvent(event)
    })
  }
  
  // 添加事件监听
  window.addEventListener('category-expanding', handleExpanding)
  window.addEventListener('category-collapsing', handleCollapsing)
  window.addEventListener('category-expanded', handleExpanded)
  window.addEventListener('category-collapsed', handleCollapsed)
  
  // 在组件卸载时清理事件监听器
  onBeforeUnmount(() => {
    window.removeEventListener('category-expanding', handleExpanding)
    window.removeEventListener('category-collapsing', handleCollapsing)
    window.removeEventListener('category-expanded', handleExpanded)
    window.removeEventListener('category-collapsed', handleCollapsed)
  })

  categoryListRootRef.value?.addEventListener('transitionend', onCategoryListTransitionEnd)
  loadCategories()

  // 如果一段时间后仍未选择分类，强制选择第一个
  setTimeout(() => {
    if (cate1List.value.length > 0 && selectedCate1Id.value === null) {
      selectCate1(cate1List.value[0].cate1Id)
    }
    
    if (sortedCate2List.value.length > 0 && selectedCate2Id.value === null) {
      handleCate2Click(sortedCate2List.value[0])
    }
  }, 1000)
  
  // 如果长时间未加载完成，认为出错
  setTimeout(() => {
    if (isLoading.value) {
      isLoading.value = false
      hasError.value = true
      console.error('加载分类超时')
    }
  }, 5000)
})

onBeforeUnmount(() => {
  categoryListRootRef.value?.removeEventListener('transitionend', onCategoryListTransitionEnd)
})

// 监听分类数据变化
watch(cate1List, (newList) => {
  if (newList.length > 0 && isLoading.value) {
    console.log('一级分类数据已更新, isLoading is now managed by loadCategories finally block.');
  }
}, { deep: true })

// 初始加载分类数据
const loadCategories = async () => {
  isLoading.value = true
  hasError.value = false
  resetSelection()
  
  try {
    console.log('CategoryList: 开始获取分类数据')
    await fetchCategories()
    console.log('CategoryList: 分类数据获取完成, 一级分类数量:', cate1List.value.length, '二级分类数量:', cate2List.value.length)
    
    // 检查是否成功加载了分类数据
    if (cate1List.value.length === 0) {
      console.error('CategoryList: 未加载到分类数据')
      hasError.value = true
      return
    }
    
    // 加载成功，停止加载状态
    isLoading.value = false
    
    // 如果有一级分类但没有选择，选择第一个
    if (cate1List.value.length > 0 && selectedCate1Id.value === null) {
      console.log('CategoryList: 自动选择第一个一级分类:', cate1List.value[0].cate1Id)
      await nextTick()
      selectCate1(cate1List.value[0].cate1Id)
    }

    // After initial load, emit height settled for HomeView to get initial position
    nextTick(() => {
      if(categoryListRootRef.value) emit('category-section-height-settled')
    })
  } catch (error) {
    console.error('CategoryList: 获取分类数据时出错:', error)
    hasError.value = true
    isLoading.value = false
  }
}

// 重新加载分类
const reloadCategories = () => {
  loadCategories()
}

// 当sortedCate2List更新且有内容，但没有选中二级分类时，自动选择第一个
watch(sortedCate2List, (newList) => {
  console.log('CategoryList: 排序后的二级分类列表:', newList)
  // 自动选择第一个二级分类（如果有且尚未选择）
  if (newList.length > 0 && selectedCate2Id.value === null) {
    nextTick(() => {
      console.log('CategoryList: 自动选择第一个二级分类:', newList[0].cate2Id)
      handleCate2Click(newList[0])
    })
  }
})

// 当选中二级分类时，获取对应的三级分类
watch(selectedCate2Id, (newVal) => {
  console.log('CategoryList: 选中的二级分类ID变更为:', newVal)
  if (newVal) {
    fetchThreeCate(newVal)
  }
})

const handleCate2HeightChanged = () => {
  // This event from Cate2Grid means its internal structure changed.
  // We don't immediately tell HomeView. We wait for CategoryList's own transition (if any) to finish.
  // If CategoryList is not animating (e.g. initial load, or Cate2Grid changed height without CategoryList expand/collapse change),
  // we might need to tell HomeView to update. This is now handled by the transitionend on categoryListRootRef.
  console.log('Cate2Grid height changed.')
}

const onCategoryListTransitionEnd = () => {
  console.log('CategoryList root transitionend.')
  emit('category-section-height-settled')
}

// 导出一些方法供父组件使用
defineExpose({
  toggleExpand,
  isExpanded,
  hasMoreRows,
  reloadCategories
})
</script>

<style scoped>
.category-list {
  display: flex;
  flex-direction: column;
  background: #18181b;
  color: #fff;
  max-height: 280px;
  min-height: 200px;
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.33, 0.66, 0.66, 1);
  width: 100%;
}

.category-list.is-expanded {
  max-height: 500px;
}

.loading-state {
  padding: 40px 20px;
  text-align: center;
  color: #aaa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #ff5d23;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

.loading-text {
  font-size: 14px;
  color: rgba(255,255,255,0.7);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  padding: 40px 20px;
  text-align: center;
  color: #ff5d23;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.error-message {
  margin-bottom: 15px;
}

.reload-btn {
  padding: 6px 16px;
  background: #ff5d23;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.reload-btn:hover {
  background: #ff7d43;
}

/* 添加新的样式来控制展开/折叠动画 */
.cate2-content {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.cate2-content.is-expanded {
  transform: translateY(0);
}

.cate2-content:not(.is-expanded) {
  transform: translateY(0);
}

/* 确保内容在动画过程中保持可见 */
.cate2-content.animating {
  overflow: hidden;
  will-change: transform, height;
}
</style>