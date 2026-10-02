import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SchedulerView from '../SchedulerView.vue'
import PrimeVue from 'primevue/config'
import { formatDateTime } from '@/utils/formatters'

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

  it('renders a card per scheduled job with its trigger and the next run formatted like the last run', async () => {
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
    expect(wrapper.text()).toContain(formatDateTime('2026-07-01T03:00:00Z'))
    expect(wrapper.text()).not.toContain('2026-07-01T03:00:00Z')
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

    const detail = (label: string) =>
      wrapper
        .findAll('.job-detail')
        .find((d) => d.find('.job-detail-label').text() === label)!
        .find('.job-detail-value')
        .text()
    expect(detail('Nächste Ausführung')).toBe('–')
    expect(detail('Letzter Lauf')).toBe('–')
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
              id: '11111111-1111-1111-1111-111111111111',
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

    function deferredHistory() {
      let resolvePromise!: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      return { promise, resolve: resolvePromise }
    }

    const run = (id: string, output: string) => ({
      id,
      job_id: 'x',
      exit_code: 0,
      output,
      started_at: '2026-08-04T03:00:00Z',
      finished_at: '2026-08-04T03:00:01Z',
      duration_seconds: 1,
    })

    const page = (items: unknown[], total = items.length) => ({
      data: { items, total, page: 1, page_size: 25 },
    })

    it('regression: the rows of the previously opened job are gone while the next job loads', async () => {
      const other = { ...job, id: 'backup' }
      mockGetScheduledJobs.mockResolvedValue({ data: [job, other] })
      const slow = deferredHistory()
      mockGetJobRunHistory
        .mockResolvedValueOnce(
          page([run('11111111-1111-1111-1111-111111111111', 'output of cleanup')]),
        )
        .mockReturnValueOnce(slow.promise)
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()
      const openButtons = wrapper.findAll('.job-card-footer button')

      await openButtons[0]!.trigger('click')
      await flushPromises()
      expect(document.body.textContent).toContain('output of cleanup')

      await openButtons[1]!.trigger('click')
      await flushPromises()

      expect(document.body.textContent).toContain('Historie: backup')
      expect(document.body.textContent).not.toContain('output of cleanup')
      expect(wrapper.findComponent({ name: 'DataTable' }).props('totalRecords')).toBe(0)

      slow.resolve(page([run('22222222-2222-2222-2222-222222222222', 'output of backup')]))
      await flushPromises()
      expect(document.body.textContent).toContain('output of backup')
    })

    it('regression: a slow answer for an earlier request does not replace the rows of the newer one', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      const slow = deferredHistory()
      mockGetJobRunHistory
        .mockResolvedValueOnce({ data: { items: [], total: 60, page: 1, page_size: 25 } })
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce(
          page([run('33333333-3333-3333-3333-333333333333', 'newer page')], 60),
        )
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()
      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()
      const table = wrapper.findComponent({ name: 'DataTable' })

      await table.vm.$emit('page', { page: 1 })
      await table.vm.$emit('page', { page: 2 })
      await flushPromises()
      slow.resolve(page([run('44444444-4444-4444-4444-444444444444', 'stale page')], 60))
      await flushPromises()

      expect(document.body.textContent).toContain('newer page')
      expect(document.body.textContent).not.toContain('stale page')
    })

    it('regression: a late failure of an earlier request raises no toast and keeps the loading state', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      let rejectSlow!: (reason: unknown) => void
      const slow = new Promise((_resolve, reject) => {
        rejectSlow = reject
      })
      const current = deferredHistory()
      mockGetJobRunHistory
        .mockResolvedValueOnce({ data: { items: [], total: 60, page: 1, page_size: 25 } })
        .mockReturnValueOnce(slow)
        .mockReturnValueOnce(current.promise)
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()
      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()
      const table = wrapper.findComponent({ name: 'DataTable' })

      await table.vm.$emit('page', { page: 1 })
      await table.vm.$emit('page', { page: 2 })
      rejectSlow({ response: { data: { detail: 'Zeitüberschreitung' } } })
      await flushPromises()

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(table.props('loading')).toBe(true)

      current.resolve(page([run('66666666-6666-6666-6666-666666666666', 'newer page')], 60))
      await flushPromises()

      expect(table.props('loading')).toBe(false)
    })

    it('shows a dash for a run without output', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      mockGetJobRunHistory.mockResolvedValue(
        page([run('77777777-7777-7777-7777-777777777777', null as unknown as string)]),
      )
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()

      expect(document.querySelector('.run-output')?.textContent).toBe('–')
    })

    it('keeps line breaks of a run output visible', async () => {
      mockGetScheduledJobs.mockResolvedValue({ data: [job] })
      mockGetJobRunHistory.mockResolvedValue(
        page([run('55555555-5555-5555-5555-555555555555', 'line one\nline two')]),
      )
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      await wrapper.find('.job-card-footer button').trigger('click')
      await flushPromises()

      expect(document.querySelector('.run-output')?.textContent).toBe('line one\nline two')
    })
  })

  it.each([undefined, '', 'staging'])(
    'offers neither backup nor downsync when the stage is unknown (%j)',
    async (environment) => {
      mockAppEnvironment.mockReturnValue(environment as string)
      mockGetScheduledJobs.mockResolvedValue({ data: [] })
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      expect(wrapper.text()).not.toContain('Downsync jetzt durchführen')
      expect(wrapper.text()).not.toContain('Backup jetzt erstellen')
    },
  )

  it.each(['development', 'test', 'qa'])(
    'offers the downsync on the %s stage',
    async (environment) => {
      mockAppEnvironment.mockReturnValue(environment)
      mockGetScheduledJobs.mockResolvedValue({ data: [] })
      const wrapper = mount(SchedulerView, { global: { plugins: [PrimeVue] } })
      await flushPromises()

      expect(wrapper.text()).toContain('Downsync jetzt durchführen')
    },
  )
})
