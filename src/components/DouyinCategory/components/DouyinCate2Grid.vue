<template>
  <div class="cate2-container-dy">
    <div
      class="cate2-content-dy"
      :class="{ 'is-expanded': isExpandedInternal, 'scrollable': isExpandedInternal && hasMoreRowsInternal }"
      ref="cate2ContentRef"
    >
      <div class="cate2-scroll-wrapper-dy" :class="{ 'allow-scroll': isExpandedInternal && hasMoreRowsInternal }">
        <div class="cate2-grid-dy" ref="cate2GridRef">
          <div
            v-for="cate2 in cate2List"
            :key="cate2.href" 
            class="cate2-card-dy"
            :class="{ 'active': selectedCate2Href === cate2.href }"
            @click="selectCate2(cate2)"
          >
            <div class="cate2-name-dy" :title="cate2.title">{{ cate2.title }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="shouldShowExpandButtonInternal" class="expand-button-dy" @click="handleToggleInternalExpand">
      <span>{{ isExpandedInternal ? '收起' : '展开' }}</span>
      <svg
        class="expand-icon-dy"
        :class="{ 'is-expanded': isExpandedInternal }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import type { DouyinCategory2 } from '../types'

const props = defineProps<{
  cate2List: DouyinCategory2[]
  selectedCate2Href: string | null
  isExpanded: boolean // Prop from parent (DouyinCategory/index.vue)
  // hasMoreRows: boolean // This will be determined internally now
}>()

const emit = defineEmits<{
  (e: 'select', cate2: DouyinCategory2): void
  (e: 'toggle-expand'): void // To inform parent to update its isExpanded state
  (e: 'height-changed'): void // To inform parent if its layout might need adjustment
}>()

// Constants adapted from Douyu Cate2Grid, adjusted for new styles
const CARD_ACTUAL_HEIGHT = 36; // px, from .cate2-card-dy height
const GRID_VERTICAL_GAP = 12;  // Reverted: px, from .cate2-grid-dy gap
const CONTENT_PADDING_BOTTOM = 8; // px, from .cate2-content-dy padding-bottom
const GRID_INTERNAL_PADDING_BOTTOM = 16; // px, from .cate2-grid-dy padding-bottom

const TARGET_CONTENT_HEIGHT_FOR_ONE_ROW = CARD_ACTUAL_HEIGHT + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;
const TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS = (2 * CARD_ACTUAL_HEIGHT + GRID_VERTICAL_GAP) + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;
const EXPANDED_CONTENT_MAX_ROWS = 7; // Match Douyu
const TARGET_CONTENT_HEIGHT_FOR_EXPANDED_MAX_ROWS = 
    (EXPANDED_CONTENT_MAX_ROWS * CARD_ACTUAL_HEIGHT + (EXPANDED_CONTENT_MAX_ROWS - 1) * GRID_VERTICAL_GAP) 
    + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;

const cate2ContentRef = ref<HTMLElement | null>(null)
const cate2GridRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)
const isExpandedInternal = ref(props.isExpanded) // Internal state mirroring parent's isExpanded
const actualGridScrollHeight = ref(0)
const hasMoreRowsInternal = ref(false)

const refreshHeightNonAnimated = () => {
  if (cate2ContentRef.value) {
    cate2ContentRef.value.style.height = `${getCurrentTargetHeight(isExpandedInternal.value)}px`;
    nextTick(() => emit('height-changed'));
  }
};

const updateActualGridScrollHeightAndMoreRows = () => {
  nextTick(() => {
    if (cate2GridRef.value) {
      actualGridScrollHeight.value = cate2GridRef.value.scrollHeight;
    } else {
      actualGridScrollHeight.value = GRID_INTERNAL_PADDING_BOTTOM;
    }
    hasMoreRowsInternal.value = requiredHeightForAllGridItemsWithPadding.value > TARGET_CONTENT_HEIGHT_FOR_EXPANDED_MAX_ROWS;
    refreshHeightNonAnimated();
  });
};

watch(() => props.cate2List, () => {
  updateActualGridScrollHeightAndMoreRows();
}, { deep: true });

watch(() => props.isExpanded, (newVal) => {
  if (isExpandedInternal.value !== newVal) {
    isExpandedInternal.value = newVal;
    animateHeightChange(newVal);
  }
});

onMounted(() => {
  isExpandedInternal.value = props.isExpanded; // Initialize internal state
  updateActualGridScrollHeightAndMoreRows();
});

const requiredHeightForAllGridItemsWithPadding = computed(() => {
  return actualGridScrollHeight.value + CONTENT_PADDING_BOTTOM;
});

const shouldShowExpandButtonInternal = computed(() => {
  return requiredHeightForAllGridItemsWithPadding.value > TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS;
});

const getCurrentTargetHeight = (expandedState: boolean) => {
  const naturalContentHeight = requiredHeightForAllGridItemsWithPadding.value;
  if (expandedState) {
    if (hasMoreRowsInternal.value) {
      return TARGET_CONTENT_HEIGHT_FOR_EXPANDED_MAX_ROWS;
    }
    return props.cate2List.length > 0 ? naturalContentHeight : GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM; 
  } else {
    if (naturalContentHeight <= TARGET_CONTENT_HEIGHT_FOR_ONE_ROW) {
      return naturalContentHeight;
    }
    return TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS;
  }
};

