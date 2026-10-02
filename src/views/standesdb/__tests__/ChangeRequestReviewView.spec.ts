import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import ChangeRequestReviewView from '../ChangeRequestReviewView.vue'
import PrimeVue from 'primevue/config'
import type { MemberChangeRequestDetail } from '@/types/standesdb'

const REQUEST_ID = '11111111-1111-1111-1111-111111111111'
const MEMBER_ID = '22222222-2222-2222-2222-222222222222'
const mockRoute = reactive({ params: { id: REQUEST_ID } })
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

// The route mock is shared and reactive: a wrapper left mounted by an earlier case would react to
// the id changes of a later one.
enableAutoUnmount(afterEach)

const mountOpts = { global: { plugins: [PrimeVue] } }

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!button) throw new Error(`No button with text "${text}" found`)
  return button
}

describe('ChangeRequestReviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks keeps implementations and queued once-values of earlier cases.
    mockGetChangeRequest.mockReset()
    mockDecideChangeRequest.mockReset()
    mockRoute.params.id = REQUEST_ID
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

    expect(mockDecideChangeRequest).toHaveBeenCalledWith(
      REQUEST_ID,
      { nachname: 'approved', email: 'approved' },
      '2026-08-06T10:00:00Z',
    )
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

    expect(mockDecideChangeRequest).toHaveBeenCalledWith(
      REQUEST_ID,
      { nachname: 'rejected', email: 'rejected' },
      '2026-08-06T10:00:00Z',
    )
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

  it('sends the updated_at of the version the reviewer loaded as the review token', async () => {
    mockGetChangeRequest.mockResolvedValue({
      data: buildDetail({ updated_at: '2026-08-06T12:30:00.123456Z' }),
    })
    mockDecideChangeRequest.mockResolvedValue({ data: { status: 'resolved' } })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()
    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
    await flushPromises()

    expect(mockDecideChangeRequest.mock.calls[0]![2]).toBe('2026-08-06T12:30:00.123456Z')
  })

  it('does not submit a request that carries no version', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail({ updated_at: null }) })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()
    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
    await flushPromises()

    expect(mockDecideChangeRequest).not.toHaveBeenCalled()
  })

  describe('a decision the API refuses with 409', () => {
    const conflict = (detail: string) => ({ response: { status: 409, data: { detail } } })

    async function mountAndDecideAll() {
      const wrapper = mount(ChangeRequestReviewView, mountOpts)
      await flushPromises()
      await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
      await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
      await flushPromises()
      return wrapper
    }

    it('regression: shows the newer version when the member changed the request meanwhile', async () => {
      const detail =
        'Der Antrag wurde inzwischen vom Mitglied geändert und muss erneut geprüft werden.'
      mockGetChangeRequest.mockResolvedValueOnce({ data: buildDetail() }).mockResolvedValueOnce({
        data: buildDetail({
          updated_at: '2026-08-06T13:00:00Z',
          diff: [{ field: 'nachname', old: 'Mustermann', new: 'Boesartig' }],
        }),
      })
      mockDecideChangeRequest.mockRejectedValue(conflict(detail))

      const wrapper = await mountAndDecideAll()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn', detail }),
      )
      expect(wrapper.text()).toContain('Boesartig')
      expect(wrapper.text()).not.toContain('neu@test.at')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('regression: forgets the earlier decisions of a version that no longer exists', async () => {
      mockGetChangeRequest.mockResolvedValueOnce({ data: buildDetail() }).mockResolvedValueOnce({
        data: buildDetail({ updated_at: '2026-08-06T13:00:00Z' }),
      })
      mockDecideChangeRequest.mockRejectedValue(conflict('geändert'))

      const wrapper = await mountAndDecideAll()

      expect(
        findButtonByText(wrapper, 'Entscheidung übernehmen').attributes('disabled'),
      ).toBeDefined()
    })

    it('shows the resolved state when another admin decided first', async () => {
      mockGetChangeRequest.mockResolvedValueOnce({ data: buildDetail() }).mockResolvedValueOnce({
        data: buildDetail({
          status: 'resolved',
          resolved_at: '2026-08-06T12:00:00Z',
          resolved_by_name: 'Andere Admin',
          field_decisions: { nachname: 'approved', email: 'rejected' },
        }),
      })
      mockDecideChangeRequest.mockRejectedValue(conflict('Antrag wurde bereits entschieden.'))

      const wrapper = await mountAndDecideAll()

      expect(wrapper.text()).toContain('Andere Admin')
      expect(wrapper.findComponent({ name: 'SelectButton' }).exists()).toBe(false)
    })

    it('keeps the page and the decisions for a conflict of another kind', async () => {
      mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })
      mockDecideChangeRequest.mockRejectedValue(
        conflict('Ein Mitglied mit diesem Namen existiert bereits.'),
      )

      const wrapper = await mountAndDecideAll()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Ein Mitglied mit diesem Namen existiert bereits.' }),
      )
      expect(
        findButtonByText(wrapper, 'Entscheidung übernehmen').attributes('disabled'),
      ).toBeUndefined()
    })

    it('still shows the reason when the reload after the conflict fails', async () => {
      mockGetChangeRequest
        .mockResolvedValueOnce({ data: buildDetail() })
        .mockRejectedValueOnce(new Error('offline'))
      mockDecideChangeRequest.mockRejectedValue(conflict('geändert'))

      const wrapper = await mountAndDecideAll()

      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: 'geändert' }))
      expect(wrapper.text()).toContain('Max Mustermann')
    })
  })

  it('shows the reason of a failed decision instead of a fixed text', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })
    mockDecideChangeRequest.mockRejectedValue({
      response: { status: 403, data: { detail: 'Fehlende Berechtigung: standesdbVbwAdmin' } },
    })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()
    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Fehlende Berechtigung: standesdbVbwAdmin',
      }),
    )
  })

  it('falls back to a fixed text when the failure carries no reason', async () => {
    mockGetChangeRequest.mockResolvedValue({ data: buildDetail() })
    mockDecideChangeRequest.mockRejectedValue(new Error('offline'))

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    await flushPromises()
    await findButtonByText(wrapper, 'Alle genehmigen').trigger('click')
    await findButtonByText(wrapper, 'Entscheidung übernehmen').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Entscheidung konnte nicht gespeichert werden.' }),
    )
  })

  it('regression: a slow answer for the earlier request does not replace the newer one', async () => {
    const OTHER_ID = '33333333-3333-3333-3333-333333333333'
    let releaseFirst: (value: unknown) => void = () => {}
    mockGetChangeRequest
      .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce({ data: buildDetail({ id: OTHER_ID, member_cn: 'Zweite Person' }) })

    const wrapper = mount(ChangeRequestReviewView, mountOpts)
    mockRoute.params.id = OTHER_ID
    await flushPromises()
    releaseFirst({ data: buildDetail({ member_cn: 'Erste Person' }) })
    await flushPromises()

    expect(wrapper.text()).toContain('Zweite Person')
    expect(wrapper.text()).not.toContain('Erste Person')
  })
})
