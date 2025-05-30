import { invoke } from '@tauri-apps/api/core'; // Added import for invoke
import * as douyuApi from '../douyu/api';
import * as douyuParsers from '../douyu/parsers'; // Import Douyu parsers
import { Platform } from './types'; // Import Platform enum
import type { SupportedPlatform, StreamerDetails, StreamPlaybackDetails, CommonCategoryGroup, CommonPlatformCategory } from './types'; // Import SupportedPlatform, StreamerDetails, and StreamPlaybackDetails, and CommonCategoryGroup, and CommonPlatformCategory
// Import other platform APIs and types here as they are added
// e.g., import * as bilibiliApi from '../bilibili/api';

// SupportedPlatform is now imported from './types'

// For now, we can have a simple currentPlatform variable.
// In a real app, this might come from user selection or configuration.
let currentPlatform: SupportedPlatform = 'douyu'; 

export function setCurrentPlatform(platform: SupportedPlatform) {
  currentPlatform = platform;
}

export function getCurrentPlatform(): SupportedPlatform {
  return currentPlatform;
}

// --- Room Info --- //
export async function fetchRoomInfo(roomId: string): Promise<StreamerDetails> {
  switch (currentPlatform) {
    case 'douyu':
      const douyuData = await douyuApi.fetchDouyuRoomInfo(roomId);
      return douyuParsers.parseDouyuRoomDataToStreamerDetails(roomId, douyuData); // Changed to douyuParsers
    // case 'bilibili':
    //   const bilibiliData = await bilibiliApi.fetchBilibiliRoomInfo(roomId);
    //   return bilibiliParsers.parseBilibiliRoomDataToStreamerDetails(roomId, bilibiliData);
    default:
      console.error(`Platform ${currentPlatform} not supported for fetchRoomInfo`);
      return Promise.reject(`Platform ${currentPlatform} not supported`);
  }
}

export async function startDanmakuListener(roomId: string): Promise<void> {
  switch (currentPlatform) {
    case 'douyu':
      return douyuApi.startDouyuDanmakuListener(roomId);
    // case 'bilibili':
    //   return bilibiliApi.startBilibiliDanmakuListener(roomId);
    default:
      console.error(`Platform ${currentPlatform} not supported for startDanmakuListener`);
      return Promise.reject(`Platform ${currentPlatform} not supported`);
  }
}

// --- Categories --- //
export async function fetchCategories(): Promise<CommonCategoryGroup[]> {
  switch (currentPlatform) {
    case 'douyu':
      // The Rust command `fetch_categories` now returns Vec<CommonCategoryGroupRust>
      // Serde should map this to CommonCategoryGroup[] correctly.
      const groups = await invoke<CommonCategoryGroup[]>('fetch_categories');
      return groups;
    // case 'bilibili':
    //   const rawBiliCategories = await bilibiliApi.fetchBilibiliCategoriesRaw();
    //   return bilibiliParsers.parseBilibiliCategories(rawBiliCategories);
    default:
      console.error(`Platform ${currentPlatform} not supported for fetchCategories`);
      return Promise.reject(`Platform ${currentPlatform} not supported`);
  }
}

export async function fetchSubCategories(parentId: string): Promise<CommonPlatformCategory[]> {
  if (!parentId) {
    console.warn('[apiService] fetchSubCategories called with no parentId');
    return Promise.resolve([]);
  }
  switch (currentPlatform) {
    case 'douyu':
      // The Rust command `fetch_three_cate` now returns Vec<CommonPlatformCategoryRust>
      // Serde should map this to CommonPlatformCategory[] correctly.
      // It expects tag_id which is our parentId (C2 category ID)
      const subCategories = await invoke<CommonPlatformCategory[]>('fetch_three_cate', { tagId: parentId });
      return subCategories;
    // case 'bilibili':
    //   const biliSubCategories = await bilibiliApi.fetchBilibiliSubCategories(parentId);
    //   return bilibiliParsers.parseBilibiliSubCategories(biliSubCategories);
    default:
      console.error(`Platform ${currentPlatform} not supported for fetchSubCategories`);
      return Promise.reject(`Platform ${currentPlatform} not supported`);
  }
}

// --- Stream Playback Details --- //
export async function fetchStreamPlaybackDetails(roomId: string, platform?: Platform): Promise<StreamPlaybackDetails> {
  const targetPlatform = platform || currentPlatform; // Use provided platform or fallback to global
  switch (targetPlatform) {
    case Platform.DOUYU: // Use Platform enum
      const rawUrl = await douyuApi.fetchDouyuStreamUrlRaw(roomId);
      return douyuParsers.parseDouyuStreamDataToPlaybackDetails(roomId, rawUrl);
    // case Platform.BILIBILI:
    //   const rawBiliStreamData = await bilibiliApi.fetchBilibiliStreamDataRaw(roomId);
    //   return bilibiliParsers.parseBilibiliStreamDataToPlaybackDetails(roomId, rawBiliStreamData);
    case Platform.DOUYIN:
      // Douyin stream details are fetched directly in DouyinPlayerView and passed as props.
      // This function in MainPlayer for Douyin should ideally not be called if streamUrl is already provided.
      // If it IS called for Douyin, it means something is wrong with the prop flow.
      console.warn('[apiService] fetchStreamPlaybackDetails called for Douyin. This is unexpected if streamUrl is passed via props.');
      return Promise.reject('Douyin stream details should be provided directly, not fetched via this common service.');
    default:
      console.error(`Platform ${targetPlatform} not supported for fetchStreamPlaybackDetails`);
      return Promise.reject(`Platform ${targetPlatform} not supported`);
  }
}

// Add other common API functions here