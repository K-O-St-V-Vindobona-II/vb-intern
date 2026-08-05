import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import TextsAdminView from '../TextsAdminView.vue'

const baseTabs = [
  { slot: 'anfang', title: 'Der Anfang', body: 'Text zum Anfang.' },
  { slot: 'mkv', title: 'MKV', body: 'Text zum MKV.' },
  { slot: 'heute', title: 'Heute', body: 'Text zu Heute.' },
]

const mockListTabs = vi.fn()
const mockUpdateTab = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  aboutTabsService: {
    listTabs: (...args: unknown[]) => mockListTabs(...args),
    updateTab: (...args: unknown[]) => mockUpdateTab(...args),
  },
}))

describe('TextsAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockListTabs.mockReset().mockResolvedValue({ data: structuredClone(baseTabs) })
    mockUpdateTab
      .mockReset()
      .mockImplementation((slot, data) => Promise.resolve({ data: { slot, ...data } }))
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(TextsAdminView, {
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders all 3 fixed tabs with their title and body', async () => {
    const w = await mountView()
    expect(w.text()).toContain('www-Administration')
    expect(w.text()).toContain('Texte')

    const titleInputs = w.findAll('input')
    expect(titleInputs.map((i) => (i.element as HTMLInputElement).value)).toEqual([
      'Der Anfang',
      'MKV',
      'Heute',
    ])
  })

  it('saves an edited tab', async () => {
    const w = await mountView()
    const titleInputs = w.findAll('input')
    await titleInputs[0]?.setValue('Neuer Titel')

    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[0]?.trigger('click')
    await flushPromises()

    expect(mockUpdateTab).toHaveBeenCalledWith('anfang', {
      title: 'Neuer Titel',
      body: 'Text zum Anfang.',
    })
  })

  it('saves tabs independently of each other', async () => {
    const w = await mountView()
    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockUpdateTab).toHaveBeenCalledOnce()
    expect(mockUpdateTab).toHaveBeenCalledWith('mkv', {
      title: 'MKV',
      body: 'Text zum MKV.',
    })
  })
})
