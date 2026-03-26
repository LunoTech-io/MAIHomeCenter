# MAIHomeCenter

A multi-tenant smart home monitoring platform with real-time sensor dashboards, digital twin integration, push notifications, and survey management. Built as a Progressive Web App (PWA) with per-organization access control.

## Architecture

```
MAIHomeCenter/
├── server/           # Node.js/Express API (port 3001)
├── client/           # React PWA — tenant dashboard (port 5173)
├── admin/            # React admin panel (port 5174)
└── ml-server/        # Python/FastAPI ML prediction service (port 8000)
```

**Data flow:** Calculus API → ml-server → server (PostgreSQL) → client/admin dashboards

## Features

- **Real-time sensor dashboards** — temperature, setpoint, and motion (PIR) per room, powered by Recharts
- **Temperature prediction overlays** — ML predictions are shown as dashed continuation lines on the "Temperature by Room" and "Temperature vs Setpoint" charts, providing a 3-hour forecast at 10-minute resolution; houses without predictions render normally
- **Digital twin** — ML server fetches sensor data from Calculus API, stores via twin API, runs PyTorch predictions
- **Multi-tenancy** — 4 organizations (ou, weller, wonenzuid, wonenlimburg) with org-scoped admin access
- **16 monitored houses** — each with per-room sensor history
- **Survey system** — create question sets, assign to houses, collect responses
- **Push notifications** — Web Push API with broadcast and per-house targeting
- **PWA** — installable on mobile/desktop, offline support via service worker

## Prerequisites

- Node.js 18+
- PostgreSQL
- Python 3.10+ (for ml-server)

## Quick Start

### 1. Database Setup

```bash
cd server
cp .env.example .env
# Edit .env — set DATABASE_URL, VAPID keys, JWT_SECRET
```

Run migrations and seed data:

```bash
node src/db/migrate.js
node src/db/seed-admin.js            # creates default admin user
node src/db/seed-houses.js           # seeds 16 houses + 3 org admins
```

### 2. Start the Server

```bash
cd server
npm install
npm run dev
```

Server runs at http://localhost:5801

### 3. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs at http://localhost:5802

### 4. Start the Admin Panel

```bash
cd admin
npm install
npm run dev
```

Admin runs at http://localhost:5803

### 5. Start the ML Server (optional)

```bash
cd ml-server
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set CALCULUS_API_KEY, TWIN_SERVER_URL
uvicorn app.main:app --port 8000
```

## Environment Variables

### server/.env

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5801` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for JWT tokens | dev fallback |
| `VAPID_PUBLIC_KEY` | Web Push public key | — |
| `VAPID_PRIVATE_KEY` | Web Push private key | — |
| `VAPID_SUBJECT` | VAPID email (`mailto:...`) | — |

Generate VAPID keys: `npx web-push generate-vapid-keys`

### ml-server/.env

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | ML server port | `8000` |
| `TWIN_SERVER_URL` | Twin API base URL | `http://localhost:5801` |
| `CALCULUS_API_URL` | External sensor API | `https://api.calculus.group/v3` |
| `CALCULUS_API_KEY` | API key for Calculus | — |
| `PREDICTION_INTERVAL_MINUTES` | Prediction cycle interval | `15` |
| `SENSOR_HISTORY_HOURS` | Hours of history to fetch | `24` |

## Seeded Data

### Houses (16)

| House ID | Name | Organization |
|----------|------|-------------|
| `woning16` | WONING 16 | ou |
| `weller1`–`weller5` | Weller 1–5 | weller |
| `wonenzuid1`–`wonenzuid5` | Wonen Zuid 1–5 | wonenzuid |
| `wonenlimburg1`–`wonenlimburg5` | Wonen in Limburg 1–5 | wonenlimburg |

Default password for all houses: `maihome`

### Admin Users

| Username | Organization | Password |
|----------|-------------|----------|
| `admin` | ou (sees all) | `admin` |
| `weller-admin` | weller | `maihome` |
| `wonenzuid-admin` | wonenzuid | `maihome` |
| `wonenlimburg-admin` | wonenlimburg | `maihome` |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | House login (houseId + password) |
| GET | `/api/auth/me` | Get current house info |
| POST | `/api/auth/admin/login` | Admin login |
| GET | `/api/auth/admin/me` | Get current admin info |

### Digital Twin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/twin/sensor-data` | Store sensor readings (from ml-server) |
| GET | `/api/twin/sensor-data/:houseId` | Get raw sensor history |
| GET | `/api/twin/sensor-data/:houseId/grouped` | Get sensor history grouped by room (for charts) |
| GET | `/api/twin/state/:houseId` | Get latest state per room |
| GET | `/api/twin/meter-data/:houseId` | Get electricity & gas meter history |
| GET | `/api/twin/appliance-data/:houseId` | Get appliance power history |
| GET | `/api/twin/water-data/:houseId` | Get water meter history |
| POST | `/api/twin/predictions` | Store ML prediction |
| GET | `/api/twin/predictions/:houseId/latest` | Get latest prediction |

### Surveys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys/question-sets` | List question sets |
| POST | `/api/surveys/question-sets` | Create question set |
| POST | `/api/surveys/send-survey` | Assign survey to houses |
| GET | `/api/my-surveys/pending` | Get pending surveys (tenant) |
| POST | `/api/my-surveys/:id/respond` | Submit survey responses |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vapid-public-key` | Get VAPID public key |
| POST | `/api/subscribe` | Subscribe to push notifications |
| POST | `/api/broadcast` | Broadcast notification to all |
| GET | `/api/stats` | Subscription statistics |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts/rules` | List rules for admin's organization |
| GET | `/api/alerts/rules/:id` | Get single rule |
| POST | `/api/alerts/rules` | Create rule |
| PUT | `/api/alerts/rules/:id` | Update rule |
| DELETE | `/api/alerts/rules/:id` | Delete rule (cascades state) |

## Database Migrations

Migration files live in `server/src/db/migrations/`:

| File | Description |
|------|-------------|
| `001_create_tables.sql` | Houses, surveys, subscriptions |
| `002_create_twin_tables.sql` | Sensor data, predictions |
| `003_create_admins_and_org.sql` | Admins table, organization column |
| `004_expand_sensor_tables.sql` | Humidity/CO2/TVOC sensor columns, meter/appliance/water tables |
| `005_create_hourly_tables.sql` | Hourly aggregates for sensor, meter, appliance, and water data |
| `006_create_alert_tables.sql` | Alert rules and per-house/room state tracking |
| `007_alert_composite_conditions.sql` | Migrate single-condition rules to JSONB conditions array |

Run all: `node src/db/migrate.js`

## Tech Stack

- **Server**: Node.js, Express, PostgreSQL, bcrypt, JWT, web-push
- **Client/Admin**: React 18, Vite, React Router, Recharts
- **ML Server**: Python, FastAPI, PyTorch, APScheduler, httpx
- **PWA**: Service Worker, Web App Manifest, Cache API

## Production

```bash
# Build frontends
cd client && npm run build    # → client/dist/
cd admin && npm run build     # → admin/dist/

# Start server
cd server && npm start
```

HTTPS is required in production for service workers and push notifications.
