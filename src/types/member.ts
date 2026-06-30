export interface User {
  id: number
  email?: string
  vorname?: string
  nachname?: string
  couleurname?: string
  cn: string
  default_image: number | null
  org_id: string
  auth_locked: boolean
  permissions: string[]
  google_linked: boolean
  chroniclemail: boolean
  session_idle_timeout: number
}
