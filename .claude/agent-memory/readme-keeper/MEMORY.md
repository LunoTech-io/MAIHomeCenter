# README Keeper Memory

## Project: MAIHomeCenter
Multi-tenant smart home monitoring platform (Node.js + React + Python ML).

## README Structure & Style
- Terse, table-heavy style. API endpoints documented as Method/Endpoint/Description tables.
- Features section uses bold label + em-dash + short description pattern.
- No dedicated "UI Features" or "Dashboard" section; UI features are covered in the Features bullet list.
- Migrations documented in a table under "Database Migrations".
- No screenshots or visual documentation.

## Key Files for README Accuracy
- `server/src/db/migrations/` -- migration files (7 as of March 2026; README now lists all 7)
- `server/src/index.js` -- route mounting (source of truth for API prefixes)
- `admin/src/services/api.js` -- admin API functions (source of truth for API calls)
- `admin/src/components/houses/HouseDashboard.jsx` -- main dashboard component
- `server/src/db/seed-*.js` -- seeding scripts

## Route Mounting (server/src/index.js)
- `/api/twin` -> routes/twin.js
- `/api/alerts` -> routes/alerts.js
- `/api/surveys` -> routes/surveys.js
- `/api/my-surveys` -> routes/tenantSurveys.js
- `/api/auth` -> routes/auth.js
- `/api` -> routes/notifications.js (flat, no sub-prefix)

## Notes
- HouseDashboard component lives at admin/src/components/houses/ (not admin/src/pages/)
