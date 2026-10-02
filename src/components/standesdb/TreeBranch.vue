<script setup lang="ts">
import type { TreeNode } from '@/types/standesdb'

defineProps<{
  node: TreeNode
  depth: number
  collapsed: Record<string, boolean>
  memberId: string
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'navigate', id: string): void
}>()
</script>

<template>
  <div>
    <div class="tree-row" :style="{ paddingLeft: depth * 20 + 'px' }">
      <button
        v-if="node.children && node.children.length > 0"
        type="button"
        class="tree-caret"
        :aria-expanded="!collapsed[node.id]"
        :aria-label="`${node.cn}: ${collapsed[node.id] ? 'aufklappen' : 'zuklappen'}`"
        @click="emit('toggle', node.id)"
      >
        <i :class="collapsed[node.id] ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
      </button>
      <span v-else class="tree-caret tree-caret-spacer" />
      <button
        type="button"
        class="tree-name"
        :class="{
          'tree-node-inactive': node.verstorben || node.entlassen,
          'tree-node-current': node.id === memberId,
        }"
        @click="emit('navigate', node.id)"
      >
        {{ node.cn }}
      </button>
    </div>
    <template v-if="node.children && node.children.length > 0 && !collapsed[node.id]">
      <TreeBranch
        v-for="child in node.children"
        :key="'c-' + child.id"
        :node="child"
        :depth="depth + 1"
        :collapsed="collapsed"
        :member-id="memberId"
        @toggle="emit('toggle', $event)"
        @navigate="emit('navigate', $event)"
      />
    </template>
  </div>
</template>
