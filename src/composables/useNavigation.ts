import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePermission } from '@/composables/usePermission'

export function useNavigation() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  const mainMenuItems = computed(() => [
    {
      label: 'Standesdatenbank',
      icon: 'pi pi-address-book',
      items: [
        {
          label: 'Einsicht',
          icon: 'pi pi-search',
          command: () => router.push({ name: 'standesdb-dashboard' }),
        },
        {
          label: 'Chargen & Funktionen',
          icon: 'pi pi-list',
          command: () => router.push({ name: 'standesdb-roles' }),
        },
        {
          label: 'Export',
          icon: 'pi pi-download',
          visible: hasPermission('standesdbExport'),
          command: () => router.push({ name: 'standesdb-export' }),
        },
        {
          label: 'Schlüsselliste',
          icon: 'pi pi-key',
          visible: hasPermission('keylist'),
          command: () => router.push({ name: 'standesdb-keys' }),
        },
        {
          label: 'Änderungs-Anträge',
          icon: 'pi pi-file-edit',
          visible: hasPermission('standesdbVbwAdmin') || hasPermission('standesdbVbnAdmin'),
          command: () => router.push({ name: 'standesdb-change-requests' }),
        },
      ],
    },
    {
      label: 'Archiv',
      icon: 'pi pi-folder',
      items: [
        {
          label: 'Einsicht',
          icon: 'pi pi-folder-open',
          command: () => router.push({ name: 'archive-root' }),
        },
        {
          label: 'Upload-Center',
          icon: 'pi pi-upload',
          command: () => router.push({ name: 'archive-upload' }),
        },
      ],
    },
    {
      label: 'Information',
      icon: 'pi pi-info-circle',
      items: [
        {
          label: 'Zahlungsinformationen',
          icon: 'pi pi-credit-card',
          command: () => router.push({ name: 'payment-info' }),
        },
      ],
    },
    {
      label: 'AH-Kassen',
      icon: 'pi pi-wallet',
      visible: hasPermission('p4xView'),
      items: [
        {
          label: 'Konten',
          command: () => router.push({ name: 'p4x-dashboard' }),
        },
        { separator: true },
        {
          label: 'Mitgliedsbeiträge',
          items: [
            {
              label: 'Beitragskonten',
              command: () => router.push({ name: 'p4x-fee-member' }),
            },
            {
              label: 'Saldenliste',
              command: () => router.push({ name: 'p4x-fee-balances' }),
            },
            {
              label: 'Beitragskonfiguration',
              visible: hasPermission('p4xAdmin'),
              command: () => router.push({ name: 'p4x-fee-config' }),
            },
          ],
        },
        { separator: true },
        {
          label: 'Verwaltung',
          visible: hasPermission('p4xAdmin'),
          items: [
            {
              label: 'Abrechnung',
              command: () => router.push({ name: 'p4x-summary' }),
            },
            {
              label: 'Kategorien',
              command: () => router.push({ name: 'p4x-categories' }),
            },
            {
              label: 'Filter',
              command: () => router.push({ name: 'p4x-filters' }),
            },
          ],
        },
        { separator: true },
        {
          label: 'Sum Up',
          items: [
            {
              label: 'Saldo',
              command: () => router.push({ name: 'p4x-sumup' }),
            },
          ],
        },
      ],
    },
    {
      label: 'www-Administration',
      icon: 'pi pi-globe',
      visible: hasPermission('publicContentEditor'),
      items: [
        {
          label: 'Texte',
          icon: 'pi pi-align-left',
          command: () => router.push({ name: 'public-site-texts' }),
        },
        {
          label: 'Video',
          icon: 'pi pi-video',
          command: () => router.push({ name: 'public-site-video' }),
        },
        {
          label: 'Galerie',
          icon: 'pi pi-images',
          command: () => router.push({ name: 'public-site-gallery' }),
        },
        {
          label: 'Programm',
          icon: 'pi pi-calendar',
          command: () => router.push({ name: 'public-site-programm' }),
        },
        {
          label: 'Zitate',
          icon: 'pi pi-comment',
          command: () => router.push({ name: 'public-site-quotes' }),
        },
        {
          label: 'Social Media Verweise',
          icon: 'pi pi-share-alt',
          command: () => router.push({ name: 'public-site-social-links' }),
        },
      ],
    },
    {
      label: 'System',
      icon: 'pi pi-cog',
      visible: hasPermission('systemAdmin'),
      class: 'system-menu-item',
      items: [
        {
          label: 'Versandte Emails',
          icon: 'pi pi-envelope',
          command: () => router.push({ name: 'tracking-sent-emails' }),
        },
        {
          label: 'Email-Vorlagen',
          icon: 'pi pi-list',
          command: () => router.push({ name: 'tracking-email-templates' }),
        },
        {
          label: 'Aktivitätsprotokoll',
          icon: 'pi pi-book',
          command: () => router.push({ name: 'tracking-activity' }),
        },
        {
          label: 'SQL-Einsicht',
          icon: 'pi pi-database',
          command: () => router.push({ name: 'system-sql-browser' }),
        },
        {
          label: 'Scheduler',
          icon: 'pi pi-clock',
          command: () => router.push({ name: 'system-scheduler' }),
        },
      ],
    },
  ])

  return { mainMenuItems, hasPermission }
}
