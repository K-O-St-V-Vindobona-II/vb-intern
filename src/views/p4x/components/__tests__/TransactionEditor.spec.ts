import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionEditor from '../TransactionEditor.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction } from '@/types/p4x'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockUpdateTransaction = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args) },
}))

function buildTransaction(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 'transaction-uuid-1',
    booking: '2026-06-01',
    valuation: '2026-06-01',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: '1',
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
    const updated = buildTransaction({ id: 'transaction-uuid-9', comment: 'Neuer Kommentar' })
    mockUpdateTransaction.mockResolvedValue({ data: updated })
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ id: 'transaction-uuid-9' }) },
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
    expect(id).toBe('transaction-uuid-9')
    expect(formData).toBeInstanceOf(FormData)
    expect((formData as FormData).get('comment')).toBe('Neuer Kommentar')
    expect((formData as FormData).get('delete_attachment')).toBe('false')
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })

  it('pre-fills an empty comment when the transaction has none', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ comment: null }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
    wrapper.unmount()
  })

  it('toggles the delete-attachment flag and includes it when saving', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: true }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const toggleBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Anhang löschen',
    )!
    toggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent === 'Löschen rückgängig',
      ),
    ).toBe(true)

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const [, formData] = mockUpdateTransaction.mock.calls[0]!
    expect((formData as FormData).get('delete_attachment')).toBe('true')
    wrapper.unmount()
  })

  it('includes a selected file when saving', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: false }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const file = new File(['%PDF-1.4'], 'beleg.pdf', { type: 'application/pdf' })
    await wrapper.findComponent({ name: 'FileUpload' }).vm.$emit('select', { files: [file] })

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const [, formData] = mockUpdateTransaction.mock.calls[0]!
    expect((formData as FormData).get('file')).toBe(file)
    wrapper.unmount()
  })

  it('closes the dialog without saving on cancel', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction() },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Abbrechen',
    )!
    cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateTransaction).not.toHaveBeenCalled()
    expect(document.querySelector('.p-dialog')).toBeNull()
    wrapper.unmount()
  })

  it('shows the API error and keeps the dialog open when saving fails', async () => {
    mockUpdateTransaction.mockRejectedValue({ response: { data: { detail: 'Datei zu groß' } } })
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction() },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Datei zu groß' }),
    )
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(document.querySelector('.p-dialog')).not.toBeNull()
    wrapper.unmount()
  })

  it('binds the comment label to the textarea', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction() },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    const label = document.querySelector('label.field-label') as HTMLLabelElement
    expect(label.htmlFor).toBe(textarea.id)
    expect(textarea.id).not.toBe('')
    wrapper.unmount()
  })

  it('limits the comment to 250 characters and the upload to a PDF of at most 3 MiB', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: false }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(document.querySelector('textarea')!.getAttribute('maxlength')).toBe('250')
    const upload = wrapper.findComponent({ name: 'FileUpload' })
    expect(upload.props('accept')).toBe('.pdf')
    expect(upload.props('maxFileSize')).toBe(3145728)
    wrapper.unmount()
  })

  it('starts every opening without a pending deletion or a chosen file', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: true }) },
      ...mountOpts,
    })
    const vm = wrapper.vm as unknown as { open: () => void }
    vm.open()
    await flushPromises()
    const buttonByText = (text: string) =>
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)
    buttonByText('Anhang löschen')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(buttonByText('Löschen rückgängig')).toBeTruthy()

    buttonByText('Abbrechen')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    vm.open()
    await flushPromises()

    expect(buttonByText('Anhang löschen')).toBeTruthy()
    expect(buttonByText('Löschen rückgängig')).toBeUndefined()
    wrapper.unmount()
  })

  it('sends no file field when no file was chosen', async () => {
    const wrapper = mount(TransactionEditor, {
      props: { transaction: buildTransaction({ has_attachment: false }) },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent === 'Speichern')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const [, formData] = mockUpdateTransaction.mock.calls[0]!
    expect((formData as FormData).has('file')).toBe(false)
    wrapper.unmount()
  })
})
