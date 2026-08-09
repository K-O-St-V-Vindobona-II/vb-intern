import { describe, it, expect } from 'vitest'
import { balanceSeverityClass } from '../balanceSeverityClass'

describe('balanceSeverityClass', () => {
  it('returns positive for a positive balance', () => {
    expect(balanceSeverityClass(500)).toBe('amount-positive')
  })

  it('returns positive for a zero balance', () => {
    expect(balanceSeverityClass(0)).toBe('amount-positive')
  })

  it('returns low (orange) for a small negative balance', () => {
    expect(balanceSeverityClass(-0.01)).toBe('amount-negative-low')
  })

  it('returns low (orange) at the exact -300 boundary', () => {
    expect(balanceSeverityClass(-300)).toBe('amount-negative-low')
  })

  it('returns mid (red) just past the -300 boundary', () => {
    expect(balanceSeverityClass(-300.01)).toBe('amount-negative-mid')
  })

  it('returns mid (red) at the exact -1000 boundary', () => {
    expect(balanceSeverityClass(-1000)).toBe('amount-negative-mid')
  })

  it('returns high (red, bold) just past the -1000 boundary', () => {
    expect(balanceSeverityClass(-1000.01)).toBe('amount-negative-high')
  })

  it('returns high (red, bold) for a deeply negative balance', () => {
    expect(balanceSeverityClass(-5000)).toBe('amount-negative-high')
  })
})
