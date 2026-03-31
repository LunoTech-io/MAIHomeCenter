# Notifications

The Notifications page is the home screen of the admin panel. From here you can broadcast push notifications to all tenants who have enabled notifications in their app.

## Subscriber Count

At the top of the page, you'll see the number of **Active Subscribers** — tenants who have notifications enabled. This number updates automatically every minute.

> If the subscriber count is 0, all send buttons are disabled. Tenants need to enable notifications in the client app first.

## Quick Notifications

Three pre-configured notification templates are available for common situations:

| Button | Purpose |
|--------|---------|
| Security Alert | Urgent security-related messages |
| Reminder | General reminders (e.g., thermostat check) |
| System Update | Announce maintenance or updates |

Click any button to instantly send that notification to all subscribers.

## Custom Notification

For personalized messages, use the custom notification form:

| Field | Required | Description |
|-------|----------|-------------|
| Title | Yes | The notification header tenants will see |
| Message | Yes | The main notification text |
| Link URL | No | Where the notification takes the user when tapped (defaults to "/") |

### Sending

1. Fill in the Title and Message fields
2. Optionally set a Link URL
3. Click **Send to [X] Subscriber(s)**
4. A result message will confirm how many notifications were delivered

After a successful send, the form clears automatically.
