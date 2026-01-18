import { useState, useEffect, useCallback } from 'react'
import {
  getVapidPublicKey,
  subscribeToNotifications,
  sendTestNotification as apiSendTestNotification,
  urlBase64ToUint8Array
} from '../services/api'

export default function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkExistingSubscription()
    }
  }, [])

  // Check for existing subscription
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()

      if (existingSubscription) {
        setSubscription(existingSubscription)
        setIsSubscribed(true)
      }
    } catch (err) {
      console.error('Error checking subscription:', err)
    }
  }

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== 'granted') {
        throw new Error('Notification permission denied')
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Get VAPID public key from server
      const vapidPublicKey = await getVapidPublicKey()

      // Subscribe to push notifications
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      // Send subscription to backend
      await subscribeToNotifications(pushSubscription.toJSON())

      setSubscription(pushSubscription)
      setIsSubscribed(true)
      setIsLoading(false)

      return { success: true }
    } catch (err) {
      console.error('Subscription error:', err)
      setError(err.message)
      setIsLoading(false)
      return { success: false, error: err.message }
    }
  }, [])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (subscription) {
        await subscription.unsubscribe()
        setSubscription(null)
        setIsSubscribed(false)
      }
      setIsLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Unsubscribe error:', err)
      setError(err.message)
      setIsLoading(false)
      return { success: false, error: err.message }
    }
  }, [subscription])

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!subscription) {
      return { success: false, error: 'Not subscribed' }
    }

    setIsLoading(true)
    setError(null)

    try {
      await apiSendTestNotification(subscription.toJSON())
      setIsLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Test notification error:', err)
      setError(err.message)
      setIsLoading(false)
      return { success: false, error: err.message }
    }
  }, [subscription])

  return {
    isSupported,
    permission,
    isSubscribed,
    subscription,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification
  }
}
