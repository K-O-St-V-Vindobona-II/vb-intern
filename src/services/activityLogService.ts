import api from '@/services/api'
import type {
  ActivityDayGroup,
  ActivityLogDetail,
  ActivityMemberDayDetail,
} from '@/types/activityLog'

export default {
  async listDaysWithActivity(year: number, month: number): Promise<ActivityDayGroup[]> {
    const { data } = await api.get('/tracking/activity', { params: { year, month } })
    return data
  },

  async getForMemberDay(memberId: string, day: string): Promise<ActivityMemberDayDetail> {
    const { data } = await api.get(`/tracking/activity/members/${memberId}`, {
      params: { day },
    })
    return data
  },

  async getEntry(id: string): Promise<ActivityLogDetail> {
    const { data } = await api.get(`/tracking/activity/${id}`)
    return data
  },
}
