import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChangeRequestReviewView from '../ChangeRequestReviewView.vue'
import PrimeVue from 'primevue/config'
import type { MemberChangeRequestDetail } from '@/types/standesdb'

const REQUEST_ID = '11111111-1111-1111-1111-111111111111'
const MEMBER_ID = '22222222-2222-2222-2222-222222222222'
const mockRoute = { params: { id: REQUEST_ID } }
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockGetChangeRequest = vi.fn()
const mockDecideChangeRequest = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getChangeRequest: (...args: unknown[]) => mockGetChangeRequest(...args),
    decideChangeRequest: (...args: unknown[]) => mockDecideChangeRequest(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

function buildDetail(
  overrides: Partial<MemberChangeRequestDetail> = {},
): MemberChangeRequestDetail {
  return {
    id: REQUEST_ID,
    member_id: MEMBER_ID,
    member_cn: 'Max Mustermann',
    status: 'pending',
    created_at: '2026-08-06T10:00:00Z',
    updated_at: '2026-08-06T10:00:00Z',
    resolved_at: null,
    resolved_by_name: null,
    diff: [
      { field: 'nachname', old: 'Mustermann', new: 'Neu' },
      { field: 'email', old: 'alt@test.at', new: 'neu@test.at' },
    ],
    field_decisions: null,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] } }

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!button) throw new Error(`No button with text "${text}" found`)
  return button
}

describe('ChangeRequestReviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the diff rows for a pending request', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    expect(mockGetChangeRequest).toHaveBeenCalledWith(REQUEST_ID)
    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.text()).toContain('Mustermann')
    expect(wrapper.text()).toContain('Neu')
  })

  it('shows "Zuletzt geändert am" when the request was resubmitted after its initial submission', async () => {
    mockGetChangeRequest.mockResolvedValue({
      data: buildDetail({ created_at: '2026-08-06T10:00:00Z', updated_at: '2026-08-06T12:30:00Z' }),
    })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Zuletzt geändert am')
  })

  it('hides "Zuletzt geändert am" when the request was never resubmitted', async () => {
    mockGetChangeRequest.mockResolvedValue({
      data: buildDetail({ created_at: '2026-08-06T10:00:00Z', updated_at: '2026-08-06T10:00:00Z' }),
    })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Zuletzt geändert am')
  })

  it('disables submit until every field has a decision', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    const submitBtn = findButtonByText(wrapper, 'Entscheidung übernehmen')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('"Alle genehmigen" enables submit and decides every field as approved', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })
    mockDecideChangeRequest.mockResolvedValue({ data: { status: 'resolved' } })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await flushPromises()

    const submitBtn = findButtonByText(wrapper, 'Entscheidung übernehmen')
    expect(submitBtn.attributes('disabled')).toBeUndefined()

    await submitBtn.trigger('click')
    await flushPromises()

    expect(mockDecideChangeRequest).toHaveBeenCalledWith(REQUEST_ID, {
      nachname: 'approved',
      email: 'approved',
    })
    expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-change-requests' })
  })

  it('disables submit again when a decided field is deselected (PrimeVue emits null, not undefined)', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await flushPromises()
    expect(
      findButtonByText(wrapper, 'Entscheidung übernehmen').attributes('disabled'),
    ).toBeUndefined()

    const selectButtons = wrapper.findAllComponents({ name: 'SelectButton' })
    await selectButtons[0]!.vm.$emit('update:modelValue', null)

    expect(
      findButtonByText(wrapper, 'Entscheidung übernehmen').attributes('disabled'),
    ).toBeDefined()
  })

  it('"Alle ablehnen" decides every field as rejected', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })
    mockDecideChangeRequest.mockResolvedValue({ data: { status: 'resolved' } })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Alle ablehnen').trigger('click')
    await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
    await flushPromises()

    expect(mockDecideChangeRequest).toHaveBeenCalledWith(REQUEST_ID, {
      nachname: 'rejected',
      email: 'rejected',
    })
  })

  it('shows a read-only summary and no decision controls for an already-resolved request', async () => {
    mockGetChangeRequest.mockResolvedValue({
      data: buildDetail({
        status: 'resolved',
        resolved_at: '2026-08-06T12:00:00Z',
        resolved_by_name: 'Admin User',
        field_decisions: { nachname: 'approved', email: 'rejected' },
      }),
    })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Admin User')
    expect(wrapper.findComponent({ name: 'SelectButton' }).exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Alle genehmigen'))).toBe(false)
    expect(
      wrapper.findAll('button').some((b) => b.text().includes('Entscheidung übernehmen')),
    ).toBe(false)
  })

  it('shows an error toast and returns to the list when loading fails', async () => {
    mockGetChangeRequest.mockRejectedValue(new Error('boom'))

    mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-change-requests' })
  })
})
