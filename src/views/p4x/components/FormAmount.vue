<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'

// PrimeVue's InputNumber reports a cleared field as null; an amount is never empty, so it is 0.
const model = defineModel<number>({
  required: true,
  set: (value: number | null | undefined): number => value ?? 0,
})
</script>

<template>
  <InputNumber
    v-model="model"
    mode="currency"
    currency="EUR"
    locale="de-AT"
    :min-fraction-digits="2"
    :max-fraction-digits="2"
  />
</template>
