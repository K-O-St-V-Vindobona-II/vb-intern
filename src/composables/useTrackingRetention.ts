import { computed, ref } from 'vue'
import trackingService from '@/services/trackingService'
import { MONTH_NAMES } from '@/utils/formatters'

const DEFAULT_RETENTION_MONTHS = 6

export interface RetentionMonth {
  year: number
  /** Calendar month, 1 to 12. */
  month: number
  monthName: string
  /** Month name and year, e.g. "Juni 2026". */
  label: string
}

/**
 * Lists every calendar month from the first month of the retention window up to
 * and including the month of `now`, oldest first.
 */
export function listRetentionMonths(retentionMonths: number, now: Date): RetentionMonth[] {
  const months: RetentionMonth[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth() - retentionMonths, 1)
  while (cursor <= now) {
    const monthName = MONTH_NAMES[cursor.getMonth()] ?? ''
    months.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      monthName,
      label: `${monthName} ${cursor.getFullYear()}`,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

/**
 * Retention window of the tracking data (sent e-mails, activity log), shared by
 * the tracking views. The default applies until the configured value arrives
 * and whenever the configuration cannot be loaded.
 */
export function useTrackingRetention() {
  const retentionMonths = ref(DEFAULT_RETENTION_MONTHS)
  const now = new Date()
  const months = computed(() => listRetentionMonths(retentionMonths.value, now))

  const loadRetention = async (): Promise<void> => {
    try {
      const config = await trackingService.getConfig()
      retentionMonths.value = config.retention_months
    } catch {
      // Keep the default: the views stay usable without the configuration.
    }
  }

  return { retentionMonths, months, loadRetention }
}
