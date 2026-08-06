import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { downloadBlobResponse } from '../downloadBlob'

function makeResponse(headers: Record<string, string>): AxiosResponse<Blob> {
  return {
    data: new Blob(['content']),
    headers,
    status: 200,
    statusText: 'OK',
    config: {} as AxiosResponse['config'],
  } as AxiosResponse<Blob>
}

describe('downloadBlobResponse', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    revokeObjectURLSpy = vi.fn()
    URL.createObjectURL = createObjectURLSpy
    URL.revokeObjectURL = revokeObjectURLSpy
  })

  afterEach(() => {
    clickSpy.mockRestore()
  })

  it('uses the filename from the content-disposition header when present', () => {
    const resp = makeResponse({ 'content-disposition': 'attachment; filename="Export.xlsx"' })

    const filename = downloadBlobResponse(resp, 'fallback.xlsx')

    expect(filename).toBe('Export.xlsx')
    expect(createObjectURLSpy).toHaveBeenCalledWith(resp.data)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('falls back to the given filename when the header is missing', () => {
    const resp = makeResponse({})

    const filename = downloadBlobResponse(resp, 'fallback.xlsx')

    expect(filename).toBe('fallback.xlsx')
  })
})
