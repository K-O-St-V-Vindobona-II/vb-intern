import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ClipboardBar from '../ClipboardBar.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockReceiveItems = vi.fn()
const mockReceiveItemsRoot = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    receiveItems: (...args: unknown[]) => mockReceiveItems(...args),
    receiveItemsRoot: (...args: unknown[]) => mockReceiveItemsRoot(...args),
  },
}))

const mountOpts = { global: { plugins: [PrimeVue] } }

describe('ClipboardBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
    mockReceiveItems.mockResolvedValue({})
    mockReceiveItemsRoot.mockResolvedValue({})
  })

  it('renders nothing when the clipboard is empty', () => {
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 1 }, ...mountOpts })
    expect(wrapper.find('.clipboard-bar').exists()).toBe(false)
  })

  it('shows separate counts for directories and files', () => {
    const store = useArchiveStore()
    store.addToClipboard(['dir:1', 'dir:2', 'file:3'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 1 }, ...mountOpts })

    expect(wrapper.text()).toContain('Verzeichnisse: 2')
    expect(wrapper.text()).toContain('Dateien: 1')
  })

  it('empties the clipboard when the clear button is clicked', async () => {
    const store = useArchiveStore()
    store.addToClipboard(['dir:1'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 1 }, ...mountOpts })

    await wrapper.find('.clipboard-header button').trigger('click')

    expect(store.clipboard).toEqual([])
  })

  it('asks for confirmation before moving directories into a target dir', async () => {
    const store = useArchiveStore()
    store.addToClipboard(['dir:1'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 9 }, ...mountOpts })

    await wrapper.find('.clipboard-row button').trigger('click')

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0]).toMatchObject({
      message: '1 Verzeichnisse hierher verschieben?',
    })
  })

  it('moves items into the target directory on confirmation, removes them from the clipboard and emits moved', async () => {
    const store = useArchiveStore()
    store.addToClipboard(['dir:1', 'dir:2'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 9 }, ...mountOpts })

    await wrapper.find('.clipboard-row button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockReceiveItems).toHaveBeenCalledWith(9, { type: 'dir', ids: [1, 2], action: 'move' })
    expect(store.clipboard).toEqual([])
    expect(wrapper.emitted('moved')).toHaveLength(1)
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
  })

  it('moves items into the archive root when targetDirId is falsy', async () => {
    const store = useArchiveStore()
    store.addToClipboard(['file:5'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 0 }, ...mountOpts })

    await wrapper.find('.clipboard-row button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockReceiveItemsRoot).toHaveBeenCalledWith({ type: 'file', ids: [5], action: 'move' })
    expect(mockReceiveItems).not.toHaveBeenCalled()
  })

  it('shows an error toast when moving fails', async () => {
    mockReceiveItems.mockRejectedValueOnce(new Error('failed'))
    const store = useArchiveStore()
    store.addToClipboard(['dir:1'])
    const wrapper = mount(ClipboardBar, { props: { targetDirId: 9 }, ...mountOpts })

    await wrapper.find('.clipboard-row button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(store.clipboard).toEqual(['dir:1'])
  })
})
