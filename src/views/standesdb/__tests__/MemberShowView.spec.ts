import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MemberShowView from '../MemberShowView.vue'
import PrimeVue from 'primevue/config'
import { createRouter, createMemoryHistory } from 'vue-router'

const fullMemberData = {
  id: '1',
  cn: 'Max Muster v/o Testikus',
  vortitel: 'Diakon',
  vorname: 'Max',
  nachname: 'Muster',
  nachname_geburt: null,
  nachtitel: null,
  couleurname: 'Testikus',
  org_id: 'vbw',
  org_label: 'K.Ö.St.V. Vindobona II',
  state_id: 'bu',
  gruender: false,
  entlassen: false,
  verstorben: false,
  grabadresse: null,
  parent_id: null,
  parent_cn: '',
  default_image: null,
  chroniclemail: true,
  auth_locked: false,
  email: 'max@test.at',
  email_verified_at: null,
  url: 'https://example.at',
  mkv_ogv_url: null,
  rufnummer_mobil: '+43650123456',
  rufnummer_privat: null,
  rufnummer_beruf: null,
  zustellungen: 'adresse_privat',
  adresse_privat_anschrift: 'Testgasse 1',
  adresse_privat_plz: '1010',
  adresse_privat_ort: 'Wien',
  adresse_privat_land: 'Österreich',
  adresse_beruf_anschrift: null,
  adresse_beruf_plz: null,
  adresse_beruf_ort: null,
  adresse_beruf_land: null,
  arbeitgeber: 'TestFirma',
  taetigkeit: 'Entwickler',
  mitgliedschaften: null,
  verbandchargen: null,
  anmerkungen: null,
  geburtsdatum: '1990-05-15',
  geburtsdatum_accuracy: 3,
  aufnahmedatum: null,
  aufnahmedatum_accuracy: 0,
  branderdatum: null,
  branderdatum_accuracy: 0,
  burschungsdatum: null,
  burschungsdatum_accuracy: 0,
  philistrierungsdatum: null,
  philistrierungsdatum_accuracy: 0,
  entlassungsdatum: null,
  entlassungsdatum_accuracy: 0,
  sterbedatum: null,
  sterbedatum_accuracy: 0,
  roles_history: [
    { id: 'senior', label: 'Senior', group: 'chc', startdate: '2020-02-01', enddate: '2020-07-31' },
  ],
  badges: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'fuxenband',
      group: 'band',
      presentationdate: null,
      presentationdate_accuracy: 0,
    },
  ],
  keys: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'bude',
      presentationdate: null,
      presentationdate_accuracy: 0,
    },
  ],
  tree: { children: [], ancestry: [] },
}

const mockGetMember = vi.fn().mockResolvedValue({ data: fullMemberData })
const mockGetMemberAuthActivity = vi.fn().mockResolvedValue({
  data: {
    auth_lastlogin: '2026-08-01T10:00:00Z',
    auth_lastsignal: '2026-08-02T11:00:00Z',
    auth_lastlogout: '2026-08-02T11:05:00Z',
  },
})

vi.mock('@/services/standesdbService', () => ({
  default: {
    getMember: (...args: unknown[]) => mockGetMember(...args),
    getMemberAuthActivity: (...args: unknown[]) => mockGetMemberAuthActivity(...args),
  },
}))

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockRejectedValue(new Error('no image')) },
}))

const mockAuthStore = {
  user: { permissions: ['standesdbVbwAdmin'], org_id: 'vbw' },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/standesdb/members/:id', name: 'standesdb-member-show', component: MemberShowView },
    {
      path: '/standesdb/members/:id/edit',
      name: 'standesdb-member-edit',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/members/:id/images',
      name: 'standesdb-member-images',
      component: { template: '<div />' },
    },
    { path: '/standesdb', name: 'standesdb-dashboard', component: { template: '<div />' } },
  ],
})

