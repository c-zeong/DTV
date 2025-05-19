import { ref, Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 主播信息接口
export interface Streamer {
  rid: string        // 房间ID
  roomName: string   // 房间名称
  nickname: string   // 主播昵称
  roomSrc: string    // 房间缩略图
  avatar: string     // 主播头像
  hn: string         // 观看人数
}

// 直播列表响应接口
export interface LiveListResponse {
  error: number
  msg?: string
  data: {
    list: Streamer[]
    total: number
  }
}

export function useLiveData(initialCate2?: string) {
  const streamers = ref<Streamer[]>([])
  const currentPage = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const pageSize = 20 // 每页20个主播
  
  // 获取主播列表数据
  const fetchStreamers = async (cate2: string, page: number = currentPage.value) => {
    if (!cate2) return
    
    try {
      isLoading.value = true
      
      // 如果是重置到第一页
      if (page !== currentPage.value) {
        currentPage.value = page
      }
      
      const response = await invoke<string>(
        'fetch_live_list',
        {
          offset: page * pageSize,
          cate2: cate2,
          limit: pageSize
        }
      )
      
      const data = JSON.parse(response)
      
      if (data.error === 0) {
        streamers.value = data.data.list
        hasMore.value = data.data.total > (page + 1) * pageSize
      } else {
        console.error('获取主播列表返回错误:', data.msg)
        streamers.value = []
        hasMore.value = false
      }
    } catch (error) {
      console.error('获取主播列表失败:', error)
      streamers.value = []
      hasMore.value = false
    } finally {
      isLoading.value = false
    }
  }
  
  // 翻页功能
  const prevPage = () => {
    if (currentPage.value > 0) {
      currentPage.value--
    }
  }
  
  const nextPage = () => {
    if (hasMore.value) {
      currentPage.value++
    }
  }
  
  // 初始化获取数据
  if (initialCate2) {
    fetchStreamers(initialCate2, 0)
  }
  
  return {
    streamers,
    currentPage,
    hasMore,
    isLoading,
    fetchStreamers,
    prevPage,
    nextPage
  }
} 