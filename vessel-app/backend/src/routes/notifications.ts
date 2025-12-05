import { Router } from 'express'
import { requireAuth } from '../utils/authMiddleware'
import { listNotifications, dismissNotification } from '../services/notificationService'
import { presentUser } from '../services/userService'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await listNotifications(req.authUser!.id)
    res.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        createdAt: notification.created_at,
        videoId: notification.video_id,
        videoTitle: notification.video_title,
        commentPreview: notification.comment_preview,
        actor: presentUser(notification.actor),
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const notificationId = req.params.id
    await dismissNotification(notificationId, req.authUser!.id)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
