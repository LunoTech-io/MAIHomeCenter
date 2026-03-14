# MAIHomeCenter

## Design Context

### Users
- **Tenants** (primary client app): Residents in managed housing who check home conditions — temperature, humidity, energy use, appliance status. They receive alerts and complete surveys from their property manager. They use the app on mobile (PWA), often casually throughout the day.
- **Property managers / admins** (admin panel): Professionals who manage multiple houses, send notifications, create surveys, and monitor sensor data across properties. They use the admin panel on desktop or tablet.

### Brand Personality
**Friendly, simple, clear.** The interface should feel approachable and easy to understand — no technical jargon, warm tone. Tenants should feel comfortable and informed, not overwhelmed by data. The "M" house logo in green on dark represents home + intelligence.

### Aesthetic Direction
- Current foundation: dark theme with indigo primary (#4f46e5), green/yellow/red/blue semantic accents, 16px rounded cards, system font stack
- **Add light mode** alongside the existing dark theme for daytime use and better accessibility
- Keep the design mobile-first with the existing bottom navigation pattern
- Maintain warmth and friendliness — avoid looking overly techy or clinical
- Use the existing CSS custom property system (`:root` variables) to enable theme switching

### Design Principles
1. **Clarity over cleverness** — Every screen should be immediately understandable. Prefer plain language, obvious icons, and clear data presentation over flashy visualizations.
2. **Mobile-first, always** — The tenant app is a PWA used primarily on phones. Design for touch, thumb reach, and small screens first. Desktop is secondary.
3. **Calm data, not dashboards** — Sensor readings should feel like a gentle status check, not a mission control center. Use color and hierarchy to surface what matters and hide what doesn't.
4. **Accessible by default** — Meet WCAG AA standards. Ensure sufficient contrast in both light and dark modes, support keyboard navigation, and provide screen reader context.
5. **Consistent tokens** — Use CSS custom properties for all colors, spacing, and typography. Both light and dark themes should derive from the same token system.

### Color Tokens (current)
```
--primary-color: #4f46e5 (indigo)
--primary-hover: #4338ca
--bg-dark: #1a1a2e
--bg-card: #16213e
--bg-card-hover: #1f2b4a
--text-primary: #ffffff
--text-secondary: #a0aec0
--accent-green: #10b981
--accent-yellow: #f59e0b
--accent-red: #ef4444
--accent-blue: #3b82f6
```

### Tech Stack
- **Client & Admin**: React 18 + Vite, plain CSS (no framework), Recharts + react-gauge-component
- **Server**: Express.js with JWT auth
- **Deployment**: PWA with service worker, manifest.json configured
