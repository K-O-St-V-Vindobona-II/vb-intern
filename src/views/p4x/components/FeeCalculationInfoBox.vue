<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  context: 'self' | 'admin'
  cutoverDate: string
}>()

const expanded = ref(false)

const formattedCutoverDate = computed(() =>
  new Date(props.cutoverDate).toLocaleDateString('de-AT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
)
</script>

<template>
  <div class="fee-info-box">
    <div class="fee-info-toggle" @click="expanded = !expanded">
      <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
      Wie wird {{ context === 'self' ? 'mein' : 'das' }} Beitragskonto berechnet?
    </div>
    <div v-if="expanded" class="fee-info-content">
      <p>
        Der Mitgliedsbeitrag ist eine wichtige Säule zur Aufrechterhaltung des Verbindungsbetriebs
        und unserer Gemeinschaft — eine regelmäßige Zahlung liegt daher allen am Herzen. Damit die
        Berechnung des Beitragskontos dabei jederzeit nachvollziehbar bleibt, hier eine ausführliche
        Erklärung:
      </p>
      <p>
        Jeden Monat wird am 10. der Mitgliedsbeitrag als Fälligkeit vom Konto abgezogen. Jede
        erkannte Beitragszahlung gleicht das wieder aus.
      </p>
      <p>
        <strong>Bis {{ formattedCutoverDate }}:</strong> Jede Zahlung wurde immer voll angerechnet —
        auch wenn sie höher war als der aktuell fällige Betrag. Ein Überschuss blieb als Guthaben
        stehen und wurde automatisch mit künftigen Monaten verrechnet.
      </p>
      <p>
        <strong>Seit {{ formattedCutoverDate }}:</strong> Damit freiwillige Zuwendungen (die
        eigentlich Spenden sind) nicht mehr automatisch als Vorauszahlung künftiger Monate gewertet
        werden, wird eine Zahlung nur noch bis zu einer Obergrenze angerechnet, die sich nach dem
        üblichen Zahlungsrhythmus richtet (z. B. monatlich, quartalsweise, jährlich). Der Teil einer
        Zahlung, der darüber hinausgeht, erscheint im Verlauf als "nicht angerechnet" — er zählt
        weiterhin ganz normal als Mitgliedsbeitrag, beeinflusst aber nicht mehr automatisch das
        Beitragskonto-Guthaben.
      </p>
      <p>
        <strong>Wichtig:</strong> Diese Umstellung wirkt sich <strong>nicht rückwirkend</strong> aus
        — der Saldo bis {{ formattedCutoverDate }} bleibt exakt so, wie er immer berechnet wurde.
      </p>
      <p>
        <strong>Was passiert mit einem bestehenden Guthaben?</strong> Ein vorhandenes Guthaben ist
        kein für immer eingefrorener Betrag, sondern ein ganz normaler, nutzbarer Polster — daran
        ändert sich nichts. Es wird wie schon immer jeden Monat durch die reguläre Fälligkeit
        automatisch verrechnet: wer weiterhin mindestens den fälligen Betrag zahlt, hält sein
        Guthaben ungefähr stabil; wer eine Zeit lang gar nichts oder weniger als fällig zahlt, baut
        das Guthaben ganz normal Monat für Monat ab, genau wie es das System schon immer getan hat.
        Neu ist nur, dass ein Guthaben künftig nicht mehr durch einzelne, deutlich überhöhte
        Zahlungen beliebig weiter aufgebaut werden kann.
      </p>
      <p v-if="context === 'self'">Fragen zu deinem Zahlungsrhythmus? Wende dich an den Kassier.</p>
      <p v-else>
        Fragen zum Zahlungsrhythmus dieses Mitglieds? Im Bearbeiten-Formular unter
        "Zahlungsintervall" anpassbar.
      </p>
    </div>
  </div>
</template>

<style scoped>
.fee-info-box {
  max-width: 500px;
  margin: 0 auto 1rem;
  text-align: left;
}
.fee-info-toggle {
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  text-align: center;
}
.fee-info-content {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.fee-info-content p {
  margin: 0 0 0.75rem;
}
.fee-info-content p:last-child {
  margin-bottom: 0;
}
</style>
