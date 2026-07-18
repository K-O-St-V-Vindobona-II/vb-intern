import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/member'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))
// @/stores/auth pulls in @/services/api -> @/router, which calls the real
// vue-router createRouter()/createWebHistory() at module scope; stub it out.
vi.mock('@/router', () => ({
  default: { currentRoute: { value: { name: 'home', fullPath: '/' } }, push: vi.fn() },
}))

function buildUser(permissions: string[]): User {
  return {
    id: 1,
    cn: 'Max Mustermann',
    default_image: null,
    org_id: 'vbw',
    auth_locked: false,
    permissions,
    google_linked: false,
    chroniclemail: false,
    session_idle_timeout: 1800,
  }
}

describe('useNavigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  describe('hasPermission', () => {
    it('returns false when there is no user', () => {
      const { hasPermission } = useNavigation()
      expect(hasPermission('p4xAdmin')).toBe(false)
    })

    it('returns true when the user has the permission', () => {
      const authStore = useAuthStore()
      authStore.user = buildUser(['p4xAdmin'])
      const { hasPermission } = useNavigation()
      expect(hasPermission('p4xAdmin')).toBe(true)
    })

    it('returns false when the user lacks the permission', () => {
      const authStore = useAuthStore()
      authStore.user = buildUser(['standesdbExport'])
      const { hasPermission } = useNavigation()
      expect(hasPermission('p4xAdmin')).toBe(false)
    })
  })

  describe('mainMenuItems', () => {
    it('exposes the top-level menu groups in order', () => {
      const { mainMenuItems } = useNavigation()
      const labels = mainMenuItems.value.map((item) => item.label)
      expect(labels).toEqual([
        'Standesdatenbank',
        'Archiv',
        'Information',
        'AH-Kassen',
        'www-Administration',
        'System',
      ])
    })

    it('hides permission-gated items when the user lacks the permission', () => {
      const authStore = useAuthStore()
      authStore.user = buildUser([])
      const { mainMenuItems } = useNavigation()

      const p4xGroup = mainMenuItems.value.find((item) => item.label === 'AH-Kassen')
      const systemGroup = mainMenuItems.value.find((item) => item.label === 'System')
      const wwwGroup = mainMenuItems.value.find((item) => item.label === 'www-Administration')
      const standesdbGroup = mainMenuItems.value.find((item) => item.label === 'Standesdatenbank')
      const exportItem = standesdbGroup?.items?.find((item) => item.label === 'Export')

      expect(p4xGroup?.visible).toBe(false)
      expect(systemGroup?.visible).toBe(false)
      expect(wwwGroup?.visible).toBe(false)
      expect(exportItem?.visible).toBe(false)
    })

    it('shows permission-gated items when the user has the permission', () => {
      const authStore = useAuthStore()
      authStore.user = buildUser([
        'p4xView',
        'systemAdmin',
        'standesdbExport',
        'keylist',
        'publicContentEditor',
      ])
      const { mainMenuItems } = useNavigation()

      const p4xGroup = mainMenuItems.value.find((item) => item.label === 'AH-Kassen')
      const systemGroup = mainMenuItems.value.find((item) => item.label === 'System')
      const wwwGroup = mainMenuItems.value.find((item) => item.label === 'www-Administration')
      const standesdbGroup = mainMenuItems.value.find((item) => item.label === 'Standesdatenbank')
      const exportItem = standesdbGroup?.items?.find((item) => item.label === 'Export')
      const keylistItem = standesdbGroup?.items?.find((item) => item.label === 'Schlüsselliste')

      expect(p4xGroup?.visible).toBe(true)
      expect(systemGroup?.visible).toBe(true)
      expect(wwwGroup?.visible).toBe(true)
      expect(exportItem?.visible).toBe(true)
      expect(keylistItem?.visible).toBe(true)
    })

    it('navigates via router.push when a command is invoked', () => {
      const { mainMenuItems } = useNavigation()
      const standesdbGroup = mainMenuItems.value.find((item) => item.label === 'Standesdatenbank')
      const dashboardItem = standesdbGroup?.items?.find((item) => item.label === 'Einsicht')

      dashboardItem?.command?.()

      expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-dashboard' })
    })

    it('every leaf menu entry navigates to a named route when its command is invoked', () => {
      // Permissions are granted so every permission-gated branch is reachable too.
      const authStore = useAuthStore()
      authStore.user = buildUser([
        'p4xView',
        'p4xAdmin',
        'systemAdmin',
        'standesdbExport',
        'keylist',
      ])
      const { mainMenuItems } = useNavigation()

      let commandCount = 0
      const invokeAllCommands = (items: typeof mainMenuItems.value): void => {
        for (const item of items) {
          if (item.command) {
            commandCount++
            item.command()
          }
          if (item.items) invokeAllCommands(item.items as typeof mainMenuItems.value)
        }
      }
      invokeAllCommands(mainMenuItems.value)

      expect(commandCount).toBeGreaterThan(0)
      expect(mockPush).toHaveBeenCalledTimes(commandCount)
      for (const call of mockPush.mock.calls) {
        expect(call[0]).toHaveProperty('name')
      }
    })
  })
})
