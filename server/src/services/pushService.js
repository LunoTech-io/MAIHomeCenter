import webpush from 'web-push'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUBSCRIPTIONS_FILE = join(__dirname, '../../subscriptions.json')

class PushService {
  constructor() {
    this.subscriptions = new Map()
    this.initialized = false
    this.loadSubscriptions()
  }

  loadSubscriptions() {
    try {
      if (existsSync(SUBSCRIPTIONS_FILE)) {
        const data = JSON.parse(readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'))
        for (const [key, value] of Object.entries(data)) {
          this.subscriptions.set(key, value)
        }
        console.log(`Loaded ${this.subscriptions.size} subscription(s) from file`)
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error)
    }
  }

  saveSubscriptionsToFile() {
    try {
      const data = Object.fromEntries(this.subscriptions)
      writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error saving subscriptions:', error)
    }
  }

  initialize() {
    if (this.initialized) return

    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@maihomecenter.local'

    if (!publicKey || !privateKey) {
      console.warn('VAPID keys not configured. Run: npx web-push generate-vapid-keys')
      const vapidKeys = webpush.generateVAPIDKeys()
      process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey
      process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey
      console.log('Generated temporary VAPID keys for development:')
      console.log('Public Key:', vapidKeys.publicKey)
      console.log('Private Key:', vapidKeys.privateKey)
      console.log('Add these to your .env file for persistent keys.')
    }

    webpush.setVapidDetails(
      subject,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    this.initialized = true
    console.log('Push service initialized')
  }

  getPublicKey() {
    this.initialize()
    return process.env.VAPID_PUBLIC_KEY
  }

  saveSubscription(subscription) {
    const key = subscription.endpoint
    this.subscriptions.set(key, subscription)
    this.saveSubscriptionsToFile()
    console.log(`Subscription saved. Total subscriptions: ${this.subscriptions.size}`)
    return { success: true, id: key }
  }

  removeSubscription(endpoint) {
    const deleted = this.subscriptions.delete(endpoint)
    if (deleted) {
      this.saveSubscriptionsToFile()
    }
    console.log(`Subscription removed: ${deleted}. Total: ${this.subscriptions.size}`)
    return deleted
  }

  async sendNotification(subscription, payload) {
    this.initialize()

    try {
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      )
      return { success: true, result }
    } catch (error) {
      console.error('Push notification error:', error)

      if (error.statusCode === 410 || error.statusCode === 404) {
        this.removeSubscription(subscription.endpoint)
      }

      return { success: false, error: error.message }
    }
  }

  async broadcastNotification(payload) {
    this.initialize()

    const results = []
    for (const [endpoint, subscription] of this.subscriptions) {
      const result = await this.sendNotification(subscription, payload)
      results.push({ endpoint, ...result })
    }

    return {
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  }

  getSubscriptionCount() {
    return this.subscriptions.size
  }
}

export default new PushService()
