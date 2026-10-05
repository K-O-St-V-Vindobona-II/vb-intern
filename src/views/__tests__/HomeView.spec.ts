import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import HomeView from '../HomeView.vue'
import PrimeVue from 'primevue/config'
import router from '@/router'

const mockAuthStore: { user: { cn: string } | null } = { user: null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mountView = () =>
  mount(HomeView, {
    global: { plugins: [PrimeVue], stubs: { 'router-link': RouterLinkStub } },
  })

describe('HomeView.vue', () => {
  it('shows the four quick-access tiles with their descriptions', () => {
    mockAuthStore.user = { cn: 'Max Mustermann v/o Kopernikus' }
    const wrapper = mountView()

    const tiles = wrapper
      .findAll('.tile')
      .map((tile) => [tile.find('.tile-title').text(), tile.find('.tile-desc').text()])
    expect(tiles).toEqual([
      ['Upload-Center', 'Dateien ins Archiv hochladen'],
      ['Mitgliederverwaltung', 'Mitglieder und Kontakte einsehen'],
      ['Archiv', 'Dokumente und Fotos durchsuchen'],
      ['Zahlungsinformation', 'Bankverbindung und AH-Beitrag'],
    ])
  })

  it('makes every tile a link to an existing route, in the order of the tiles', () => {
    mockAuthStore.user = { cn: 'Test' }
    const wrapper = mountView()

    const targets = wrapper
      .findAllComponents(RouterLinkStub)
      .map((link) => (link.props('to') as { name: string }).name)
    expect(targets).toEqual([
      'archive-upload',
      'standesdb-dashboard',
      'archive-root',
      'payment-info',
    ])
    for (const name of targets) {
      expect(router.hasRoute(name)).toBe(true)
    }
  })

  it('shows the welcome text and the name of the member', () => {
    mockAuthStore.user = { cn: 'Max Mustermann v/o Kopernikus' }
    const wrapper = mountView()

    expect(wrapper.find('.home-title').text()).toBe('Willkommen im internen Bereich')
    expect(wrapper.find('.home-subtitle').text()).toBe('Max Mustermann v/o Kopernikus')
  })

  it('shows no name line while no member is loaded', () => {
    mockAuthStore.user = null
    const wrapper = mountView()

    expect(wrapper.find('.home-subtitle').exists()).toBe(false)
  })
})
