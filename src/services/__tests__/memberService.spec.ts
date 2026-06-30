import { describe, it, expect, vi, beforeEach } from 'vitest'
import memberService from '@/services/memberService'

const mockGet = vi.fn()
const mockPatch = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}))

describe('memberService', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPatch.mockReset()
  })

  it('getCurrentUser fetches /members/me and returns the user', async () => {
    const user = { id: 1, cn: 'Max Mustermann' }
    mockGet.mockResolvedValueOnce({ data: user })

    const result = await memberService.getCurrentUser()

    expect(result).toEqual(user)
    expect(mockGet).toHaveBeenCalledWith('/members/me')
  })

  it('toggleChronicleMail patches the flag and returns the new value', async () => {
    mockPatch.mockResolvedValueOnce({ data: { chroniclemail: true } })

    const result = await memberService.toggleChronicleMail()

    expect(result).toBe(true)
    expect(mockPatch).toHaveBeenCalledWith('/members/me/chroniclemail')
  })
})
