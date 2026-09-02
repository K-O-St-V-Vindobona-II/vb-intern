import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeeMemberFormView from '../FeeMemberFormView.vue'
import PrimeVue from 'primevue/config'
import type { FeeMember } from '@/types/p4x'

const mockPush = vi.fn()
const mockRoute: { params: Record<string, string> } = { params: { id: '1' } }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetFeeMember = vi.fn()
const mockUpdateFeeMember = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getFeeMember: (...args: unknown[]) => mockGetFeeMember(...args),
    updateFeeMember: (...args: unknown[]) => mockUpdateFeeMember(...args),
  },
}))

function buildMember(overrides: Partial<FeeMember> = {}): FeeMember {
  return {
    id: '1',
    cn: 'Max Mustermann',
    p4x_init_date: '2020-01-01',
    p4x_init_balance: 10,
    p4x_freed: false,
    p4x_comment: null,
    balance: null,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('FeeMemberFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = { id: '1' }
  })

  it('loads and pre-fills the form from the fee member', async () => {
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    expect(mockGetFeeMember).toHaveBeenCalledWith('1')
    expect(wrapper.text()).toContain('Max Mustermann bearbeiten')
    wrapper.unmount()
  })

  it('pre-fills an empty init balance as 0 and an unset comment as empty', async () => {
    mockGetFeeMember.mockResolvedValue({
      data: buildMember({ p4x_init_date: null, p4x_init_balance: null, p4x_comment: null }),
    })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    const commentInput = wrapper.findAll('input[type="text"]').at(-1)
    expect(commentInput?.element.value).toBe('')
    wrapper.unmount()
  })

  it('saves the form and navigates back to the member view', async () => {
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    mockUpdateFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateFeeMember).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        p4x_init_date: '2020-01-01',
        p4x_init_balance: 10,
        p4x_freed: false,
        p4x_comment: null,
      }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-fee-member', params: { id: '1' } })
    wrapper.unmount()
  })

  it('sends a trimmed comment or null when saving', async () => {
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_comment: '  Hinweis  ' }) })
    mockUpdateFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateFeeMember).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ p4x_comment: 'Hinweis' }),
    )
    wrapper.unmount()
  })

  it('shows an error toast and does not navigate when saving fails', async () => {
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    mockUpdateFeeMember.mockRejectedValue({ response: { data: { detail: 'Ungültige Eingabe' } } })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Ungültige Eingabe' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows an error toast and navigates to the balances list when loading fails', async () => {
    mockGetFeeMember.mockRejectedValue(new Error('network error'))
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Beitragskonto konnte nicht geladen werden.',
      }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-fee-balances' })
    wrapper.unmount()
  })

  it('navigates back to the member view without saving on cancel', async () => {
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberFormView, mountOpts)
    await flushPromises()

    clickButton('Abbrechen')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-fee-member', params: { id: '1' } })
    expect(mockUpdateFeeMember).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