describe('MemberShowView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetMember.mockResolvedValue({ data: fullMemberData })
    mockGetMemberAuthActivity.mockClear()
  })

  const mountView = async () => {
    await router.push('/standesdb/members/1')
    await router.isReady()
    const w = mount(MemberShowView, {
      global: { plugins: [PrimeVue, router, createPinia()] },
    })
    await flushPromises()
    return w
  }

  it('renders page title', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Standesdatenbank')
    expect(w.text()).toContain('Mitglied')
  })

  it('renders member name', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Max Muster v/o Testikus')
  })

  it('renders org label', async () => {
    const w = await mountView()
    expect(w.text()).toContain('K.Ö.St.V. Vindobona II')
  })

  it('renders email as mailto link', async () => {
    const w = await mountView()
    const link = w.find('a[href="mailto:max@test.at"]')
    expect(link.exists()).toBe(true)
  })

  it('renders the email-verified timestamp with date and time, not just the date', async () => {
    mockGetMember.mockResolvedValue({
      data: { ...fullMemberData, email_verified_at: '2026-08-05T14:32:00Z' },
    })
    const w = await mountView()
    // formatDateTime() converts to local time and always includes hour:minute -
    // this used to be formatFullDate(...split('T')[0]...), which silently
    // dropped the time and read the UTC calendar date directly instead of
    // converting to local time first.
    expect(w.text()).toMatch(/Email verifiziert: \d{2}\.\d{2}\.2026, \d{2}:\d{2}/)
  })

  it('hides the email-verified line when the email was never verified', async () => {
    const w = await mountView()
    expect(w.text()).not.toContain('Email verifiziert')
  })

  it('renders phone as tel link', async () => {
    const w = await mountView()
    const link = w.find('a[href="tel:+43650123456"]')
    expect(link.exists()).toBe(true)
  })

  it('renders URL as external link', async () => {
    const w = await mountView()
    const link = w.find('a[href="https://example.at"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
  })

  it('renders zustellung label instead of raw value', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Privatadresse')
    expect(w.text()).not.toContain('adresse_privat')
  })

  it('renders geburtsdatum with accuracy', async () => {
    const w = await mountView()
    expect(w.text()).toContain('15')
    expect(w.text()).toContain('Mai')
    expect(w.text()).toContain('1990')
  })

  it('hides entlassungsdatum when the member is not entlassen', async () => {
    const w = await mountView()
    expect(w.text()).not.toContain('Entlassungsdatum')
  })

  it('shows entlassungsdatum when the member is entlassen', async () => {
    mockGetMember.mockResolvedValue({
      data: {
        ...fullMemberData,
        entlassen: true,
        entlassungsdatum: '2022-11-05',
        entlassungsdatum_accuracy: 3,
      },
    })
    const w = await mountView()
    expect(w.text()).toContain('Entlassungsdatum')
    expect(w.text()).toContain('05')
    expect(w.text()).toContain('November')
    expect(w.text()).toContain('2022')
  })

  it('hides sterbedatum and grabadresse for a living member', async () => {
    const w = await mountView()
    expect(w.text()).not.toContain('Sterbedatum')
    expect(w.text()).not.toContain('Grabadresse')
  })

  it('shows sterbedatum and grabadresse for a deceased member', async () => {
    mockGetMember.mockResolvedValue({
      data: {
        ...fullMemberData,
        verstorben: true,
        sterbedatum: '2024-03-10',
        sterbedatum_accuracy: 3,
        grabadresse: 'Zentralfriedhof, Gruppe 14A',
      },
    })
    const w = await mountView()
    expect(w.text()).toContain('Sterbedatum')
    expect(w.text()).toContain('10')
    expect(w.text()).toContain('März')
    expect(w.text()).toContain('2024')
    expect(w.text()).toContain('Grabadresse')
    expect(w.text()).toContain('Zentralfriedhof, Gruppe 14A')
  })

  it('renders chargen table', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Chargen, Funktionen, Kommissionen')
    expect(w.text()).toContain('Senior')
  })

  it('capitalizes badge group', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Band')
  })

  it('capitalizes key name', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Bude')
  })

  it('shows edit button for admin', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Bearbeiten')
  })

  it('shows action buttons', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Zur Suche')
    expect(w.text()).toContain('Alle Profilbilder')
  })

  it('shows dismissed message for entlassene Mitglieder', async () => {
    mockGetMember.mockResolvedValueOnce({
      data: { id: '99', cn: 'Entlassener Test', org_id: 'vbw', dataprotection: 'dismissed' },
    })
    const w = await mountView()
    expect(w.text()).toContain('Entlassene Personen werden aus Datenschutzgründen nicht angezeigt.')
    expect(w.text()).toContain('Entlassener Test')
  })

  it('shows changelog section for a matching standesdb org admin', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Änderungshistorie')
  })

  it('hides changelog section for systemAdmin without a standesdb admin role', async () => {
    const original = mockAuthStore.user.permissions
    mockAuthStore.user.permissions = ['systemAdmin']
    try {
      const w = await mountView()
      expect(w.text()).not.toContain('Änderungshistorie')
    } finally {
      mockAuthStore.user.permissions = original
    }
  })

  it('shows the auth-activity section for a matching standesdb org admin', async () => {
    const w = await mountView()
    expect(mockGetMemberAuthActivity).toHaveBeenCalledWith('1')
    expect(w.text()).toContain('Letzte Aktivität')
    expect(w.text()).toContain('Letzter Login')
    expect(w.text()).toContain('Letztes Signal')
    expect(w.text()).toContain('Letzter Logout')
  })

  it('hides the auth-activity section and never fetches it for systemAdmin without a standesdb admin role', async () => {
    const original = mockAuthStore.user.permissions
    mockAuthStore.user.permissions = ['systemAdmin']
    try {
      const w = await mountView()
      expect(mockGetMemberAuthActivity).not.toHaveBeenCalled()
      expect(w.text()).not.toContain('Letzte Aktivität')
    } finally {
      mockAuthStore.user.permissions = original
    }
  })
})
