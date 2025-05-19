import { ref, computed, Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Category1, Category2, Category3 } from '../types'

export function useCategories(
  selectedCate1Id: Ref<number | null>,
  selectedCate2Id: Ref<number | null>
) {
  const cate1List = ref<Category1[]>([])
  const cate2List = ref<Category2[]>([])
  const cate3Map = ref<Record<number, Category3[]>>({})
  const isLoadingCate3 = ref(false)

  // Temporary type definition matching Rust's FrontendCategoryResponse structure
  // This should ideally be imported or be consistent with HomeView.vue's types
  interface RustFrontendCate3Item { id: string; name: string; }
  interface RustFrontendCate2Item { id: string; name: string; short_name: string; icon: string; cate3List: RustFrontendCate3Item[]; cate1Id?: number /* Will need to add this if C2s are flat */}
  interface RustFrontendCate1Item { id: string; name: string; cate2List: RustFrontendCate2Item[]; }
  
  // Updated to match the new Rust response structure from fetch_categories
  interface RustFrontendCategoryResponse {
    cate1List: RustFrontendCate1Item[];
  }

  const fetchCategories = async () => {
    console.log('开始获取分类数据')
    try {
      // invoke now directly returns the object with cate1List or throws an error
      const response = await invoke('fetch_categories') as RustFrontendCategoryResponse;
      console.log('获取到的已解析分类数据:', response)

      // On success, response directly contains cate1List.
      // Errors are caught by the catch block.
      if (response && response.cate1List) {
        const fetchedCate1Items = response.cate1List;
        
        // Transform RustFrontendCate1Item to local Category1 and populate cate2List
        const allCate1: Category1[] = [];
        const allCate2: Category2[] = [];

        for (const c1 of fetchedCate1Items) {
          // Assuming Category1 has fields like { cate1Id: number, cate1Name: string }
          // And FrontendCate1Item has { id: string (numeric), name: string }
          // This requires careful mapping based on actual Category1/Category2 types in ../types
          allCate1.push({ 
            cate1Id: parseInt(c1.id, 10), // Convert string ID to number
            cate1Name: c1.name 
            // Potentially other fields if Category1 needs them
          });

          for (const c2 of c1.cate2List) {
            allCate2.push({
              cate1Id: parseInt(c1.id, 10), // Link back to parent C1
              cate2Id: parseInt(c2.id, 10), // Convert string ID to number
              cate2Name: c2.name,
              shortName: c2.short_name,
              icon: c2.icon,
              count: 0, // 'count' seems to be used in Category2 in ../types, default to 0 or get from API if available
              // cate3List is not directly put into this flat list, handled by fetchThreeCate
            });
          }
        }
        
        cate1List.value = allCate1;
        cate2List.value = allCate2; // This creates a flat list of all C2s

        console.log('分类数据已更新', '一级分类数量:', cate1List.value.length, '二级分类数量:', cate2List.value.length)
      } else {
        // This else block might be redundant if invoke throws on non-success,
        // but kept for safety if a non-error empty response is possible.
        console.error('获取分类数据异常:响应中缺少 cate1List', response)
      }
    } catch (error) {
      console.error('获取分类数据失败:', error)
      throw error; // Re-throw for upstream handling
    }
  }

  const fetchThreeCate = async (cate2Id: number) => {
    isLoadingCate3.value = true
    try {
      console.log(`开始获取三级分类数据(cate2Id: ${cate2Id})`)
      const result = await invoke('fetch_three_cate', { tagId: cate2Id }) as string
      console.log(`获取到的三级分类数据(cate2Id: ${cate2Id}):`, result)
      
      try {
        const response = JSON.parse(result)
        if (response.error === 0 && response.data) {
          const threeCategories = response.data.map((item: any) => ({ 
            id: String(item.id), 
            name: item.name 
          }))
          
          cate3Map.value = {
            ...cate3Map.value,
            [cate2Id]: threeCategories
          }
          console.log(`三级分类数据已更新(cate2Id: ${cate2Id}):`, cate3Map.value[cate2Id])
        } else {
          console.error('获取三级分类数据失败:', response.msg || '未知错误')
          cate3Map.value = { ...cate3Map.value, [cate2Id]: [] }
        }
      } catch (parseError) {
        console.error(`解析三级分类数据JSON失败(cate2Id: ${cate2Id}):`, parseError, '原始数据:', result)
        cate3Map.value = { ...cate3Map.value, [cate2Id]: [] }
      }
    } catch (error) {
      console.error(`获取三级分类数据异常(cate2Id: ${cate2Id}):`, error)
      cate3Map.value = { ...cate3Map.value, [cate2Id]: [] }
    } finally {
      isLoadingCate3.value = false
    }
  }

  const sortedCate2List = computed(() => {
    if (selectedCate1Id.value === null) {
      console.log('未选择一级分类，二级分类列表为空')
      return []
    }
    
    const filtered = cate2List.value
      .filter(cate2 => cate2.cate1Id === selectedCate1Id.value)
      .sort((a, b) => b.count - a.count)
    
    console.log('筛选后的二级分类列表:', filtered, '基于一级分类ID:', selectedCate1Id.value)
    return filtered
  })

  const currentCate3List = computed(() => {
    if (!selectedCate2Id.value) return []
    return cate3Map.value[selectedCate2Id.value] || []
  })

  return {
    cate1List,
    cate2List,
    cate3Map,
    isLoadingCate3,
    fetchCategories,
    fetchThreeCate,
    sortedCate2List,
    currentCate3List
  }
}