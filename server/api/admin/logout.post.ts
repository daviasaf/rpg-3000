import { clearAdminCookie } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  clearAdminCookie(event)
  return { ok: true }
})

