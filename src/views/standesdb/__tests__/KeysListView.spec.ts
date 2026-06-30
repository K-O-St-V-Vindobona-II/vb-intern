import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import KeysListView from '../KeysListView.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

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
vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

function buildKeysListData() {
  return {
    key_names: ['Bude', 'Heim'],
    members: [
      { id: 1, nachname: 'Mustermann', vorname: 'Max', keys: { Bude: true, Heim: false } },
      { id: 2, nachname: 'Beispiel', vorname: 'Erika', keys: { Bude: false, Heim: true } },
    ],
  }
}

async function mountView() {
  const wrapper = mount(KeysListView, { global: { plugins: [PrimeVue] } })
  await flushPromises()
  return wrapper
}

describe('KeysListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetKeysList.mockResolvedValue({ data: buildKeysListData() })
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

  it('navigates to the member when a name link is clicked', async () => {
    const wrapper = await mountView()

    // The table is sorted by nachname ascending, so "Beispiel" (id 2) sorts before "Mustermann" (id 1).
    await wrapper.find('.member-link').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-member-show', params: { id: 2 } })
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
})
