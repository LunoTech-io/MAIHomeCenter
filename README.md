# MAIHomeCenter PWA Dashboard

A mobile-friendly Progressive Web App (PWA) dashboard with home screen installation support and web push notifications.

## Features

- **Progressive Web App** - Installable on mobile devices and desktops
- **Push Notifications** - Real-time notifications using Web Push API
- **Offline Support** - Service worker caching for offline access
- **Responsive Design** - Mobile-first, works on all screen sizes
- **Dark Theme** - Modern dark UI

## Project Structure

```
MAIHomeCenter/
├── client/                    # React PWA (Vite)
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   ├── sw.js              # Service worker
│   │   ├── offline.html       # Offline fallback page
│   │   └── icons/             # App icons
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   └── services/          # API services
│   └── package.json
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── index.js           # Express server
│   │   ├── routes/            # API routes
│   │   └── services/          # Business logic
│   ├── .env.example           # Environment template
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Install client dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Configure VAPID keys:**
   ```bash
   cd server
   cp .env.example .env
   npx web-push generate-vapid-keys
   ```
   Copy the generated keys to your `.env` file.

### Running the App

1. **Start the backend server:**
   ```bash
   cd server
   npm start
   ```
   Server runs at http://localhost:3001

2. **Start the frontend dev server:**
   ```bash
   cd client
   npm run dev
   ```
   App runs at http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/vapid-public-key` | Get VAPID public key |
| POST | `/api/subscribe` | Subscribe to push notifications |
| POST | `/api/unsubscribe` | Unsubscribe from notifications |
| POST | `/api/notify` | Send notification to subscriber |
| POST | `/api/broadcast` | Send notification to all subscribers |
| POST | `/api/test-notification` | Send test notification |
| GET | `/api/stats` | Get subscription statistics |

## Testing Push Notifications

1. Open the app in a supported browser (Chrome, Edge, Firefox)
2. Click "Enable Notifications" and allow permission
3. Click "Send Test Notification"
4. You should receive a push notification

### Test via API (curl)

```bash
# Get stats
curl http://localhost:3001/api/stats

# Broadcast to all subscribers
curl -X POST http://localhost:3001/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello!", "body": "Test broadcast message"}'
```

## PWA Installation

### Mobile (iOS/Android)
1. Open the app in your mobile browser
2. Tap "Add to Home Screen" or use the install banner
3. The app will be installed as a standalone app

### Desktop (Chrome/Edge)
1. Open the app
2. Click the install icon in the address bar
3. Or use the custom install prompt

## Production Deployment

### Build the client:
```bash
cd client
npm run build
```

The built files will be in `client/dist/`.

### Environment Variables (server/.env):
```env
PORT=3001
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

### Security Notes
- HTTPS is required for service workers in production
- Store VAPID keys securely
- Never commit `.env` files to version control

## Browser Support

- Chrome 50+
- Firefox 44+
- Edge 17+
- Safari 11.1+ (limited push notification support)

## Technologies

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Push**: web-push library, Service Worker API
- **PWA**: Web App Manifest, Cache API
