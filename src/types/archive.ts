export interface PathEntry {
  id: number
  name: string
}

export interface OrgRef {
  id: string
  label: string
}

export interface StateRef {
  id: string
  label: string
}

export interface StoreItem {
  id: number
  name: string
  description: string | null
  extension: string
  mime_type: string
  size: number
  is_image: boolean
  created_by: string | null
  created_at: string | null
}

export interface Comment {
  id: number
  content: string
  author: string | null
  created_at: string | null
}

export interface DirShort {
  type: 'dir'
  id: number
  name: string
  description: string | null
  created_at: string | null
  deleted_at: string | null
}

export interface FileShort {
  type: 'file'
  id: number
  name: string | null
  extension: string | null
  description: string | null
  size: number
  is_image: boolean
  mime_type: string | null
  created_at: string | null
  deleted_at: string | null
}

export interface DirContent {
  subdirs: {
    insight: DirShort[]
    admin: DirShort[]
    trashed: DirShort[]
  }
  files: {
    insight: FileShort[]
    admin: FileShort[]
    trashed: FileShort[]
  }
}

export interface Permissions {
  effective: string[]
  own: string[]
  parent: string[]
}

export interface Sets {
  orgs: OrgRef[]
  states: StateRef[]
}

export interface DirDetail {
  type: 'dir'
  id: number
  name: string
  description: string | null
  path: PathEntry[]
  permissions: Permissions
  recursive_permissions: boolean
  content: DirContent
  sets: Sets
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface FileDetail {
  type: 'file'
  id: number
  archive_dir_id: number
  name: string | null
  extension: string | null
  description: string | null
  size: number
  is_image: boolean
  mime_type: string | null
  path: PathEntry[]
  active_version: StoreItem | null
  comments: Comment[]
  trashed_comments: Comment[]
  created_at: string | null
  deleted_at: string | null
}

export interface UploadConfig {
  extensions: string[]
  minfilesize: number
  maxfilesize: number
  descminlength: number
  descmaxlength: number
}
