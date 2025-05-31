import { ref } from 'vue';
import type { Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DouyinStreamer, DouyinPartitionRoomsResponse } from '../types';

// Helper to parse the category href from DouyinCategory component
// It seems your hrefs are like: /category/1_1_1_1010032 or /category/3_10000_2_2786
// The demo `liveRooms.ts` expected `partition` and `partitionType`.
// Based on your `DouyinCategory/index.vue`'s computed properties for these:
// Game: /category/1_X_Y_Z -> partition_type = Y, partition = Z
// Entertainment: /category/3_X_Y_Z -> partition_type = Y, partition = Z (assuming Y is the inner type like '2', and Z is the final ID)
// Your current parsing logic in DouyinStreamerList/index.vue:
// Game: douyinPartition -> parts[4], douyinPartitionType -> parts[3]
// Entertainment: douyinPartition -> parts[4], douyinPartitionType -> parts[3]
// This seems consistent: partition is the last ID, type is the second to last numeric ID.

export function useDouyinLiveRooms(
    // These are computed refs from the parent component
    partitionId: Ref<string | null>,
    partitionTypeId: Ref<string | null>
) {
    const rooms = ref<DouyinStreamer[]>([]) as Ref<DouyinStreamer[]>;
    const isLoading = ref(false);
    const isLoadingMore = ref(false);
    const error = ref<string | null>(null);
    const currentOffset = ref(0);
    const hasMore = ref(true);
    const currentMsToken = ref<string | null>(null);

    const fetchAndSetMsToken = async () => {
        try {
            console.log("[useDouyinLiveRooms] Fetching new msToken...");
            currentMsToken.value = await invoke<string>('generate_douyin_ms_token');
            console.log("[useDouyinLiveRooms] New msToken fetched:", currentMsToken.value ? currentMsToken.value.substring(0,10)+"..." : null);
        } catch (e) {
            console.error("[useDouyinLiveRooms] Failed to fetch msToken:", e);
            error.value = "Failed to initialize session token.";
            currentMsToken.value = null;
            return false;
        }
        return true;
    };

    const mapRawRoomToDouyinStreamer = (rawRoom: any): DouyinStreamer => {
        // rawRoom is now expected to be the LiveRoomFrontend struct from Rust
        // console.log("[DEBUG mapRawRoomToDouyinStreamer] Raw room object (from Rust):", JSON.parse(JSON.stringify(rawRoom)));
        
        return {
            web_rid: rawRoom.web_rid?.toString() || `N/A_RID_${Math.random()}`,
            title: rawRoom.title || '未知标题',
            nickname: rawRoom.owner_nickname || '未知主播',
            // The backend now sends avatar_url, which is an empty string if not found.
            // The Vue template handles empty string for src by using a placeholder.
            avatar: rawRoom.avatar_url, 
            room_cover: rawRoom.cover_url || 'https://via.placeholder.com/320x180.png?text=No+Image',
            // user_count_str is directly mapped as the backend now sends this field correctly populated.
            viewer_count_str: rawRoom.user_count_str || '0 人',
            platform: 'douyin' as const,
        };
    }

    const fetchRooms = async (offset: number, isLoadMore: boolean = false) => {
        if (!partitionId.value || !partitionTypeId.value) {
            rooms.value = [];
            currentOffset.value = 0;
            hasMore.value = false;
            console.log("[useDouyinLiveRooms] Partition or Type is null, clearing rooms.");
            return;
        }

        if (!currentMsToken.value) {
            console.error("[useDouyinLiveRooms] msToken is not set. Aborting fetchRooms.");
            error.value = "Session token is missing. Please refresh or select category again.";
            if (!isLoadMore) isLoading.value = false;
            else isLoadingMore.value = false;
            hasMore.value = false;
            return;
        }

        if (isLoadMore) {
            isLoadingMore.value = true;
        } else {
            isLoading.value = true;
        }
        error.value = null;

        try {
            console.log(`[useDouyinLiveRooms] Fetching: partId=${partitionId.value}, partTypeId=${partitionTypeId.value}, offset=${offset}, token=${currentMsToken.value?.substring(0,10)}...`);
            
            const response = await invoke<DouyinPartitionRoomsResponse>('fetch_douyin_partition_rooms', {
                partition: partitionId.value,
                partitionType: partitionTypeId.value,
                offset: offset,
                msToken: currentMsToken.value,
            });
            
            console.log("[useDouyinLiveRooms] Raw API response:", response);

            if (response && Array.isArray(response.rooms)) { 
                const newRooms = response.rooms.map(mapRawRoomToDouyinStreamer);
                console.log(`[useDouyinLiveRooms] Processed ${newRooms.length} rooms.`);
                
                // Example debug log, ensure import.meta.env is handled if used
                // if (newRooms.length > 0 && typeof importMetaEnv !== 'undefined' && importMetaEnv.DEV) { 
                //     console.log("[useDouyinLiveRooms] Example mapped room:", newRooms[0]);
                // }

                if (isLoadMore) {
                    rooms.value.push(...newRooms);
                } else {
                    rooms.value = newRooms;
                }
                // Access has_more and next_offset directly from response object
                // The nullish coalescing operator (??) handles cases where these fields might be undefined in the response.
                // Updated logic: Rely on backend's has_more. Explicitly check for true.
                hasMore.value = response.has_more === true; 
                currentOffset.value = response.next_offset ?? (offset + newRooms.length);

            } else {
                console.warn("[useDouyinLiveRooms] No rooms array in response or invalid structure (expected response.rooms to be an array).");
                if (!isLoadMore) rooms.value = [];
                hasMore.value = false; 
            }

        } catch (e: any) {
            console.error('[useDouyinLiveRooms] Error fetching rooms:', e);
            error.value = typeof e === 'string' ? e : (e?.message || 'Failed to fetch rooms');
            if (!isLoadMore) {
                hasMore.value = false;
                rooms.value = [];
            }
        } finally {
            if (isLoadMore) {
                isLoadingMore.value = false;
            } else {
                isLoading.value = false;
            }
        }
    };

    const loadInitialRooms = async () => {
        console.log("[useDouyinLiveRooms] loadInitialRooms called.");
        currentOffset.value = 0;
        hasMore.value = true;
        isLoading.value = true; 
        error.value = null;
        rooms.value = []; // Clear previous rooms

        const tokenFetched = await fetchAndSetMsToken();
        if (tokenFetched && currentMsToken.value) {
            await fetchRooms(0, false);
        } else {
            if (!error.value) error.value = "Failed to initialize session. Cannot load rooms.";
            isLoading.value = false;
            hasMore.value = false;
        }
    };

    const loadMoreRooms = () => {
        if (hasMore.value && !isLoading.value && !isLoadingMore.value && currentMsToken.value) {
            console.log("[useDouyinLiveRooms] loadMoreRooms called, fetching next page from offset:", currentOffset.value);
            fetchRooms(currentOffset.value, true);
        }
    };
    
    // This watcher is now in the parent component (DouyinStreamerList/index.vue)
    // to trigger loadInitialRooms when selectedCategory changes.

    return {
        rooms,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadInitialRooms, 
        loadMoreRooms,
    };
} 