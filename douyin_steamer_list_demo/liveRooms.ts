import { ref, Ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { LiveRoom } from '../../components/LiveList/types'; // Adjusted path

interface DouyinLiveListApiResponse {
    rooms: LiveRoom[];
    has_more: boolean;
    next_offset: number;
}

export function useDouyinLiveRooms(
    partition: Ref<string | null | undefined>,
    partitionType: Ref<string | null | undefined>
) {
    const rooms = ref<LiveRoom[]>([]) as Ref<LiveRoom[]>;
    const isLoading = ref(false);
    const isLoadingMore = ref(false);
    const error = ref<string | null>(null);
    const currentOffset = ref(0);
    const hasMore = ref(true); // Assume there are more rooms initially
    const currentMsToken = ref<string | null>(null); // Added msToken ref

    const fetchAndSetMsToken = async () => {
        try {
            console.log("Fetching new msToken...");
            currentMsToken.value = await invoke<string>('generate_douyin_ms_token');
            console.log("New msToken fetched:", currentMsToken.value);
        } catch (e) {
            console.error("Failed to fetch msToken:", e);
            error.value = "Failed to initialize session token.";
            currentMsToken.value = null; // Ensure it's null on error
            return false;
        }
        return true;
    };

    const fetchRooms = async (offset: number, isLoadMore: boolean = false) => {
        if (!partition.value || !partitionType.value) {
            rooms.value = [];
            currentOffset.value = 0;
            hasMore.value = false;
            return;
        }

        if (!currentMsToken.value) {
            // This should ideally be handled by loadInitialRooms ensuring token is set
            console.error("msToken is not set. Aborting fetchRooms.");
            error.value = "Session token is missing.";
            if (!isLoadMore) isLoading.value = false; // Reset loading if initial load
            else isLoadingMore.value = false;
            hasMore.value = false;
            return;
        }

        if (isLoadMore) {
            isLoadingMore.value = true;
        } else {
            isLoading.value = true;
            rooms.value = []; // Clear existing rooms for a new partition fetch
        }
        error.value = null;

        try {
            console.log(`Fetching Douyin rooms: part=${partition.value}, type=${partitionType.value}, offset=${offset}, msToken=${currentMsToken.value}`);
            const response = await invoke<DouyinLiveListApiResponse>('fetch_douyin_partition_rooms', {
                partition: partition.value,
                partitionType: partitionType.value,
                offset: offset,
                msToken: currentMsToken.value, // Pass msToken to command
            });
            
            console.log("Douyin rooms API response:", response);

            // --- ADDED LOGGING ---
            if (response && response.rooms && Array.isArray(response.rooms)) {
                console.log(`[useDouyinLiveRooms] Processing ${response.rooms.length} rooms from API response.`);
                response.rooms.forEach((room, index) => {
                    // Assuming LiveRoom type has web_rid, title. platform might be added later.
                    console.log(`[useDouyinLiveRooms] Room[${index}]: Title: "${room.title}", Web RID: "${room.web_rid}"`); 
                    console.log(`[useDouyinLiveRooms] Room[${index}] Full Object:`, JSON.parse(JSON.stringify(room))); 
                });
            } else {
                console.log("[useDouyinLiveRooms] No rooms array in response or response.rooms is not an array.");
            }
            // --- END ADDED LOGGING ---

            const newRooms = response.rooms.map(room => ({ ...room, platform: 'douyin' as const }));

            if (isLoadMore) {
                rooms.value.push(...newRooms);
            } else {
                rooms.value = newRooms;
            }
            currentOffset.value = offset + 15;
            // Determine hasMore based on the number of rooms fetched
            hasMore.value = newRooms.length === 15;

        } catch (e: any) {
            console.error('Error fetching Douyin rooms:', e);
            error.value = typeof e === 'string' ? e : (e?.message || 'Failed to fetch rooms');
            // If it was an initial load and failed, ensure hasMore is false
            if (!isLoadMore) {
                hasMore.value = false;
            }
        } finally {
            if (isLoadMore) {
                isLoadingMore.value = false;
            } else {
                isLoading.value = false;
            }
        }
    };

    const loadInitialRooms = async () => { // Made async
        currentOffset.value = 0;
        hasMore.value = true; // Reset for new partition
        isLoading.value = true; // Set loading true before fetching token
        error.value = null;

        const tokenFetched = await fetchAndSetMsToken();
        if (tokenFetched) {
            fetchRooms(0, false);
        } else {
            // Error already set by fetchAndSetMsToken, ensure loading is false
            isLoading.value = false;
            hasMore.value = false;
            rooms.value = []; // Clear rooms if token fetch fails
        }
    };

    const loadMoreRooms = () => {
        if (hasMore.value && !isLoading.value && !isLoadingMore.value && currentMsToken.value) {
            fetchRooms(currentOffset.value, true);
        }
    };

    // Watch for changes in partition or partitionType to reload rooms
    watch([partition, partitionType], ([newPart, newType], [oldPart, oldType]) => {
        if (newPart && newType) {
            if (newPart !== oldPart || newType !== oldType) {
                 console.log(`Partition or type changed. Reloading initial rooms and msToken.`);
                loadInitialRooms(); // This will now also fetch a new msToken
            }
        } else {
            // If partition or type becomes null, clear rooms
            rooms.value = [];
            currentOffset.value = 0;
            hasMore.value = false;
            isLoading.value = false;
            isLoadingMore.value = false;
            error.value = null;
            currentMsToken.value = null; // Clear msToken as well
        }
    }, { immediate: false }); // Don't run immediately, let DouyinCategoryPage trigger first load.

    return {
        rooms,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadInitialRooms, // Expose for initial load if needed by parent
        loadMoreRooms,
    };
} 