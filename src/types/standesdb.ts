export interface OrgRef {
  id: string
  label: string
  order: number
}

export interface StateRef {
  id: string
  label: string
  order: number
}

export interface RoleRef {
  id: string
  group: string | null
  label: string | null
  order: number
}

export interface BadgeRef {
  id: string
  name: string
  group: string | null
  order: number
}

export interface KeyRef {
  id: string
  name: string
}

export interface ReferenceData {
  orgs: OrgRef[]
  states: StateRef[]
  roles: RoleRef[]
  badges: BadgeRef[]
  keys: KeyRef[]
}

export interface RoleHistoryEntry {
  id: string
  label?: string | null
  group?: string | null
  order?: number
  startdate: string
  enddate: string | null
}

export interface BadgeEntry {
  id: string
  name?: string
  group?: string | null
  order?: number
  presentationdate: string | null
  presentationdate_accuracy: number
}

export interface KeyEntry {
  id: string
  name?: string
  presentationdate: string | null
  presentationdate_accuracy: number
}

export interface TreeNode {
  id: number
  cn: string
  gruender: boolean
  org_id: string | null
  state_id: string | null
  entlassen: boolean
  verstorben: boolean
  children: TreeNode[]
}

export interface MemberDetail {
  id: number
  cn: string
  vortitel: string | null
  vorname: string | null
  nachname: string | null
  nachname_geburt: string | null
  nachtitel: string | null
  couleurname: string | null
  org_id: string | null
  org_label: string | null
  state_id: string | null
  state_label: string | null
  gruender: boolean
  entlassen: boolean
  verstorben: boolean
  grabadresse: string | null
  parent_id: number
  parent_cn: string
  default_image: number | null
  chroniclemail: boolean
  auth_locked: boolean
  email: string | null
  email_verified_at: string | null
  url: string | null
  mkv_ogv_url: string | null
  zustellungen: string
  rufnummer_mobil: string | null
  rufnummer_privat: string | null
  rufnummer_beruf: string | null
  adresse_privat_anschrift: string | null
  adresse_privat_plz: string | null
  adresse_privat_ort: string | null
  adresse_privat_land: string | null
  adresse_beruf_anschrift: string | null
  adresse_beruf_plz: string | null
  adresse_beruf_ort: string | null
  adresse_beruf_land: string | null
  arbeitgeber: string | null
  taetigkeit: string | null
  mitgliedschaften: string | null
  verbandchargen: string | null
  anmerkungen: string | null
  geburtsdatum: string | null
  geburtsdatum_accuracy: number
  aufnahmedatum: string | null
  aufnahmedatum_accuracy: number
  branderdatum: string | null
  branderdatum_accuracy: number
  burschungsdatum: string | null
  burschungsdatum_accuracy: number
  philistrierungsdatum: string | null
  philistrierungsdatum_accuracy: number
  entlassungsdatum: string | null
  entlassungsdatum_accuracy: number
  sterbedatum: string | null
  sterbedatum_accuracy: number
  roles_history: RoleHistoryEntry[]
  badges: BadgeEntry[]
  keys: KeyEntry[]
  tree: {
    children: TreeNode[]
    ancestry: TreeNode[]
  }
}

export type MemberFormData = Omit<
  MemberDetail,
  'id' | 'cn' | 'org_label' | 'state_label' | 'default_image' | 'email_verified_at' | 'tree'
>

