import type { AxiosResponse } from 'axios'

/**
 * Triggers a browser download for a blob axios response, using the
 * filename from the Content-Disposition header if present (falls back to
 * fallbackFilename otherwise). Returns the resolved filename for callers
 * that want to show it in a success message.
 */
export function downloadBlobResponse(
  response: AxiosResponse<Blob>,
  fallbackFilename: string,
): string {
  const disposition = response.headers['content-disposition'] ?? ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : fallbackFilename

  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  return filename
}
