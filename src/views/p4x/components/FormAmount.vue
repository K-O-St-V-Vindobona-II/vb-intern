<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'

const model = defineModel<number>({ required: true })
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