// Self-service subset of MemberFormData - "echte Stammdaten" only. An
// explicit interface (not a derived Omit<MemberFormData, ...>) on purpose:
// a derived type would silently gain any future admin-only field added to
// MemberFormData. Excludes org_id/state_id/gruender/entlassen/verstorben/
// grabadresse/parent_id/auth_locked/chroniclemail (own dedicated toggle in
// ProfileView.vue)/anmerkungen (admin-internal risk)/geburtsdatum(_accuracy)
// and the membership-milestone dates (official record, not something that
// legitimately changes after the fact)/roles_history/badges/keys - all
// admin-only.
export interface MemberSelfServiceFormData {
  vortitel: string | null
  vorname: string | null
  nachname: string | null
  nachname_geburt: string | null
  nachtitel: string | null
  couleurname: string | null
  email: string | null
  url: string | null
  mkv_ogv_url: string | null
  rufnummer_mobil: string | null
  rufnummer_privat: string | null
  rufnummer_beruf: string | null
  zustellungen: string
  adresse_privat_anschrift: string | null
  adresse_privat_plz: string | null
  adresse_privat_ort: string | null
  adresse_privat_land: string | null
  adresse_beruf_anschrift: string | null
  adresse_beruf_plz: string | null
  adresse_beruf_ort: string | null
  adresse_beruf_land: string | null
  arbeitgeber: string | null
  taetigkeit: string | null
  mitgliedschaften: string | null
  verbandchargen: string | null
}

export interface MemberSelfServiceDetail extends MemberSelfServiceFormData {
  id: number
  cn: string
}

export interface MyChangeRequest {
  id: string
  created_at: string | null
  proposed_fields: Record<string, string | number | null>
}

export interface MemberChangeRequestSummary {
  id: string
  member_id: string
  member_cn: string
  member_org_id: string | null
  field_count: number
  created_at: string | null
  updated_at: string | null
}

export interface MemberChangeRequestDiffEntry {
  field: string
  old: string | null
  new: string | null
}

export interface MemberChangeRequestDetail {
  id: string
  member_id: string
  member_cn: string
  status: 'pending' | 'resolved'
  created_at: string | null
  updated_at: string | null
  resolved_at: string | null
  resolved_by_name: string | null
  diff: MemberChangeRequestDiffEntry[]
  field_decisions: Record<string, string> | null
}

export interface MemberDismissed {
  id: number
  cn: string
  org_id: string | null
  dataprotection: string
}

export interface ContactDetail {
  id: number
  cn: string
  kontakttyp: string
  anrede: string | null
  name: string
  couleurname: string | null
  org_id: string | null
  org_label: string | null
  adresse_anschrift: string | null
  adresse_plz: string | null
  adresse_ort: string | null
  adresse_land: string | null
  zustellungen: boolean
  email: string | null
  rufnummer: string | null
  datum: string | null
  datum_accuracy: number
  default_image: number | null
  anmerkungen: string | null
}

export type ContactFormData = Omit<ContactDetail, 'id' | 'cn' | 'org_label' | 'default_image'>

export interface StandesdbImage {
  id: number
  type: string | null
  height: number | null
  width: number | null
  size: number | null
  description: string | null
  default: boolean
}

export interface ImageOwnerRef {
  cn: string
  org_id: string
}

export interface ApiValidationErrorItem {
  msg?: string
  loc?: string[]
}

export interface RoleMemberEntry {
  id: number
  cn: string
  startdate: string
  enddate: string | null
}

export interface RolesListEntry {
  label: string | null
  group: string | null
  vbw: RoleMemberEntry | null
  vbn: RoleMemberEntry | null
}

export interface RolesListResponse {
  semester: string
  year: number
  roles: RolesListEntry[]
}

export interface ExportModule {
  id: string
  label: string
}

export interface ExportConfig {
  modules: ExportModule[]
  orgs: OrgRef[]
  states: StateRef[]
  flags: Record<string, string>
}

export interface SearchResult {
  type: 'member' | 'contact'
  id: number
  label: string
  [key: string]: unknown
}

export interface MemberStats {
  present: Record<string, number>
  dismissed: Record<string, number>
  dead: Record<string, number>
  dismissed_dead: Record<string, number>
}

export interface ContactStats {
  common: number
  vbw: number
  vbn: number
}

export interface Stats {
  member: MemberStats
  contact: ContactStats
}

export interface KeysListMember {
  id: number
  nachname: string | null
  vorname: string | null
  keys: Record<string, boolean>
}

export interface KeysListResponse {
  key_names: string[]
  members: KeysListMember[]
}
