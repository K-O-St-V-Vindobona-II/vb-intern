import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FileComments from '../FileComments.vue'
import PrimeVue from 'primevue/config'
import type { Comment } from '@/types/archive'

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateComment = vi.fn()
const mockDeleteComment = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    createComment: (...args: unknown[]) => mockCreateComment(...args),
    deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  },
}))

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    content: 'Schön!',
    author: 'Max',
    created_at: '2026-06-30T10:00:00Z',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function findButtonByText(text: string): HTMLElement {
  return Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  ) as HTMLElement
}

describe('FileComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateComment.mockResolvedValue({})
    mockDeleteComment.mockResolvedValue({})
  })

  it('shows no comment list when there are none', () => {
    const wrapper = mount(FileComments, { props: { fileId: 1, comments: [] }, ...mountOpts })
    expect(wrapper.find('.comments-title').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders each comment with author and content', () => {
    const wrapper = mount(FileComments, {
      props: { fileId: 1, comments: [buildComment({ content: 'Toller Schnappschuss' })] },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Kommentar von Max')
    expect(wrapper.text()).toContain('Toller Schnappschuss')
    wrapper.unmount()
  })

  it('does not show a delete button for non-admins', () => {
    const wrapper = mount(FileComments, {
      props: { fileId: 1, comments: [buildComment()] },
      ...mountOpts,
    })
    expect(wrapper.find('.comment-header button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a delete button for admins', () => {
    const wrapper = mount(FileComments, {
      props: { fileId: 1, comments: [buildComment()], admin: true },
      ...mountOpts,
    })
    expect(wrapper.find('.comment-header button').exists()).toBe(true)
    wrapper.unmount()
  })

  it('disables saving until the comment is between 5 and 1000 characters', async () => {
    const wrapper = mount(FileComments, { props: { fileId: 1, comments: [] }, ...mountOpts })
    await findButtonByText('Kommentar hinzufügen').click()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    const saveButton = findButtonByText('Speichern')
    expect(saveButton.disabled).toBe(true)

    textarea.value = 'Lang genug'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(saveButton.disabled).toBe(false)
    wrapper.unmount()
  })

  it('saves a new comment and emits changed', async () => {
    const wrapper = mount(FileComments, { props: { fileId: 9, comments: [] }, ...mountOpts })
    await findButtonByText('Kommentar hinzufügen').click()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Ein gültiger Kommentar'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()

    findButtonByText('Speichern').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockCreateComment).toHaveBeenCalledWith(9, { content: 'Ein gültiger Kommentar' })
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows an error toast when saving a comment fails', async () => {
    mockCreateComment.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mount(FileComments, { props: { fileId: 9, comments: [] }, ...mountOpts })
    await findButtonByText('Kommentar hinzufügen').click()
    await flushPromises()

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Ein gültiger Kommentar'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()

    findButtonByText('Speichern').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })

  it('asks for confirmation and deletes the comment on accept', async () => {
    const wrapper = mount(FileComments, {
      props: { fileId: 9, comments: [buildComment({ id: 3 })], admin: true },
      ...mountOpts,
    })

    await wrapper.find('.comment-header button').trigger('click')
    expect(mockConfirmRequire).toHaveBeenCalledOnce()

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockDeleteComment).toHaveBeenCalledWith(9, 3)
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows an error toast when deleting a comment fails', async () => {
    mockDeleteComment.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mount(FileComments, {
      props: { fileId: 9, comments: [buildComment({ id: 3 })], admin: true },
      ...mountOpts,
    })

    await wrapper.find('.comment-header button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })
})
