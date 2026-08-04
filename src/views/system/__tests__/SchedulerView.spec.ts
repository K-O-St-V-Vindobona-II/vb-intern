import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SchedulerView from '../SchedulerView.vue'
import PrimeVue from 'primevue/config'

const mockGetScheduledJobs = vi.fn()
const mockTriggerBackup = vi.fn()
const mockGetJobRunHistory = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: {
    getScheduledJobs: (...args: unknown[]) => mockGetScheduledJobs(...args),
    triggerBackup: (...args: unknown[]) => mockTriggerBackup(...args),
    getJobRunHistory: (...args: unknown[]) => mockGetJobRunHistory(...args),
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
          last_run: null,
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

  it('shows a dash when a job has no next run or last run', async () => {
    mockGetScheduledJobs.mockResolvedValue({
      data: [
        {
          id: 'idle',
          name: 'Idle',
          trigger: 'manual',
          next_run: null,
          description: null,
          last_run: null,
        },
      ],
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('–')
  })

  it('shows the last run status and timestamp when present', async () => {
    mockGetScheduledJobs.mockResolvedValue({
      data: [
        {
          id: 'cleanup',
          name: 'Cleanup',
          trigger: 'cron(0 3 * * *)',
          next_run: null,
          description: null,
          last_run: {
            exit_code: 1,
            output: 'db exploded',
            started_at: '2026-08-04T03:00:00Z',
            finished_at: '2026-08-04T03:00:05Z',
            duration_seconds: 5,
          },
        },
      ],
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('FEHLER')
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

  describe('history dialog', () => {
    const job = {
      id: 'cleanup',
      name: 'Cleanup',
      trigger: 'cron(0 3 * * *)',
      next_run: null,
      description: null,
      last_run: null,
    }

    it('loads and shows the run history when "Historie" is clicked', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      mockGetJobRunHistory.mockResolvedValue({
        data: {
          items: [
            {
              id: 'r1',
              job_id: 'cleanup',
              exit_code: 0,
              output: '3 removed',
              started_at: '2026-08-04T03:00:00Z',
              finished_at: '2026-08-04T03:00:01Z',
              duration_seconds: 1,
            },
          ],
          total: 1,
          page: 1,
          page_size: 25,
        },
      })
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()

      expect(mockGetJobRunHistory).toHaveBeenCalledWith('cleanup', {
        page: 1,
        page_size: 25,
      })
      // Dialog content is teleported to document.body, not the mounted tree.
      expect(document.body.textContent).toContain('3 removed')
    })

    it('shows an error toast when loading history fails', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      mockGetJobRunHistory.mockRejectedValue({
        response: { data: { detail: 'Historie fehlgeschlagen' } },
      })
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Historie fehlgeschlagen' }),
      )
    })

    it('requests the next page when paginating', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      mockGetJobRunHistory.mockResolvedValue({
        data: { items: [], total: 60, page: 1, page_size: 25 },
      })
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()

      const table = wrapper.findComponent({ name: 'DataTable' })
      await table.vm.$emit('page', { page: 1 })
      await flushPromises()

      expect(mockGetJobRunHistory).toHaveBeenLastCalledWith('cleanup', {
        page: 2,
        page_size: 25,
      })
    })
  })
})
