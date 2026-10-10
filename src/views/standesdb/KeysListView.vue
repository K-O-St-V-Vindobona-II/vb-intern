<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { toLocalDateStr } from '@/utils/formatters'
import { downloadBlobResponse } from '@/utils/downloadBlob'
import type { KeysListMember } from '@/types/standesdb'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Message from 'primevue/message'

const toast = useToast()

const loading = ref(true)
const loadFailed = ref(false)
const downloading = ref(false)
const keyNames = ref<string[]>([])
const members = ref<KeysListMember[]>([])

const memberLink = (id: string) => ({ name: 'standesdb-member-show', params: { id } })

const download = async () => {
  downloading.value = true
  try {
    const resp = await standesdbService.downloadKeysList()
    const filename = downloadBlobResponse(resp, `schluessel_${toLocalDateStr(new Date())}.txt`)

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

const loadKeys = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    const resp = await standesdbService.getKeysList()
    keyNames.value = resp.data.key_names
    members.value = resp.data.members
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadKeys)
</script>

<template>
  <div class="keys-list">
    <div class="keys-header">
      <h2>Standesdatenbank</h2>
      <p class="keys-subtitle">Liste der Schlüsselinhaber</p>
      <div v-if="!loading && !loadFailed" class="keys-actions-top">
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

    <div v-if="loadFailed" class="load-error">
      <Message severity="error" :closable="false">
        Die Schlüsselliste konnte nicht geladen werden.
      </Message>
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadKeys" />
    </div>

    <Card v-if="!loading && !loadFailed">
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
              <RouterLink class="member-link" :to="memberLink(data.id)">
                {{ data.nachname ?? '-' }}
              </RouterLink>
            </template>
          </Column>
          <Column field="vorname" header="Vorname" sortable>
            <template #body="{ data }">
              <RouterLink class="member-link" :to="memberLink(data.id)">
                {{ data.vorname ?? '-' }}
              </RouterLink>
            </template>
          </Column>
          <Column v-for="keyName in keyNames" :key="keyName" :header="keyName">
            <template #body="{ data }">
              <div class="key-cell">
                <i
                  v-if="data.keys[keyName]"
                  class="pi pi-check-circle key-yes"
                  role="img"
                  :aria-label="`${keyName}: vorhanden`"
                />
                <i
                  v-else
                  class="pi pi-times-circle key-no"
                  role="img"
                  :aria-label="`${keyName}: nicht vorhanden`"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <div v-if="!loading && !loadFailed" class="download-action">
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

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
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
