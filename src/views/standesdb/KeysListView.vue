<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import type { KeysListMember } from '@/types/standesdb'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const downloading = ref(false)
const keyNames = ref<string[]>([])
const members = ref<KeysListMember[]>([])

const goToMember = (id: number) => {
  router.push({
    name: 'standesdb-member-show',
    params: { id },
  })
}

const download = async () => {
  downloading.value = true
  try {
    const resp = await standesdbService.downloadKeysList()

    const disposition = resp.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename=(.+)/)
    const filename = match ? match[1] : `schluessel_${new Date().toISOString().slice(0, 10)}.txt`

    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Download',
      detail: `${filename} wurde heruntergeladen.`,
      life: 3000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Download fehlgeschlagen.',
      life: 5000,
    })
  } finally {
    downloading.value = false
  }
}

onMounted(async () => {
  try {
    const resp = await standesdbService.getKeysList()
    keyNames.value = resp.data.key_names
    members.value = resp.data.members
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="keys-list">
    <div class="keys-header">
      <h2>Standesdatenbank</h2>
      <p class="keys-subtitle">Liste der Schlüsselinhaber</p>
      <div v-if="!loading" class="keys-actions-top">
        <Button
          label="Download"
          icon="pi pi-download"
          severity="secondary"
          size="small"
          :loading="downloading"
          @click="download"
        />
      </div>
    </div>

    <Card v-if="!loading">
      <template #content>
        <DataTable
          :value="members"
          striped-rows
          size="small"
          scrollable
          sort-field="nachname"
          :sort-order="1"
        >
          <Column field="nachname" header="Nachname" sortable>
            <template #body="{ data }">
              <a class="member-link" @click.prevent="goToMember(data.id)">
                {{ data.nachname }}
              </a>
            </template>
          </Column>
          <Column field="vorname" header="Vorname" sortable>
            <template #body="{ data }">
              <a class="member-link" @click.prevent="goToMember(data.id)">
                {{ data.vorname }}
              </a>
            </template>
          </Column>
          <Column
            v-for="keyName in keyNames"
            :key="keyName"
            :header="keyName"
            header-class="key-col-header"
            class="key-col"
          >
            <template #body="{ data }">
              <div class="key-cell">
                <i v-if="data.keys[keyName]" class="pi pi-check-circle key-yes" />
                <i v-else class="pi pi-times-circle key-no" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <div v-if="!loading" class="download-action">
      <Button
        label="Download als Textdatei"
        icon="pi pi-download"
        severity="secondary"
        :loading="downloading"
        @click="download"
      />
    </div>
  </div>
</template>

<style scoped>
.keys-list {
  max-width: 800px;
  margin: 0 auto;
}

.keys-header {
  margin-bottom: 1rem;
}

.keys-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}

.keys-actions-top {
  margin-top: 0.75rem;
}

.member-link {
  color: var(--p-primary-color);
  cursor: pointer;
  text-decoration: none;
}

.member-link:hover {
  text-decoration: underline;
}

.key-col-header,
.key-col {
  text-align: center;
  width: 15%;
}

.key-cell {
  display: flex;
  justify-content: center;
}

.key-yes {
  color: var(--p-green-500);
}

.key-no {
  color: var(--p-red-400);
}

.download-action {
  text-align: center;
  margin: 1.5rem 0 2rem;
}
</style>
