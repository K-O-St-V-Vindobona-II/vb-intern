import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionEditor from '../TransactionEditor.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction } from '@/types/p4x'

const mockUpdateTransaction = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args) },
}))

function buildTransaction(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 1,
    booking: '2026-06-01',
    valuation: '2026-06-01',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: 1,
    p4x_account_cn: 'Kasse',
    p4x_account_iban: 'AT00',
    comment: 'Bestehender Kommentar',
    has_attachment: false,
    partner: null,
    delegating_partner: null,
    p4x_category_directs: [],
    p4x_category_filters: [],
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('TransactionEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateTransaction.mockResolvedValue({ data: buildTransaction() })
  })

  it('pre-fills the existing comment when opened', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ comment: 'Hallo Welt' }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hallo Welt')
    wrapper.unmount()
  })

  it('shows the delete-attachment toggle when the transaction has an attachment', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: true }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    // Dialog content is teleported to document.body, outside the wrapper's DOM subtree.
    expect(
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent === 'Anhang löschen',
      ),
    ).toBe(true)
    expect(wrapper.findComponent({ name: 'FileUpload' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the upload field when the transaction has no attachment', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: false }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'FileUpload' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('saves the comment, deletion flag and file as form data, and emits changed', async () => {
    const updated = buildTransaction({ id: 9, comment: 'Neuer Kommentar' })
    mockUpdateTransaction.mockResolvedValue({ data: updated })
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ id: 9 }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Neuer Kommentar'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateTransaction).toHaveBeenCalledOnce()
    const [id, formData] = mockUpdateTransaction.mock.calls[0]!
    expect(id).toBe(9)
    expect(formData).toBeInstanceOf(FormData)
    expect((formData as FormData).get('comment')).toBe('Neuer Kommentar')
    expect((formData as FormData).get('delete_attachment')).toBe('false')
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })
})
