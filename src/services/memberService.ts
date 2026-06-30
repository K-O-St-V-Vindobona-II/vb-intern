import api from './api'
import type { User } from '@/types/member'

export default {
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/members/me')
    return response.data
  },

  async toggleChronicleMail(): Promise<boolean> {
    const response = await api.patch<{ chroniclemail: boolean }>('/members/me/chroniclemail')
    return response.data.chroniclemail
  },
}
