import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SchedulerView from '../SchedulerView.vue'
import PrimeVue from 'primevue/config'

const mockGetScheduledJobs = vi.fn()
const mockTriggerBackup = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: {
    getScheduledJobs: (...args: unknown[]) => mockGetScheduledJobs(...args),
    triggerBackup: (...args: unknown[]) => mockTriggerBackup(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

describe('SchedulerView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a card per scheduled job with its trigger and next run', async () => {
    mockGetScheduledJobs.mockResolvedValue({
      data: [
        {
          id: 'cleanup',
          name: 'Cleanup',
          trigger: 'cron(0 3 * * *)',
          next_run: '2026-07-01T03:00:00Z',
          description: 'Räumt alte Dateien auf.',
        },
      ],
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('cleanup')
    expect(wrapper.text()).toContain('Räumt alte Dateien auf.')
    expect(wrapper.text()).toContain('cron(0 3 * * *)')
    expect(wrapper.text()).toContain('2026-07-01T03:00:00Z')
  })

  it('shows a dash when a job has no next run', async () => {
    mockGetScheduledJobs.mockResolvedValue({
      data: [{ id: 'idle', name: 'Idle', trigger: 'manual', next_run: null, description: null }],
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('–')
  })

  it('renders no job cards when the list is empty', async () => {
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.findAll('.job-card')).toHaveLength(0)
  })

  it('shows an error toast when loading the jobs fails', async () => {
    mockGetScheduledJobs.mockRejectedValue({ response: { data: { detail: 'Serverfehler' } } })
    mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Serverfehler' }),
    )
  })

  it('triggers a backup and shows a success toast with the backup name', async () => {
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerBackup.mockResolvedValue({
      data: {
        backup_name: 'development-2026-07-15_12-00-00-manual.dump',
        triggered_at: '2026-07-15T12:00:00Z',
      },
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(mockTriggerBackup).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Backup erstellt: development-2026-07-15_12-00-00-manual.dump',
      }),
    )
  })

  it('shows an error toast when triggering a backup fails', async () => {
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerBackup.mockRejectedValue({
      response: { data: { detail: 'pg_dump fehlgeschlagen' } },
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'pg_dump fehlgeschlagen' }),
    )
  })
})
