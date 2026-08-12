<script setup lang="ts">
import { ref } from 'vue'

const expanded = ref(false)
</script>

<template>
  <div class="criteria-info-box">
    <div class="criteria-info-toggle" @click="expanded = !expanded">
      <i class="pi pi-info-circle criteria-info-icon" />
      <span class="criteria-info-label">Wer ist beitragspflichtig?</span>
      <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
    </div>
    <div v-if="expanded" class="criteria-info-content">
      <p>
        Als beitragspflichtig gilt, wer bei der K.Ö.St.V. Vindobona II als Urphilister geführt wird,
        nicht entlassen und nicht verstorben ist.
      </p>
      <p>
        Nach genau diesem Kriterium wird die Mitgliedersuche hier zusammengestellt. Die Saldenliste
        zeigt zusätzlich nur jene beitragspflichtigen Mitglieder, für die bereits ein Beitragskonto
        (Initialdatum) eingerichtet wurde — neu hinzugekommene Mitglieder ohne Einrichtung
        erscheinen dort erst, sobald das nachgeholt wurde.
      </p>
    </div>
  </div>
</template>

<style scoped>
.criteria-info-box {
  max-width: 500px;
  margin: 0 auto 1.25rem;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  background: var(--app-surface-subtle);
  overflow: hidden;
  text-align: left;
}
.criteria-info-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.85rem;
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--p-primary-color);
  transition: background-color 0.15s ease;
}
.criteria-info-toggle:hover {
  background: var(--app-surface-subtle);
}
.criteria-info-icon {
  font-size: 0.9rem;
}
.criteria-info-label {
  flex: 1;
}
.criteria-info-toggle > i:last-child {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.criteria-info-content {
  padding: 0.75rem 0.85rem 0.85rem;
  border-top: 1px solid var(--app-border-card);
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}
.criteria-info-content p {
  margin: 0 0 0.75rem;
}
.criteria-info-content p:last-child {
  margin-bottom: 0;
}
</style>
