import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SchedulerView from '../SchedulerView.vue'
import PrimeVue from 'primevue/config'

const mockGetScheduledJobs = vi.fn()
const mockTriggerBackup = vi.fn()
const mockTriggerDownsync = vi.fn()
const mockGetJobRunHistory = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: {
    getScheduledJobs: (...args: unknown[]) => mockGetScheduledJobs(...args),
    triggerBackup: (...args: unknown[]) => mockTriggerBackup(...args),
    triggerDownsync: (...args: unknown[]) => mockTriggerDownsync(...args),
    getJobRunHistory: (...args: unknown[]) => mockGetJobRunHistory(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockLogout = vi.fn()
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ logout: mockLogout })),
}))

// Defaults to "production" so every pre-existing test below (all written
// against the backup button) keeps working unchanged - tests for the
// non-production/downsync branch override this explicitly.
const mockAppEnvironment = vi.fn(() => 'production')
vi.mock('@/runtimeConfig', () => ({
  appEnvironment: () => mockAppEnvironment(),
}))

describe('SchedulerView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAppEnvironment.mockReturnValue('production')
    mockLogout.mockResolvedValue(undefined)
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

  it('shows only the backup button on production, not downsync', async () => {
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Backup jetzt erstellen')
    expect(wrapper.text()).not.toContain('Downsync jetzt durchführen')
  })

  it('shows only the downsync button on a non-production stage, not backup', async () => {
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Downsync jetzt durchführen')
    expect(wrapper.text()).not.toContain('Backup jetzt erstellen')
  })

  it('asks for confirmation instead of triggering the downsync directly, with the logout warning in the message', async () => {
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockTriggerDownsync).not.toHaveBeenCalled()
    expect(mockConfirmRequire.mock.calls[0]![0].message).toContain(
      'werden dabei automatisch abgemeldet',
    )
  })

  it('does not trigger a downsync when the confirmation is dismissed', async () => {
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    // Never calling accept() is what "Abbrechen" looks like from the
    // component's perspective - PrimeVue itself owns the reject button.
    expect(mockTriggerDownsync).not.toHaveBeenCalled()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('triggers a downsync and shows a success toast once confirmed', async () => {
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerDownsync.mockResolvedValue({ data: { status: 'started' } })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockTriggerDownsync).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Downsync gestartet - Fortschritt in der Job-Historie unten sichtbar.',
      }),
    )
  })

  it('logs the current session out and redirects to login after a confirmed downsync', async () => {
    // The session is already doomed the moment the restore actually runs
    // (it wipes the sessions table too) - logging out immediately keeps
    // the UI honest instead of looking "logged in" a few seconds longer.
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerDownsync.mockResolvedValue({ data: { status: 'started' } })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login' })
  })

  it('shows a sticky red warning that the current session will be logged out', async () => {
    // The restore step wipes and replaces this stage's entire database,
    // including the sessions table - shown right after triggering, before
    // the background task even starts, no race with the actual logout.
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerDownsync.mockResolvedValue({ data: { status: 'started' } })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Achtung: automatische Abmeldung folgt',
      }),
    )
    const warningCall = mockToastAdd.mock.calls.find(
      (call) => call[0].summary === 'Achtung: automatische Abmeldung folgt',
    )
    expect(warningCall?.[0].life).toBeUndefined()
  })

  it('shows an error toast when triggering a confirmed downsync fails', async () => {
    mockAppEnvironment.mockReturnValue('development')
    mockGetScheduledJobs.mockResolvedValue({ data: [] })
    mockTriggerDownsync.mockRejectedValue({
      response: { data: { detail: 'Downsync fehlgeschlagen' } },
    })
    const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Downsync fehlgeschlagen' }),
    )
    // No reason to log out if the trigger itself never succeeded.
    expect(mockLogout).not.toHaveBeenCalled()
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
              id: 1,
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
