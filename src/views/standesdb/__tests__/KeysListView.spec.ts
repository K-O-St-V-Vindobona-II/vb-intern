import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import KeysListView from '../KeysListView.vue'
import PrimeVue from 'primevue/config'

const FIRST_ID = '11111111-1111-1111-1111-111111111111'
const SECOND_ID = '22222222-2222-2222-2222-222222222222'

const mockGetKeysList = vi.fn()
const mockDownloadKeysList = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getKeysList: (...args: unknown[]) => mockGetKeysList(...args),
    downloadKeysList: (...args: unknown[]) => mockDownloadKeysList(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/standesdb/keys', name: 'standesdb-keys', component: KeysListView },
    {
      path: '/standesdb/members/:id',
      name: 'standesdb-member-show',
      component: { template: '<div />' },
    },
  ],
})

function buildKeysListData() {
  return {
    key_names: ['Bude', 'Heim'],
    members: [
      {
        id: FIRST_ID,
        nachname: 'Mustermann',
        vorname: 'Max',
        keys: { Bude: true, Heim: false },
      },
      {
        id: SECOND_ID,
        nachname: 'Beispiel',
        vorname: 'Erika',
        keys: { Bude: false, Heim: true },
      },
    ],
  }
}

async function mountView() {
  await router.push('/standesdb/keys')
  await router.isReady()
  const wrapper = mount(KeysListView, { global: { plugins: [PrimeVue, router] } })
  await flushPromises()
  return wrapper
}

describe('KeysListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetKeysList.mockReset()
    mockDownloadKeysList.mockReset()
    mockGetKeysList.mockResolvedValue({ data: buildKeysListData() })
    // jsdom does not implement the object-URL functions; set them for one case at a time.
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL
  })

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('renders a column per key and a row per member', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Bude')
    expect(wrapper.text()).toContain('Heim')
    expect(wrapper.text()).toContain('Mustermann')
    expect(wrapper.text()).toContain('Beispiel')
    expect(wrapper.findAll('.key-yes')).toHaveLength(2)
    expect(wrapper.findAll('.key-no')).toHaveLength(2)
  })

  it('regression: links a member name to the member page, so it can be reached with the keyboard', async () => {
    const wrapper = await mountView()

    // The table is sorted by nachname ascending, so "Beispiel" sorts before "Mustermann".
    const link = wrapper.find('a.member-link')

    expect(link.attributes('href')).toBe(`/standesdb/members/${SECOND_ID}`)
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('standesdb-member-show')
    expect(router.currentRoute.value.params['id']).toBe(SECOND_ID)
  })

  it('regression: still shows a link for a member without a surname or first name', async () => {
    mockGetKeysList.mockResolvedValue({
      data: {
        key_names: ['Bude'],
        members: [{ id: FIRST_ID, nachname: null, vorname: null, keys: { Bude: true } }],
      },
    })

    const wrapper = await mountView()

    const links = wrapper.findAll('a.member-link')
    expect(links.map((l) => l.text())).toEqual(['-', '-'])
  })

  it('regression: names the key state of every cell for assistive technology', async () => {
    const wrapper = await mountView()

    const names = wrapper.findAll('[role="img"]').map((icon) => icon.attributes('aria-label'))
    expect(names).toEqual(
      expect.arrayContaining(['Bude: vorhanden', 'Bude: nicht vorhanden', 'Heim: vorhanden']),
    )
    expect(names).toHaveLength(4)
  })

  it('downloads the keys list using the filename from the content-disposition header', async () => {
    const blob = new Blob(['Max;Bude,Heim'])
    mockDownloadKeysList.mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename=schluesselliste.txt' },
    })
    // Spying on the prototype method (rather than replacing document.createElement)
    // avoids interfering with Vue's own DOM rendering during this same click handler.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = await mountView()
    await wrapper.find('.keys-actions-top button').trigger('click')
    await flushPromises()

    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        detail: 'schluesselliste.txt wurde heruntergeladen.',
      }),
    )
    clickSpy.mockRestore()
  })

  it('regression: reads the name from a quoted header that also carries the RFC 5987 form', async () => {
    mockDownloadKeysList.mockResolvedValue({
      data: new Blob(['x']),
      headers: {
        'content-disposition':
          'attachment; filename="schluessel_2026-09-25.txt"; filename*=UTF-8\'\'schluessel_2026-09-25.txt',
      },
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = await mountView()
    await wrapper.find('.keys-actions-top button').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'schluessel_2026-09-25.txt wurde heruntergeladen.' }),
    )
    clickSpy.mockRestore()
  })

  it('falls back to a generated filename when there is no content-disposition header', async () => {
    mockDownloadKeysList.mockResolvedValue({ data: new Blob(['x']), headers: {} })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = await mountView()
    await wrapper.find('.download-action button').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringMatching(/^schluessel_\d{4}-\d{2}-\d{2}\.txt wurde/),
      }),
    )
    clickSpy.mockRestore()
  })

  it('shows an error toast when the download fails', async () => {
    mockDownloadKeysList.mockRejectedValue(new Error('failed'))
    const wrapper = await mountView()

    await wrapper.find('.keys-actions-top button').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  describe('a load that fails', () => {
    it('regression: says so instead of showing an empty page, and offers no download', async () => {
      mockGetKeysList.mockRejectedValue({ response: { status: 500 } })

      const wrapper = await mountView()

      expect(wrapper.text()).toContain('Die Schlüsselliste konnte nicht geladen werden.')
      expect(wrapper.find('.keys-actions-top').exists()).toBe(false)
      expect(wrapper.find('.download-action').exists()).toBe(false)
    })

    it('loads the list after "Erneut versuchen"', async () => {
      mockGetKeysList.mockRejectedValueOnce({ response: { status: 500 } })
      const wrapper = await mountView()

      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Erneut versuchen')!
        .trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Mustermann')
      expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    })
  })
})
