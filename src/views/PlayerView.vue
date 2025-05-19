<template>
  <PlayerSection
    :room-id="roomId"
    :isFollowed="false"
    @follow="$emit('follow', $event)"
    @unfollow="$emit('unfollow', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PlayerSection from '../components/PlayerSection.vue'

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

defineEmits<{
  (e: 'follow', streamer: any): void
  (e: 'unfollow', roomId: string): void
}>()
</script>