const animateHeightChange = (targetExpandedState: boolean) => {
  if (!cate2ContentRef.value) return;
  isAnimating.value = true;
  const content = cate2ContentRef.value;
  const targetHeightValue = getCurrentTargetHeight(targetExpandedState);

  // 新增逻辑: 处理从 'auto' 高度收起的情况
  if (!targetExpandedState && content.style.height === 'auto') {
    // 1. 先将 'auto' 替换为当前的实际像素高度
    content.style.height = `${content.scrollHeight}px`;
    
    // 2. 强制浏览器重绘/回流 或 延迟到下一帧
    requestAnimationFrame(() => {
      // 3. 现在将高度设置为最终的收起目标值，这将触发动画
      content.style.height = `${targetHeightValue}px`;
    });
  } else {
    // 对于其他情况（展开，或从固定高度收起），直接设置目标高度
    content.style.height = `${targetHeightValue}px`;
  }

  const onTransitionEnd = () => {
    content.removeEventListener('transitionend', onTransitionEnd);
    isAnimating.value = false;
    if (targetExpandedState && !hasMoreRowsInternal.value && props.cate2List.length > 0) {
        const originalTransition = content.style.transition;
        content.style.transition = 'none';
        content.style.height = 'auto';
        requestAnimationFrame(() => {
            content.style.transition = originalTransition;
        });
    } else if (!targetExpandedState && props.cate2List.length === 0) {
        content.style.height = `${GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM}px`;
    }
    emit('height-changed');
  };
  content.addEventListener('transitionend', onTransitionEnd);
  setTimeout(() => { 
    if (isAnimating.value) {
      onTransitionEnd();
    }
  }, 450); 
};

const handleToggleInternalExpand = () => {
  if (isAnimating.value) return;
  // Emit event for parent to toggle its isExpanded state
  // The actual change and animation will be driven by the watch on props.isExpanded
  emit('toggle-expand'); 
};

const selectCate2 = (cate2: DouyinCategory2) => {
  emit('select', cate2)
  // No auto-collapse here, parent DouyinCategory/index.vue handles that if needed
}

</script>

<style scoped>
/* Styles meticulously adapted from Douyu Cate2Grid.vue */
.cate2-container-dy {
  padding: 16px 0; 
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  overflow: visible; 
  background: #18181b; /* Changed to #18181b as per request */
}

.cate2-content-dy {
  position: relative;
  height: 0; /* Initial height, animated by script */
  padding-bottom: 8px; /* Matches Douyu .cate2-content */
  overflow: hidden;
  transition: height 0.4s cubic-bezier(0.33, 0.66, 0.66, 1);
  will-change: height;
  box-sizing: border-box;
}

/* Animation and scroll handling */
.cate2-content-dy.animating { /* Class might be added by script if needed for specific overrides during animation */
  overflow: hidden !important;
}

.cate2-scroll-wrapper-dy {
  max-height: 100%;
  height: 100%;
  overflow: hidden; /* Default, hidden */
}

/* Expanded state: allow scrolling but hide scrollbar */
.cate2-content-dy.is-expanded.scrollable .cate2-scroll-wrapper-dy.allow-scroll {
  overflow-y: auto !important;
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}

.cate2-content-dy.is-expanded.scrollable .cate2-scroll-wrapper-dy.allow-scroll::-webkit-scrollbar {
  display: none !important;  /* WebKit browsers */
  width: 0 !important;
  height: 0 !important;
}

/* Collapsed state: ensure no scrolling */
.cate2-content-dy:not(.is-expanded) .cate2-scroll-wrapper-dy {
  overflow: hidden !important;
}


.cate2-grid-dy {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 120px)); 
  gap: 12px; 
  justify-content: flex-start; 
  padding-bottom: 16px; 
  padding-left: 16px; 
  padding-right: 16px; 
}

.cate2-card-dy { 
  width: 120px; 
  background: #1f1f23; /* Card background - should stand out against #0A0A0A */
  border-radius: 8px; 
  padding: 6px 8px; 
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex; 
  align-items: center;
  justify-content: center; 
  height: 36px; 
  box-sizing: border-box;
  text-align: center;
  overflow: hidden; 
}

.cate2-card-dy.active {
  background: var(--primary-accent-color, #ff5d23);
  color: var(--primary-accent-text-color, #fff); /* Text color for active card name should also be light */
}

.cate2-card-dy.active .cate2-name-dy {
    color: var(--primary-accent-text-color, #fff);
}

.cate2-card-dy:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1); /* Directly from Douyu .cate2-card:hover:not(.active) */
}

.cate2-name-dy {
  font-size: 14px; 
  color: #f0f0f0; /* Fixed light color for readability on dark #1f1f23 background. Adjust as needed. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2; 
  width: 100%; 
}

.expand-button-dy {
  position: absolute;
  bottom: 0; 
  left: 16px; /* Align with grid content area */
  right: 16px; /* Align with grid content area */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0; 
  cursor: pointer;
  color: var(--secondary-text, rgba(255, 255, 255, 0.5)); 
  transition: color 0.2s ease;
  font-size: 12px; 
  background: #18181b; /* Douyu Night Mode: #18181b */
  z-index: 10;
  border-top: 1px solid var(--border-color-on-dark, rgba(255, 255, 255, 0.1)); /* Border color for dark bg */
  height: 28px; 
  box-sizing: border-box;
}

.expand-button-dy:hover {
  color: var(--primary-text, #fff); /* Themed */
}

.expand-icon-dy {
  margin-left: 4px; /* Douyu */
  transition: transform 0.4s cubic-bezier(0.33, 0.66, 0.66, 1); /* Douyu */
  width: 12px; /* Douyu */
  height: 12px; /* Douyu */
  stroke: currentColor; /* Inherits color from .expand-button-dy */
}

.expand-icon-dy.is-expanded {
  transform: rotate(180deg); /* Douyu */
}
</style> 