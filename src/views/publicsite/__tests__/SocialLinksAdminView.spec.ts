import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import SocialLinksAdminView from '../SocialLinksAdminView.vue'

const FACEBOOK_ID = '0199a1c0-0000-7000-8000-000000000001'
const INSTAGRAM_ID = '0199a1c0-0000-7000-8000-000000000002'
const LINKEDIN_ID = '0199a1c0-0000-7000-8000-000000000003'

const baseLinks = [
  {
    id: FACEBOOK_ID,
    platform: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/vindobona2',
    is_enabled: false,
  },
  {
    id: INSTAGRAM_ID,
    platform: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/vindobona2',
    is_enabled: true,
  },
]

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockMove = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  socialLinksService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    move: (...args: unknown[]) => mockMove(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}))

describe('SocialLinksAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockList.mockReset().mockResolvedValue({ data: structuredClone(baseLinks) })
    mockCreate.mockReset().mockResolvedValue({
      data: {
        id: LINKEDIN_ID,
        platform: 'linkedin',
        label: 'LinkedIn',
        url: 'https://x',
        is_enabled: true,
      },
    })
    mockUpdate.mockReset().mockResolvedValue({ data: baseLinks[0] })
    mockMove.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockRemove.mockReset().mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(SocialLinksAdminView, {
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders both links with their enabled state', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Social Media Verweise')
    expect(w.text()).toContain('Facebook')
    expect(w.text()).toContain('Instagram')
    expect(w.text()).toContain('Aktiv')
    expect(w.text()).toContain('Deaktiviert')
  })

  it('adds a new link', async () => {
    const w = await mountView()
    const platformInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Kennung (z. B. linkedin)')
    const labelInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Anzeigename')
    const urlInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'https://…')
    await platformInput?.setValue('LinkedIn')
    await labelInput?.setValue('LinkedIn')
    await urlInput?.setValue('https://linkedin.com/company/vindobona2')

    const addButton = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    await addButton?.trigger('click')
    await flushPromises()

    // Platform is lowercased client-side before it's sent — matches the
    // backend's slug CHECK constraint (only lowercase allowed).
    expect(mockCreate).toHaveBeenCalledWith({
      platform: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/company/vindobona2',
      is_enabled: true,
    })
  })

  it('toggles is_enabled via the edit dialog', async () => {
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click') // Facebook, currently disabled
    await flushPromises()

    const checkbox = document.querySelector<HTMLInputElement>(
      '.p-dialog-content input[type="checkbox"]',
    )
    checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdate).toHaveBeenCalledWith(FACEBOOK_ID, {
      label: 'Facebook',
      url: 'https://www.facebook.com/vindobona2',
      is_enabled: true,
    })
  })

  it('moves a link up', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockMove).toHaveBeenCalledWith(INSTAGRAM_ID, 'up')
  })

  it('deletes a link after confirming', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockRemove).toHaveBeenCalledWith(FACEBOOK_ID)
  })
})
