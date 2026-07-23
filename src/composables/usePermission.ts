import { useAuthStore } from '@/stores/auth'

export function usePermission() {
  const authStore = useAuthStore()

  function hasPermission(perm: string): boolean {
    return authStore.user?.permissions?.includes(perm) ?? false
  }

  return { hasPermission }
}
