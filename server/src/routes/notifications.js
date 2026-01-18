import { Router } from 'express'
import pushService from '../services/pushService.js'

const router = Router()

// Get VAPID public key for client subscription
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = pushService.getPublicKey()
    res.json({ publicKey })
  } catch (error) {
    console.error('Error getting VAPID public key:', error)
    res.status(500).json({ error: 'Failed to get public key' })
  }
})

// Subscribe to push notifications
router.post('/subscribe', (req, res) => {
  const subscription = req.body

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' })
  }

  try {
    const result = pushService.saveSubscription(subscription)
    res.status(201).json({
      message: 'Subscription saved successfully',
      ...result
    })
  } catch (error) {
    console.error('Error saving subscription:', error)
    res.status(500).json({ error: 'Failed to save subscription' })
  }
})

// Unsubscribe from push notifications
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint required' })
  }

  const deleted = pushService.removeSubscription(endpoint)
  res.json({
    message: deleted ? 'Subscription removed' : 'Subscription not found',
    success: deleted
  })
})

// Send a notification to a specific subscription
router.post('/notify', async (req, res) => {
  const { subscription, title, body, icon, url, actions } = req.body

  if (!subscription) {
    return res.status(400).json({ error: 'Subscription required' })
  }

  const payload = {
    title: title || 'MAIHomeCenter',
    body: body || 'You have a new notification',
    icon: icon || '/icons/icon-192x192.png',
    url: url || '/',
    actions: actions || []
  }

  const result = await pushService.sendNotification(subscription, payload)

  if (result.success) {
    res.json({ message: 'Notification sent', ...result })
  } else {
    res.status(500).json({ error: result.error })
  }
})

// Broadcast notification to all subscribers
router.post('/broadcast', async (req, res) => {
  const { title, body, icon, url, actions } = req.body

  const payload = {
    title: title || 'MAIHomeCenter',
    body: body || 'Broadcast notification',
    icon: icon || '/icons/icon-192x192.png',
    url: url || '/',
    actions: actions || []
  }

  const result = await pushService.broadcastNotification(payload)
  res.json({
    message: `Broadcast complete: ${result.sent} sent, ${result.failed} failed`,
    ...result
  })
})

// Send test notification to a specific subscription
router.post('/test-notification', async (req, res) => {
  const { subscription } = req.body

  if (!subscription) {
    return res.status(400).json({ error: 'Subscription required' })
  }

  const payload = {
    title: 'Test Notification',
    body: 'This is a test notification from MAIHomeCenter!',
    icon: '/icons/icon-192x192.png',
    url: '/'
  }

  const result = await pushService.sendNotification(subscription, payload)

  if (result.success) {
    res.json({ message: 'Test notification sent', success: true })
  } else {
    res.status(500).json({ error: result.error, success: false })
  }
})

// Get subscription stats
router.get('/stats', (req, res) => {
  res.json({
    subscriptions: pushService.getSubscriptionCount()
  })
})

export default router
