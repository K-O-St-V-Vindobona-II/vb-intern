import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      component: AuthLayout,
      meta: { requiresGuest: true },
      children: [
        {
          path: 'login',
          name: 'login',
          component: () => import('../views/auth/LoginView.vue'),
        },
        {
          path: 'forgot-password',
          name: 'forgot-password',
          component: () => import('../views/auth/ForgotPasswordView.vue'),
        },
        {
          path: 'reset-password',
          name: 'reset-password',
          component: () => import('../views/auth/ResetPasswordView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('../views/ProfileView.vue'),
        },
        {
          path: 'unauthorized',
          name: 'unauthorized',
          component: () => import('../views/UnauthorizedView.vue'),
        },

        // --- Standesdb ---
        {
          path: 'standesdb',
          name: 'standesdb-dashboard',
          component: () => import('../views/standesdb/DashboardView.vue'),
        },
        {
          path: 'standesdb/roles',
          name: 'standesdb-roles',
          component: () => import('../views/standesdb/RolesListView.vue'),
        },
        {
          path: 'standesdb/roles/:year(\\d+)/:semester',
          name: 'standesdb-roles-semester',
          component: () => import('../views/standesdb/RolesListView.vue'),
        },
        {
          path: 'standesdb/export',
          name: 'standesdb-export',
          component: () => import('../views/standesdb/ExportView.vue'),
          meta: {
            requiredPermissions: ['standesdbExport'],
          },
        },
        {
          path: 'standesdb/keys',
          name: 'standesdb-keys',
          component: () => import('../views/standesdb/KeysListView.vue'),
          meta: {
            requiredPermissions: ['keylist'],
          },
        },
        {
          path: 'payment',
          name: 'payment-info',
          component: () => import('../views/PaymentInfoView.vue'),
        },
        {
          path: 'archive',
          name: 'archive-root',
          component: () => import('../views/archive/ArchiveDirView.vue'),
        },
        {
          path: 'archive/dirs/:id(\\d+)',
          name: 'archive-dir',
          component: () => import('../views/archive/ArchiveDirView.vue'),
        },
        {
          path: 'archive/files/:id(\\d+)',
          name: 'archive-file',
          component: () => import('../views/archive/ArchiveFileView.vue'),
        },
        {
          path: 'archive/upload',
          name: 'archive-upload',
          component: () => import('../views/archive/ArchiveUploadView.vue'),
        },
        {
          path: 'standesdb/members/:id(\\d+)',
          name: 'standesdb-member-show',
          component: () => import('../views/standesdb/MemberShowView.vue'),
        },
        {
          path: 'standesdb/members/new',
          name: 'standesdb-member-new',
          component: () => import('../views/standesdb/MemberEditView.vue'),
          meta: {
            requiredPermissions: ['standesdbVbwAdmin', 'standesdbVbnAdmin'],
          },
        },
        {
          path: 'standesdb/members/:id(\\d+)/edit',
          name: 'standesdb-member-edit',
          component: () => import('../views/standesdb/MemberEditView.vue'),
          meta: {
            requiredPermissions: ['standesdbVbwAdmin', 'standesdbVbnAdmin'],
          },
        },
        {
          path: 'standesdb/contacts/:id(\\d+)',
          name: 'standesdb-contact-show',
          component: () => import('../views/standesdb/ContactShowView.vue'),
        },
        {
          path: 'standesdb/contacts/new',
          name: 'standesdb-contact-new',
          component: () => import('../views/standesdb/ContactEditView.vue'),
          meta: {
            requiredPermissions: ['standesdbContactAdmin'],
          },
        },
        {
          path: 'standesdb/contacts/:id(\\d+)/edit',
          name: 'standesdb-contact-edit',
          component: () => import('../views/standesdb/ContactEditView.vue'),
          meta: {
            requiredPermissions: ['standesdbContactAdmin'],
          },
        },
        {
          path: 'standesdb/members/:id(\\d+)/images',
          name: 'standesdb-member-images',
          component: () => import('../views/standesdb/ImageGalleryView.vue'),
        },
        {
          path: 'standesdb/contacts/:id(\\d+)/images',
          name: 'standesdb-contact-images',
          component: () => import('../views/standesdb/ImageGalleryView.vue'),
        },

        // --- P4x (AH-Kassen) ---
        {
          path: 'p4x',
          name: 'p4x-dashboard',
          component: () => import('../views/p4x/DashboardView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/accounts/:accountId(\\d+)/transactions/by-month/:year(\\d+)/:month(\\d+)',
          name: 'p4x-transactions-month',
          component: () => import('../views/p4x/TransactionsByMonthView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/accounts/:accountId(\\d+)/transactions/by-partner',
          name: 'p4x-transactions-partner',
          component: () => import('../views/p4x/TransactionsByPartnerView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/accounts/:accountId(\\d+)/transactions/by-category',
          name: 'p4x-transactions-category',
          component: () => import('../views/p4x/TransactionsByCategoryView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/fee-members/:id(\\d+)?',
          name: 'p4x-fee-member',
          component: () => import('../views/p4x/FeeMemberView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/fee-debtors',
          name: 'p4x-debtors',
          component: () => import('../views/p4x/DebtorsView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },
        {
          path: 'p4x/sumup',
          name: 'p4x-sumup',
          component: () => import('../views/p4x/SumupBalanceView.vue'),
          meta: {
            requiredPermissions: ['p4xView'],
          },
        },

        // --- P4x Admin routes ---
        {
          path: 'p4x/admin/accounts/new',
          name: 'p4x-account-new',
          component: () => import('../views/p4x/AccountFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/accounts/:id(\\d+)/edit',
          name: 'p4x-account-edit',
          component: () => import('../views/p4x/AccountFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/accounts/:accountId(\\d+)/import',
          name: 'p4x-account-import',
          component: () => import('../views/p4x/ImportView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/accounts/:accountId(\\d+)/transactions/by-filter',
          name: 'p4x-transactions-filter',
          component: () => import('../views/p4x/TransactionsByFilterView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/categories',
          name: 'p4x-categories',
          component: () => import('../views/p4x/CategoryListView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/categories/new',
          name: 'p4x-category-new',
          component: () => import('../views/p4x/CategoryFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/categories/:id(\\d+)/edit',
          name: 'p4x-category-edit',
          component: () => import('../views/p4x/CategoryFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/category-filters',
          name: 'p4x-filters',
          component: () => import('../views/p4x/CategoryFilterListView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/category-filters/new',
          name: 'p4x-filter-new',
          component: () => import('../views/p4x/CategoryFilterFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/category-filters/:id(\\d+)/edit',
          name: 'p4x-filter-edit',
          component: () => import('../views/p4x/CategoryFilterFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/category-filters/:id(\\d+)/filter2direct',
          name: 'p4x-filter2direct',
          component: () => import('../views/p4x/Filter2DirectView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/fee-config',
          name: 'p4x-fee-config',
          component: () => import('../views/p4x/FeeConfigView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },
        {
          path: 'p4x/admin/summary',
          name: 'p4x-summary',
          component: () => import('../views/p4x/SummaryFormView.vue'),
          meta: {
            requiredPermissions: ['p4xAdmin'],
          },
        },

        // --- Placeholder routes ---
        {
          path: 'archive',
          name: 'archive',
          component: () => import('../views/PlaceholderView.vue'),
          meta: { moduleName: 'Archiv' },
        },
        {
          path: 'information',
          name: 'information',
          component: () => import('../views/PlaceholderView.vue'),
          meta: { moduleName: 'Information' },
        },
        {
          path: 'tracking/sent-emails',
          name: 'tracking-sent-emails',
          component: () => import('../views/tracking/SentEmailsView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: 'tracking/email-templates',
          name: 'tracking-email-templates',
          component: () => import('../views/tracking/EmailTemplatesView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: 'tracking/activity',
          name: 'tracking-activity',
          component: () => import('../views/tracking/ActivityView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: 'system/sql-browser',
          name: 'system-sql-browser',
          component: () => import('../views/system/SqlBrowserView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: 'system/permission-setup',
          name: 'system-permission-setup',
          component: () => import('../views/system/PermissionSetupView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: 'system/scheduler',
          name: 'system-scheduler',
          component: () => import('../views/system/SchedulerView.vue'),
          meta: { requiredPermissions: ['systemAdmin'] },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('../views/NotFoundView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (
    !authStore.token &&
    !authStore.isRestoringSession &&
    to.matched.some((r) => r.meta.requiresAuth)
  ) {
    const restored = await authStore.restoreSession()
    if (!restored) {
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      }
    }
  }

  if (authStore.token && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch {
      if (to.name !== 'login') {
        return {
          name: 'login',
          query: { redirect: to.fullPath },
        }
      }
    }
  }

  const isAuthenticated = !!authStore.token

  if (to.matched.some((r) => r.meta.requiresAuth) && !isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.matched.some((r) => r.meta.requiresGuest) && isAuthenticated) {
    return { name: 'home' }
  }

  if (to.meta.requiredPermissions) {
    const required = to.meta.requiredPermissions as string[]
    const userPerms = authStore.user?.permissions || []
    const hasAccess = required.some((p) => userPerms.includes(p))
    if (!hasAccess) {
      return { name: 'unauthorized' }
    }
  }

  return true
})

export default router
