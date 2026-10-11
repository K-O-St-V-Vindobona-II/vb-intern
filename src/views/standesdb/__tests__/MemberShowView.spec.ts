import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
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

const mockGetChangelog = vi.fn()

vi.mock('@/services/standesdbService', () => ({
  default: {
    getMember: (...args: unknown[]) => mockGetMember(...args),
    getMemberAuthActivity: (...args: unknown[]) => mockGetMemberAuthActivity(...args),
    getChangelog: (...args: unknown[]) => mockGetChangelog(...args),
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
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

describe('MemberShowView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetMember.mockReset()
    mockGetMember.mockResolvedValue({ data: fullMemberData })
    mockGetMemberAuthActivity.mockClear()
    mockGetChangelog.mockReset()
    mockGetChangelog.mockResolvedValue({ data: { items: [], total: 0 } })
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

  it('shows the chronicle and sign-in lock rows with their state when the API returns them', async () => {
    mockGetMember.mockResolvedValue({
      data: { ...fullMemberData, chroniclemail: true, auth_locked: false },
    })
    const w = await mountView()

    expect(w.text()).toContain('☑Chroniclemails aktiviert')
    expect(w.text()).toContain('☐Zugang gesperrt')
  })

  it('shows an unchecked row, not a hidden one, for a false account status', async () => {
    mockGetMember.mockResolvedValue({
      data: { ...fullMemberData, chroniclemail: false, auth_locked: true },
    })
    const w = await mountView()

    expect(w.text()).toContain('☐Chroniclemails aktiviert')
    expect(w.text()).toContain('☑Zugang gesperrt')
  })

  it('hides the chronicle and sign-in lock rows when the API withholds the account status', async () => {
    mockGetMember.mockResolvedValue({
      data: { ...fullMemberData, chroniclemail: null, auth_locked: null },
    })
    const w = await mountView()

    expect(w.text()).not.toContain('Chroniclemails aktiviert')
    expect(w.text()).not.toContain('Zugang gesperrt')
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

  it('redirects to not-found on a 404', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 404 } })
    await mountView()
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('redirects to not-found on a 403', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 403 } })
    await mountView()
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows a retry state instead of a blank page on an unrelated load error', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 500 } })
    const w = await mountView()

    expect(router.currentRoute.value.name).toBe('standesdb-member-show')
    expect(w.text()).not.toContain('Max Muster')
    const retryBtn = w.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retryBtn).toBeTruthy()

    await retryBtn!.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Max Muster v/o Testikus')
    expect(mockGetMember).toHaveBeenCalledTimes(2)
  })

  describe('with the child dialogs replaced by stubs', () => {
    // A hand-written stub declares its props, so `children` is not set as a DOM property.
    const stubs = {
      FamilyTreeModal: defineComponent({
        name: 'FamilyTreeModal',
        props: {
          visible: { type: Boolean, default: false },
          ancestry: { type: Array, default: () => [] },
          children: { type: Array, default: () => [] },
          memberId: { type: String, default: '' },
        },
        template: '<div />',
      }),
      ImagePreview: true,
    }

    const valueOf = (w: Awaited<ReturnType<typeof mountWith>>, label: string) =>
      w
        .findAll('.show-field')
        .find((f) => f.find('label').exists() && f.find('label').text() === label)!
        .find('.show-value')
        .text()

    const mountWith = async (overrides: Record<string, unknown> = {}) => {
      mockGetMember.mockResolvedValue({ data: { ...fullMemberData, ...overrides } })
      await router.push('/standesdb/members/1')
      await router.isReady()
      const w = mount(MemberShowView, {
        global: { plugins: [PrimeVue, router, createPinia()], stubs },
      })
      await flushPromises()
      return w
    }

    const buttonsLabelled = (w: Awaited<ReturnType<typeof mountWith>>, label: string) =>
      w.findAll('button').filter((b) => b.text() === label)

    describe('navigation', () => {
      it.each([
        ['Zur Suche', { name: 'standesdb-dashboard' }],
        ['Alle Profilbilder', { name: 'standesdb-member-images', params: { id: '1' } }],
        ['Bearbeiten', { name: 'standesdb-member-edit', params: { id: '1' } }],
      ])('sends both %s buttons to the same place', async (label, target) => {
        const w = await mountWith()
        const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)

        const buttons = buttonsLabelled(w, label)
        expect(buttons).toHaveLength(2)
        for (const button of buttons) await button.trigger('click')

        expect(push).toHaveBeenCalledTimes(2)
        expect(push).toHaveBeenNthCalledWith(1, target)
        expect(push).toHaveBeenNthCalledWith(2, target)
        push.mockRestore()
      })

      it('hides both edit buttons from a viewer without the admin role of the member org', async () => {
        const w = await mountWith({ org_id: 'vbn' })

        expect(buttonsLabelled(w, 'Bearbeiten')).toHaveLength(0)
        expect(buttonsLabelled(w, 'Zur Suche')).toHaveLength(2)
      })

      it('offers the search from the page of a dismissed member', async () => {
        const w = await mountWith({ dataprotection: 'dismissed', cn: 'Entlassener', org_id: null })
        const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)

        expect(w.text()).toContain('Entlassener')
        expect(w.text()).toContain('–')
        await buttonsLabelled(w, 'Zur Suche')[0]!.trigger('click')

        expect(push).toHaveBeenCalledWith({ name: 'standesdb-dashboard' })
        push.mockRestore()
      })

      it('shows the organisation of a dismissed member in capitals', async () => {
        const w = await mountWith({ dataprotection: 'dismissed', cn: 'Entlassener' })

        expect(w.find('.dismissed-field').text()).toContain('VBW')
      })
    })

    describe('profile details', () => {
      it('shows the roles oldest first and marks an open one as ongoing', async () => {
        const w = await mountWith({
          roles_history: [
            { id: 'b', label: 'Kneipwart', group: 'chc', startdate: '2022-01-01', enddate: null },
            {
              id: 'a',
              label: 'Fuxmajor',
              group: 'chc',
              startdate: '2018-01-01',
              enddate: '2019-06-30',
            },
          ],
        })

        const rows = w.findAll('.full-width-section tbody tr').map((r) => r.text())
        expect(rows).toHaveLength(2)
        expect(rows[0]).toContain('Fuxmajor')
        expect(rows[0]).toContain('2019')
        expect(rows[0]).not.toContain('laufend')
        expect(rows[1]).toContain('Kneipwart')
        expect(rows[1]).toContain('laufend')
      })

      it('hides the roles table for a member without roles', async () => {
        const w = await mountWith({ roles_history: [] })

        expect(w.text()).not.toContain('Chargen, Funktionen, Kommissionen')
      })

      it('links the Leibbursch to his page', async () => {
        const w = await mountWith({ parent_id: '7', parent_cn: 'Leib Bursch' })

        const link = w.find('a.value-link[href="/standesdb/members/7"]')
        expect(link.exists()).toBe(true)
        expect(link.text()).toBe('Leib Bursch')
      })

      it('shows a dash when there is no Leibbursch', async () => {
        const w = await mountWith({ parent_id: null })

        expect(w.find('.leibbursch-value').text()).toBe('–')
        expect(w.find('.leibbursch-value a').exists()).toBe(false)
      })

      it('opens the family tree with the ancestry and children of the member', async () => {
        const tree = {
          ancestry: [{ id: '5', cn: 'Vorfahr' }],
          children: [{ id: '8', cn: 'Kind' }],
        }
        const w = await mountWith({ tree })
        const modal = w.findComponent({ name: 'FamilyTreeModal' })
        expect(modal.props('visible')).toBe(false)

        await w.find('button.tree-button').trigger('click')

        expect(modal.props('visible')).toBe(true)
        expect(modal.props('ancestry')).toEqual(tree.ancestry)
        expect(modal.props('children')).toEqual(tree.children)
        expect(modal.props('memberId')).toBe('1')
      })

      it('closes the family tree when the dialog asks to be hidden', async () => {
        const w = await mountWith()
        const modal = w.findComponent({ name: 'FamilyTreeModal' })
        await w.find('button.tree-button').trigger('click')
        expect(modal.props('visible')).toBe(true)

        modal.vm.$emit('update:visible', false)
        await flushPromises()

        expect(modal.props('visible')).toBe(false)
      })

      it('renders every empty text field as blank, never as null or undefined', async () => {
        const w = await mountWith({
          vortitel: null,
          vorname: null,
          nachname: null,
          nachtitel: null,
          couleurname: null,
          nachname_geburt: null,
          adresse_privat_anschrift: null,
          adresse_privat_plz: null,
          adresse_privat_ort: null,
          adresse_privat_land: null,
          adresse_beruf_anschrift: null,
          adresse_beruf_plz: null,
          adresse_beruf_ort: null,
          adresse_beruf_land: null,
          mitgliedschaften: null,
          verbandchargen: null,
          anmerkungen: null,
          arbeitgeber: null,
          taetigkeit: null,
          verstorben: true,
          grabadresse: null,
        })

        expect(w.text()).not.toMatch(/null|undefined/)
        for (const label of ['Vorname', 'Nachname', 'Anmerkungen', 'Grabadresse', 'Tätigkeit']) {
          expect(valueOf(w, label)).toBe('')
        }
      })

      it('gives the family tree empty lists when the API sends no tree', async () => {
        const w = await mountWith({ tree: undefined })
        const modal = w.findComponent({ name: 'FamilyTreeModal' })

        expect(modal.props('ancestry')).toEqual([])
        expect(modal.props('children')).toEqual([])
      })

      it('marks the founder, dismissal and death flags as checked', async () => {
        const w = await mountWith({
          gruender: true,
          entlassen: true,
          verstorben: true,
          entlassungsdatum: '2010-01-01',
          sterbedatum: '2020-01-01',
        })

        const checks = w.findAll('.show-field--check .check-icon').map((c) => c.text())
        expect(checks.slice(0, 3)).toEqual(['☑', '☑', '☑'])
        expect(w.findAll('.check-icon.active').length).toBeGreaterThanOrEqual(3)
      })

      it('falls back to the capitalised org id when the API sends no org label', async () => {
        const w = await mountWith({ org_label: null })

        expect(w.text()).toContain('VBW')
      })

      it('shows a dash for a member without org', async () => {
        const w = await mountWith({ org_id: null, org_label: null })

        expect(w.find('.show-field .show-value').text()).toBe('–')
        expect(buttonsLabelled(w, 'Bearbeiten')).toHaveLength(0)
      })

      it('falls back from the state label to the state id and then to a dash', async () => {
        const stateOf = (w: Awaited<ReturnType<typeof mountWith>>) => valueOf(w, 'Mitgliedstatus')

        expect(stateOf(await mountWith({ state_label: 'Burschiert', state_id: 'bu' }))).toBe(
          'Burschiert',
        )
        expect(stateOf(await mountWith({ state_label: null, state_id: 'bu' }))).toBe('bu')
        expect(stateOf(await mountWith({ state_label: null, state_id: null }))).toBe('–')
      })

      it('shows an unknown delivery value as sent and nothing for no value', async () => {
        const deliveryOf = (w: Awaited<ReturnType<typeof mountWith>>) => valueOf(w, 'Zustellungen')

        expect(deliveryOf(await mountWith({ zustellungen: 'post' }))).toBe('post')
        expect(deliveryOf(await mountWith({ zustellungen: null }))).toBe('')
        expect(deliveryOf(await mountWith({ zustellungen: 'adresse_beruf' }))).toBe('Berufsadresse')
        expect(deliveryOf(await mountWith({ zustellungen: 'deaktiviert' }))).toBe('Deaktiviert')
      })

      it('links the optional phone numbers and the MKV/OGV link when they are set', async () => {
        const w = await mountWith({
          rufnummer_privat: '+4311111',
          rufnummer_beruf: '+4322222',
          mkv_ogv_url: 'https://mkv.example.at',
        })

        expect(w.find('a[href="tel:+4311111"]').exists()).toBe(true)
        expect(w.find('a[href="tel:+4322222"]').exists()).toBe(true)
        const mkv = w.find('a[href="https://mkv.example.at"]')
        expect(mkv.attributes('target')).toBe('_blank')
        expect(mkv.attributes('rel')).toBe('noopener')
      })

      it('renders no link for contact data that is not set', async () => {
        const w = await mountWith({
          email: null,
          url: null,
          rufnummer_mobil: null,
          rufnummer_privat: null,
          rufnummer_beruf: null,
          mkv_ogv_url: null,
        })

        expect(w.find('a[href^="mailto:"]').exists()).toBe(false)
        expect(w.find('a[href^="tel:"]').exists()).toBe(false)
        expect(w.find('a[target="_blank"]').exists()).toBe(false)
      })

      it('shows the address, work and notes fields', async () => {
        const w = await mountWith({
          adresse_beruf_anschrift: 'Amtsweg 2',
          adresse_beruf_plz: '1020',
          adresse_beruf_ort: 'Linz',
          adresse_beruf_land: 'Österreich',
          mitgliedschaften: 'Verein A',
          verbandchargen: 'Charge B',
          anmerkungen: 'Notiz C',
        })

        for (const text of ['Amtsweg 2', '1020', 'Linz', 'Verein A', 'Charge B', 'Notiz C']) {
          expect(w.text()).toContain(text)
        }
      })

      it('shows the honours and keys only when the member has some', async () => {
        const w = await mountWith({ badges: [], keys: [] })

        expect(w.text()).not.toContain('Ehrungen')
        expect(w.text()).not.toContain('Schlüssel')
      })

      it('shows the badge name and date and an empty group as nothing', async () => {
        const w = await mountWith({
          badges: [
            {
              id: 'x',
              name: 'Ehrenband',
              group: null,
              presentationdate: '2001-02-03',
              presentationdate_accuracy: 3,
            },
          ],
        })

        const row = w.findAll('.show-section tbody tr')[0]!
        expect(row.text()).toContain('Ehrenband')
        expect(row.text()).toContain('Februar')
        expect(row.text()).toContain('2001')
      })
    })

    describe('account activity', () => {
      it('shows a dash for the sign-in times that are missing', async () => {
        mockGetMemberAuthActivity.mockResolvedValueOnce({
          data: { auth_lastlogin: null, auth_lastsignal: null, auth_lastlogout: null },
        })
        const w = await mountWith()

        const values = w.findAll('.auth-activity-value').map((v) => v.text())
        expect(values).toEqual(['–', '–', '–'])
      })

      it('shows the times that are present with date and time', async () => {
        const w = await mountWith()

        const values = w.findAll('.auth-activity-value').map((v) => v.text())
        expect(values).toHaveLength(3)
        values.forEach((value) => expect(value).toMatch(/\d{2}\.\d{2}\.2026, \d{2}:\d{2}/))
      })

      it('still shows the profile when the activity cannot be read', async () => {
        mockGetMemberAuthActivity.mockRejectedValueOnce(new Error('boom'))
        const w = await mountWith()

        expect(w.text()).toContain('Max Muster v/o Testikus')
        expect(w.text()).not.toContain('Letzte Aktivität')
      })
    })

    describe('change history', () => {
      const entry = (overrides: Record<string, unknown> = {}) => ({
        id: 'c1',
        modified_at: '2026-08-05T14:32:00Z',
        modified_by_name: 'Admin Alfa',
        action: 'store',
        key: 'vorname',
        old: 'Max',
        new: 'Moritz',
        ...overrides,
      })

      const openHistory = async (w: Awaited<ReturnType<typeof mountWith>>) => {
        await w.find('.changelog-header').trigger('click')
        await flushPromises()
      }

      it('loads nothing until the history is opened', async () => {
        await mountWith()

        expect(mockGetChangelog).not.toHaveBeenCalled()
      })

      it('loads the first page when opened and shows its entries', async () => {
        mockGetChangelog.mockResolvedValue({ data: { items: [entry()], total: 1 } })
        const w = await mountWith()

        await openHistory(w)

        expect(mockGetChangelog).toHaveBeenCalledOnce()
        expect(mockGetChangelog).toHaveBeenCalledWith('member', '1', { page: 1, page_size: 25 })
        const row = w.find('.changelog-section tbody tr')
        expect(row.text()).toContain('Admin Alfa')
        expect(row.text()).toContain('vorname')
        expect(row.text()).toContain('Max')
        expect(row.text()).toContain('Moritz')
        expect(row.text()).toMatch(/\d{2}\.\d{2}\.2026, \d{2}:\d{2}/)
        expect(w.find('.changelog-header i').classes()).toContain('pi-chevron-up')
      })

      it('shows a dash for a missing date and for missing old and new values', async () => {
        mockGetChangelog.mockResolvedValue({
          data: { items: [entry({ modified_at: null, old: null, new: null })], total: 1 },
        })
        const w = await mountWith()

        await openHistory(w)

        const cells = w.findAll('.changelog-section tbody tr td').map((c) => c.text())
        expect(cells[0]).toBe('-')
        expect(cells.filter((c) => c === '-')).toHaveLength(3)
      })

      it('closes the history on the second click without loading it again', async () => {
        mockGetChangelog.mockResolvedValue({ data: { items: [entry()], total: 1 } })
        const w = await mountWith()

        await openHistory(w)
        await openHistory(w)
        expect(w.find('.changelog-section table').exists()).toBe(false)
        expect(w.find('.changelog-header i').classes()).toContain('pi-chevron-down')
        await openHistory(w)

        expect(w.find('.changelog-section table').exists()).toBe(true)
        expect(mockGetChangelog).toHaveBeenCalledOnce()
      })

      it.each([
        ['store', 'success'],
        ['delete', 'danger'],
        ['update', 'info'],
      ])('colours the %s action as %s', async (action, severity) => {
        mockGetChangelog.mockResolvedValue({ data: { items: [entry({ action })], total: 1 } })
        const w = await mountWith()

        await openHistory(w)

        const tag = w.findComponent({ name: 'Tag' })
        expect(tag.props('value')).toBe(action)
        expect(tag.props('severity')).toBe(severity)
      })

      it('offers paging only when there are more entries than fit on a page', async () => {
        mockGetChangelog.mockResolvedValue({ data: { items: [entry()], total: 25 } })
        const w = await mountWith()
        await openHistory(w)
        const single = w.findAllComponents({ name: 'DataTable' }).find((t) => t.props('lazy'))!
        expect(single.props('paginator')).toBe(false)

        const wide = await mountWith()
        mockGetChangelog.mockResolvedValue({ data: { items: [entry()], total: 26 } })
        await openHistory(wide)
        const table = wide.findAllComponents({ name: 'DataTable' }).find((t) => t.props('lazy'))!
        expect(table.props('paginator')).toBe(true)
        expect(table.props('totalRecords')).toBe(26)
      })

      it('loads the requested page when the user pages', async () => {
        mockGetChangelog.mockResolvedValue({ data: { items: [entry()], total: 60 } })
        const w = await mountWith()
        await openHistory(w)

        const table = w.findAllComponents({ name: 'DataTable' }).find((t) => t.props('lazy'))!
        table.vm.$emit('page', { page: 2 })
        await flushPromises()

        expect(mockGetChangelog).toHaveBeenLastCalledWith('member', '1', {
          page: 3,
          page_size: 25,
        })
      })

      it('shows an empty history, not an error, when it cannot be loaded', async () => {
        mockGetChangelog.mockRejectedValue({ response: { status: 403 } })
        const w = await mountWith()

        await openHistory(w)

        expect(w.find('.changelog-section tbody tr td').text()).not.toContain('Admin')
        expect(w.findAllComponents({ name: 'DataTable' }).find((t) => t.props('lazy'))).toBeTruthy()
        expect(w.text()).toContain('Max Muster v/o Testikus')
      })

      it('hides the history from a viewer without the admin role of the member org', async () => {
        const w = await mountWith({ org_id: 'vbn' })

        expect(w.find('.changelog-section').exists()).toBe(false)
        expect(mockGetChangelog).not.toHaveBeenCalled()
      })
    })

    describe('switching to another member', () => {
      it('loads the member of the new route and drops the data of the old one', async () => {
        const w = await mountWith()
        expect(w.text()).toContain('Max Muster v/o Testikus')
        mockGetMember.mockResolvedValue({
          data: { ...fullMemberData, id: '2', cn: 'Anna Beispiel v/o Zweite' },
        })

        await router.push('/standesdb/members/2')
        await flushPromises()

        expect(mockGetMember).toHaveBeenLastCalledWith('2')
        expect(w.text()).toContain('Anna Beispiel v/o Zweite')
        expect(w.text()).not.toContain('Max Muster')
      })

      it('does not show the account activity of the previous member while the new one loads', async () => {
        const w = await mountWith()
        expect(w.find('.auth-activity-section').exists()).toBe(true)
        mockGetMemberAuthActivity.mockReturnValueOnce(new Promise(() => undefined))

        await router.push('/standesdb/members/2')
        await flushPromises()

        expect(w.find('.auth-activity-section').exists()).toBe(false)
      })
    })
  })
})
