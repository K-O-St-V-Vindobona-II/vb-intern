<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TreeNode } from '@/types/standesdb'
import Dialog from 'primevue/dialog'
import TreeBranch from './TreeBranch.vue'

const props = defineProps<{
  visible: boolean
  ancestry: TreeNode[]
  children: TreeNode[]
  memberId: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const router = useRouter()
const collapsed = ref<Record<number, boolean>>({})

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      collapsed.value = {}
      for (const child of props.children) {
        if (child.children && child.children.length > 0) {
          collapsed.value[child.id] = true
        }
      }
    }
  },
)

const toggleCollapse = (id: number) => {
  collapsed.value[id] = !collapsed.value[id]
}

const goToMember = (id: number) => {
  emit('update:visible', false)
  router.push({
    name: 'standesdb-member-show',
    params: { id },
  })
}

const isAncestryCollapsed = (idx: number) => {
  for (let i = 0; i < idx; i++) {
    if (collapsed.value[props.ancestry[i]!.id]) return true
  }
  return false
}

const memberClass = (node: TreeNode) => {
  if (node.verstorben || node.entlassen) return 'tree-node-inactive'
  return ''
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Stammbaum"
    modal
    :style="{ width: '600px' }"
    :breakpoints="{ '700px': '95vw' }"
    position="top"
    :pt="{ root: { style: 'margin-top: 2rem' } }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="family-tree">
      <!-- Ancestry + Children als zusammenhängender Baum -->
      <template v-for="(ancestor, idx) in ancestry" :key="'a-' + ancestor.id">
        <div
          v-if="!isAncestryCollapsed(idx)"
          class="tree-row"
          :style="{ paddingLeft: idx * 20 + 'px' }"
        >
          <span
            v-if="ancestor.id !== memberId"
            class="tree-caret"
            @click="toggleCollapse(ancestor.id)"
          >
            <i :class="collapsed[ancestor.id] ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
          </span>
          <span
            class="tree-name"
            :class="[
              memberClass(ancestor),
              {
                'tree-node-current': ancestor.id === memberId,
              },
            ]"
            @click="goToMember(ancestor.id)"
          >
            {{ ancestor.cn }}
          </span>
        </div>
      </template>

      <!-- Children des aktuellen Mitglieds (rekursiv) -->
      <template v-if="!isAncestryCollapsed(ancestry.length)">
        <TreeBranch
          v-for="child in children"
          :key="'c-' + child.id"
          :node="child"
          :depth="ancestry.length"
          :collapsed="collapsed"
          :member-id="memberId"
          @toggle="toggleCollapse"
          @navigate="goToMember"
        />
      </template>
    </div>
  </Dialog>
</template>

<style scoped>
.family-tree {
  font-size: 0.9rem;
  line-height: 1.8;
}

.tree-row,
.family-tree :deep(.tree-row) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-caret,
.family-tree :deep(.tree-caret) {
  width: 12px;
  flex-shrink: 0;
  cursor: pointer;
  color: var(--p-surface-400);
  font-size: 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-caret-spacer,
.family-tree :deep(.tree-caret-spacer) {
  cursor: default;
}

.tree-name,
.family-tree :deep(.tree-name) {
  cursor: pointer;
  color: var(--p-primary-color);
}

.tree-name:hover,
.family-tree :deep(.tree-name:hover) {
  text-decoration: underline;
}

.tree-node-inactive,
.family-tree :deep(.tree-node-inactive) {
  color: var(--p-text-muted-color);
  font-style: italic;
}

.tree-node-current,
.family-tree :deep(.tree-node-current) {
  font-weight: 700;
  color: var(--p-primary-color);
}
</style>
