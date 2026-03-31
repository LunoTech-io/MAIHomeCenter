# Alert Rules

Alert rules automatically send push notifications to tenants when sensor readings in their home exceed specified thresholds. Rules are evaluated every 5 minutes.

## Alert Rule List

The main Alerts page shows all your rules in a table:

| Column | Description |
|--------|-------------|
| Name | Rule identifier |
| Condition | Human-readable trigger description (e.g., "Temperature above 28°C AND Humidity below 30% for 30m") |
| Active | Whether the rule is currently enabled |

### Actions

- **+ New Rule** — Create a new alert rule
- **Edit** — Modify an existing rule
- **Delete** — Remove a rule permanently (asks for confirmation)

---

## Creating / Editing a Rule

### Rule Settings

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | A descriptive name for the rule (e.g., "High temperature + low humidity") |
| Sustained Duration | No | How many minutes the condition must persist before triggering (default: 0 = instant) |
| Active | - | Enable or disable the rule without deleting it |

#### Sustained Duration

| Value | Behavior |
|-------|----------|
| 0 | The alert fires as soon as the latest sensor reading meets all conditions |
| 30+ | The conditions must be met in all readings over the specified time window (at least 2 readings required) |

> Sensors report approximately every 15 minutes, so sustained rules should use at least 30 minutes.

### Conditions

Conditions define what sensor readings trigger the alert. Click **+ Add Condition** to add more.

| Field | Options |
|-------|---------|
| Sensor Field | Temperature, Humidity, CO2, TVOC, Pressure, Light Level |
| Operator | Above, Below |
| Threshold | The numeric comparison value |

**All conditions use AND logic** — every condition must be true at the same time for the alert to trigger.

You can remove conditions with the **Remove** button, but at least one condition is always required.

### Notification Template

These fields define what the tenant receives when the alert fires:

| Field | Required | Description |
|-------|----------|-------------|
| Notification Title | Yes | Alert notification header |
| Notification Body | Yes | Alert notification message |

#### Template Variables

You can use these placeholders in the title and body. They are replaced with actual values when the notification is sent:

| Variable | Replaced with |
|----------|--------------|
| `{room}` | The name of the room where the condition was detected |
| `{value}` | The current sensor reading of the first condition |

**Example:**
- Title: `Alert in {room}`
- Body: `Temperature is {value}°C — please check ventilation`

---

## How Alert Evaluation Works

1. Every 5 minutes, the system checks all active rules
2. For each rule, it queries sensor data from all houses in the organization
3. Readings are grouped by room
4. For each room:
   - **Instant rules (0 min):** The latest reading is checked against all conditions
   - **Sustained rules (N min):** All readings in the last N minutes must violate all conditions, with at least 2 readings required
5. If conditions are met and the room is not already in "triggered" state:
   - A push notification is sent to the house
   - The alert is logged in the notification history
   - The room enters "triggered" state
6. If conditions are no longer met and the room is in "triggered" state:
   - The room moves to "resolved" state
   - The rule can trigger again in the future

### Alert Integration with Surveys

Alert rules also appear as **quick-select shortcuts** when sending surveys manually. This lets you quickly target houses that experienced a specific alert in the last 30 days.
