import './assets/main.css'
import 'primeicons/primeicons.css' // Icons for PrimeVue components

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import vue3GoogleLogin from 'vue3-google-login'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import App from './App.vue'
import router from './router'
import { googleClientId } from './runtimeConfig'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      // Explicit (behavior-identical to PrimeVue's own default): the app
      // intentionally follows the OS/browser color-scheme preference.
      // Custom component styles must use the --app-* tokens from
      // assets/main.css (or PrimeVue's own semantic tokens), never the
      // raw --p-surface-N scale, to stay correct in both schemes.
      darkModeSelector: 'system',
    },
  },
  locale: {
    firstDayOfWeek: 1,
    dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    dayNamesMin: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    monthNames: [
      'Jänner',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    monthNamesShort: [
      'Jän',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ],
    today: 'Heute',
    clear: 'Löschen',
  },
})

app.use(vue3GoogleLogin, {
  clientId: googleClientId(),
})

app.use(ConfirmationService)
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
