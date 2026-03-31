# Houses

The Houses section lets you manage tenant installations, view alert summaries, and access detailed sensor dashboards for each house.

## House List

### Filtering

Three filter buttons let you narrow the house list:

| Filter | Shows |
|--------|-------|
| Alerts today | Only houses with alerts in the last 24 hours |
| Alerts this week | Only houses with alerts in the last 7 days |
| All houses | Every house (default) |

Each filter button shows a count badge when there are matching houses.

### House Table

| Column | Description |
|--------|-------------|
| House ID | Unique identifier for the installation |
| Name | Display name (shows "--" if not set) |
| Alerts | Badge showing alert counts for today and this week |
| Organization | The organization the house belongs to |
| Created | Date the house was registered |

### Actions

- **Dashboard** — Open the detailed sensor dashboard for this house
- **Delete** — Remove the house and all its survey assignments (asks for confirmation)

---

## Adding a House

Click **+ Add House** to expand the form.

| Field | Required | Description |
|-------|----------|-------------|
| House ID | Yes | Unique identifier (e.g., "weller1") |
| Password | Yes | Login credentials for the tenant app |
| Name | No | A friendly display name |
| Organization | No | Pre-filled with your organization |

Click **Create House** to add it to the system.

---

## House Dashboard

Click **Dashboard** on any house to see its detailed sensor data. The dashboard auto-refreshes every 5 minutes.

### Status Widgets

A grid of key metrics at the top:

| Widget | Description |
|--------|-------------|
| Avg Temperature | Mean temperature across all monitored rooms |
| Outside Temp | Current exterior temperature (if weather data available) |
| Motion Detected | Number of rooms with active motion |
| Setpoint | Current thermostat target temperature |
| Rooms Monitored | Total number of rooms with sensors |
| Power Draw | Current electricity consumption in watts (if smart meter connected) |
| Gas Meter | Current gas meter reading in m3 (if gas meter connected) |

### Charts

All charts display the last 24 hours of data.

#### Temperature by Room
Line chart showing temperature readings per room. Includes:
- Solid lines for actual room temperatures
- Dashed lines for predicted temperatures (from the ML model)
- Gray dashed line for outside temperature (if available)

#### Temperature vs Setpoint
Compares actual room temperature against the thermostat setpoint for a selected room. If multiple rooms exist, a dropdown lets you switch between them. Shows:
- Actual temperature (solid green line)
- Setpoint (dashed orange line)
- Predicted temperature (dashed green line)

#### Motion Activity
Stacked bar chart showing motion detection events per room over time.

#### Humidity & CO2
Dual-axis line chart (only shown if sensors are present):
- Left axis: Humidity (%) per room
- Right axis: CO2 (ppm) per room

#### Electricity
Line chart showing power draw and return over time (only shown if a smart meter is connected):
- Draw (W) — power consumed
- Return (W) — power fed back to the grid

#### Gas Usage
Line chart showing gas consumption per interval in m3 (only shown if a gas meter is connected).

#### Appliance Power
Line chart showing individual appliance power consumption (only shown if smart plugs are configured). Each appliance gets its own colored line.
