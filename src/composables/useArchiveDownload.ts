import api from '@/services/api'

const URL_TTL_MS = 10 * 60 * 1000
const MAX_CACHE_SIZE = 50

interface CachedUrl {
  url: string
  expires: number
  lastAccessed: number
}

const urlCache = new Map<string, CachedUrl>()

function evictExpired(): void {
  const now = Date.now()
  for (const [key, entry] of urlCache) {
    if (entry.expires < now) urlCache.delete(key)
  }
}

function evictLeastUsed(): void {
  if (urlCache.size < MAX_CACHE_SIZE) return

  let lruKey: string | null = null
  let lruTime = Infinity

  for (const [key, entry] of urlCache) {
    if (entry.lastAccessed < lruTime) {
      lruTime = entry.lastAccessed
      lruKey = key
    }
  }

  if (lruKey) urlCache.delete(lruKey)
}

export function useArchiveDownload() {
  const loadPresignedUrl = async (fileId: number, size?: string): Promise<string | null> => {
    const key = `${fileId}_${size || 'orig'}`
    const cached = urlCache.get(key)
    if (cached && cached.expires > Date.now()) {
      cached.lastAccessed = Date.now()
      return cached.url
    }

    try {
      const suffix = size ? `/${size}` : ''
      const resp = await api.get<{ url: string }>(`/archive/files/${fileId}/url${suffix}`)
      const url = resp.data.url

      evictExpired()
      evictLeastUsed()

      urlCache.set(key, {
        url,
        expires: Date.now() + URL_TTL_MS,
        lastAccessed: Date.now(),
      })
      return url
    } catch {
      return null
    }
  }

  const triggerDownload = async (fileId: number, filename: string): Promise<void> => {
    try {
      const resp = await api.get<{ url: string }>(`/archive/files/${fileId}/url`)
      const a = document.createElement('a')
      a.href = resp.data.url
      a.download = filename
      a.click()
    } catch {
      /* handled by caller */
    }
  }

  return { loadPresignedUrl, triggerDownload }
}
