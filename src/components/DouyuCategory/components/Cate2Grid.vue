<template>
  <div class="cate2-container">
    <div
      class="cate2-content"
      :class="{ 'is-expanded': isExpanded, 'scrollable': isExpanded && hasMoreRows }"
      ref="cate2ContentRef"
    >
      <div class="cate2-scroll-wrapper" :class="{ 'allow-scroll': isExpanded && hasMoreRows }">
        <div class="cate2-grid" ref="cate2GridRef">
          <div
            v-for="cate2 in cate2List"
            :key="cate2.cate2Id"
            class="cate2-card"
            :class="{ 'active': selectedCate2Id === cate2.cate2Id }"
            @click="$emit('select', cate2)"
          >
            <div class="cate2-icon">
              <img :src="cate2.icon" :alt="cate2.cate2Name">
            </div>
            <div class="cate2-info">
              <div class="cate2-name" :title="cate2.cate2Name">{{ formatCategoryName(cate2.cate2Name) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="shouldShowExpandButtonComputed" class="expand-button" @click="handleToggleExpand">
      <span>{{ isExpanded ? '收起' : '展开' }}</span>
      <svg
        class="expand-icon"
        :class="{ 'is-expanded': isExpanded }"
        width="16"
        height="16"
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
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import type { Category2 } from '../types'

const props = defineProps<{
  cate2List: Category2[]
  selectedCate2Id: number | null
  isExpanded: boolean
  hasMoreRows: boolean
}>()

const emit = defineEmits<{
  (e: 'select', cate2: Category2): void
  (e: 'toggle-expand'): void
  (e: 'height-changed'): void
}>()

// Constants for height calculation
const CARD_ACTUAL_HEIGHT = 36; // px, height of a .cate2-card
const GRID_VERTICAL_GAP = 12;  // px, gap between cards in the grid
const CONTENT_PADDING_BOTTOM = 8; // px, padding-bottom of .cate2-content
const GRID_INTERNAL_PADDING_BOTTOM = 16; // px, padding-bottom of .cate2-grid itself

const TARGET_CONTENT_HEIGHT_FOR_ONE_ROW = CARD_ACTUAL_HEIGHT + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;
const TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS = (2 * CARD_ACTUAL_HEIGHT + GRID_VERTICAL_GAP) + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;
const EXPANDED_CONTENT_MAX_ROWS = 7;
const TARGET_CONTENT_HEIGHT_FOR_EXPANDED_MAX_ROWS = (EXPANDED_CONTENT_MAX_ROWS * CARD_ACTUAL_HEIGHT + (EXPANDED_CONTENT_MAX_ROWS - 1) * GRID_VERTICAL_GAP) + GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;

const cate2ContentRef = ref<HTMLElement | null>(null)
const cate2GridRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)

const actualGridScrollHeight = ref(0)

// New function to apply height without animation, typically after content change
const refreshHeightNonAnimated = () => {
  if (cate2ContentRef.value) {
    cate2ContentRef.value.style.height = `${getCurrentTargetHeight(props.isExpanded)}px`;
    nextTick(() => emit('height-changed'));
  }
};

const updateActualGridScrollHeight = () => {
  nextTick(() => {
    if (cate2GridRef.value) {
      actualGridScrollHeight.value = cate2GridRef.value.scrollHeight;
    } else {
      actualGridScrollHeight.value = GRID_INTERNAL_PADDING_BOTTOM;
    }
    refreshHeightNonAnimated();
  });
};

watch(() => props.cate2List, () => {
  updateActualGridScrollHeight();
}, { deep: true });

onMounted(() => {
  updateActualGridScrollHeight();
});

const requiredHeightForAllGridItemsWithPadding = computed(() => {
  return actualGridScrollHeight.value + CONTENT_PADDING_BOTTOM;
});

const shouldShowExpandButtonComputed = computed(() => {
  return requiredHeightForAllGridItemsWithPadding.value > TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS;
});

const getCurrentTargetHeight = (expandedState: boolean) => {
  const naturalContentHeight = requiredHeightForAllGridItemsWithPadding.value;
  if (expandedState) {
    if (props.hasMoreRows) {
      return TARGET_CONTENT_HEIGHT_FOR_EXPANDED_MAX_ROWS;
    }
    // If not hasMoreRows (content is <= EXPANDED_ROWS), show all of it.
    // Ensure naturalContentHeight is at least a minimal value if list becomes empty while expanded.
    return props.cate2List.length > 0 ? naturalContentHeight : GRID_INTERNAL_PADDING_BOTTOM + CONTENT_PADDING_BOTTOM;
  } else {
    // Collapsing
    // If naturalContentHeight (all items + padding) fits in one row's allowance or less.
    if (naturalContentHeight <= TARGET_CONTENT_HEIGHT_FOR_ONE_ROW) {
      return naturalContentHeight;
    }
    // Otherwise, if content needs more than one row, collapse to two rows.
    return TARGET_CONTENT_HEIGHT_FOR_TWO_ROWS;
  }
};

watch(() => props.isExpanded, (newValue, _oldValue) => {
  if (isAnimating.value && newValue === props.isExpanded) {
    return;
  }
  animateHeightChange(newValue);
});

const animateHeightChange = (targetExpandedState: boolean) => {
  if (!cate2ContentRef.value) return;
  isAnimating.value = true;
  const content = cate2ContentRef.value;
  const targetHeightValue = getCurrentTargetHeight(targetExpandedState);

  // Handle collapsing from 'auto' height (if it was set)
  if (!targetExpandedState && content.style.height === 'auto') {
    content.style.height = `${content.scrollHeight}px`;
    requestAnimationFrame(() => {
      content.style.height = `${targetHeightValue}px`;
    });
  } else {
    content.style.height = `${targetHeightValue}px`;
  }

  const onTransitionEnd = () => {
    content.removeEventListener('transitionend', onTransitionEnd);
    isAnimating.value = false;
    if (targetExpandedState && !props.hasMoreRows && props.cate2List.length > 0) {
        const originalTransition = content.style.transition;
        content.style.transition = 'none';
        content.style.height = 'auto';
        requestAnimationFrame(() => {
            content.style.transition = originalTransition;
        });
    } else if (!targetExpandedState && props.cate2List.length === 0) {
        // Use the same minimal height as in Douyin for consistency when empty and collapsed
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

const handleToggleExpand = () => {
  if (isAnimating.value) return;
  // The actual props.isExpanded will be toggled by the parent via useExpand, which then triggers the watch
  // This component just signals the intent to toggle
  emit('toggle-expand');
  // The animation will be triggered by the watch on props.isExpanded when the parent updates it.
};

// formatCategoryName function remains the same
const formatCategoryName = (name: string) => {
  if (!name) return '';
  
  // 统计字符串的实际字符数（考虑中文）
  const getStringLength = (str: string) => {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127 || str.charCodeAt(i) === 94) {
        len += 1;
      } else {
        len += 0.5; // 英文字符算半个长度
      }
    }
    return Math.ceil(len);
  };

  const nameLength = getStringLength(name);
  if (nameLength <= 4) {
    return name;
  }
  
  // 截取合适的长度加省略号
  let result = '';
  let currentLength = 0;
  for (let i = 0; i < name.length; i++) {
    const charLength = name.charCodeAt(i) > 127 || name.charCodeAt(i) === 94 ? 1 : 0.5;
    if (currentLength + charLength <= 3.5) {
      result += name[i];
      currentLength += charLength;
    } else {
      break;
    }
  }
  
  return result + '...';
}
</script>

<style scoped>
.cate2-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  overflow: visible;
}

.cate2-content {
  position: relative;
  height: 0;
  padding-bottom: 8px;
  overflow: hidden;
  transition: height 0.4s cubic-bezier(0.33, 0.66, 0.66, 1);
  will-change: height;
  box-sizing: border-box;
}

.cate2-content.animating {
  overflow: hidden !important;
}

.cate2-content.scrollable:not(.animating) {
  overflow: hidden !important; /* 改为hidden以确保不出现滚动条 */
}

.cate2-scroll-wrapper {
  max-height: 100%;
  height: 100%;
  overflow: hidden;
}

.cate2-scroll-wrapper.allow-scroll:not(.animating) {
  overflow: hidden !important; /* 修改为hidden以彻底禁用滚动条 */
}

/* Expanded state: allow scrolling but hide scrollbar */
.cate2-content.is-expanded {
  overflow: hidden !important;
}

.cate2-content.is-expanded .cate2-scroll-wrapper {
  overflow-y: auto !important;
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}

.cate2-content.is-expanded .cate2-scroll-wrapper::-webkit-scrollbar {
  display: none !important;  /* WebKit browsers */
  width: 0 !important;
  height: 0 !important;
}

/* Collapsed state: ensure no scrolling */
.cate2-content:not(.is-expanded) {
  overflow: hidden !important;
}

.cate2-content:not(.is-expanded) .cate2-scroll-wrapper {
  overflow: hidden !important;
}

.cate2-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 120px)); /* Further reduce card width to 120px */
  gap: 12px;
  justify-content: flex-start;
  padding-bottom: 16px;
}

.cate2-card {
  width: 120px; /* Further reduce card width to 120px */
  background: #1f1f23;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  box-sizing: border-box;
}

.cate2-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.cate2-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.cate2-card.active {
  background: #ff5d23;
}

.cate2-card:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1);
}

.cate2-info {
  flex: 1;
  overflow: hidden;
}

.cate2-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.expand-button {
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s ease;
  font-size: 12px;
  background: #18181b;
  z-index: 10;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  height: 28px;
  box-sizing: border-box;
}

.expand-button:hover {
  color: #fff;
}

.expand-icon {
  margin-left: 4px;
  transition: transform 0.4s cubic-bezier(0.33, 0.66, 0.66, 1);
  width: 12px;
  height: 12px;
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
}
</style>