<script setup lang="ts">
import type { TreeNode } from '@/types/standesdb'

defineProps<{
  node: TreeNode
  depth: number
  collapsed: Record<number, boolean>
  memberId: number
}>()

const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'navigate', id: number): void
}>()
</script>

<template>
  <div>
    <div class="tree-row" :style="{ paddingLeft: depth * 20 + 'px' }">
      <span
        v-if="node.children && node.children.length > 0"
        class="tree-caret"
        @click="emit('toggle', node.id)"
      >
        <i :class="collapsed[node.id] ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
      </span>
      <span v-else class="tree-caret tree-caret-spacer" />
      <span
        class="tree-name"
        :class="{
          'tree-node-inactive': node.verstorben || node.entlassen,
          'tree-node-current': node.id === memberId,
        }"
        @click="emit('navigate', node.id)"
      >
        {{ node.cn }}
      </span>
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
