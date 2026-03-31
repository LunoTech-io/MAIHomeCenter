# Surveys

The Surveys section lets you create questionnaires, send them to tenant houses, set up automatic triggers, and review responses.

## Survey List

The main Surveys page shows all your question sets. Each survey card displays:

- **Title** and optional description
- **Question count** — how many questions the survey contains
- **Assignment count** — how many times the survey has been sent
- **Status** — Active or Inactive

### Actions per Survey

| Button | What it does |
|--------|-------------|
| **Send** | Manually send the survey to selected houses |
| **Trigger** | Set up automatic sending based on sensor conditions |
| **Responses** | View all answers from tenants |
| **Edit** | Modify the survey's questions and settings |
| **Delete** | Permanently remove the survey (asks for confirmation) |

---

## Creating a Survey

Click **+ New Survey** to open the survey editor.

### Survey Details

| Field | Required | Description |
|-------|----------|-------------|
| Title | Yes | Name of the survey |
| Description | No | Internal notes about this survey |
| Expires At | No | Date after which the survey is no longer available |
| Allow dismiss | - | When checked, tenants can dismiss without answering |
| Active | - | Only active surveys can be sent and answered |

### Notification Settings

These control what tenants see when they receive the survey notification on their phone:

| Field | Required | Description |
|-------|----------|-------------|
| Notification Title | Yes | Push notification header |
| Notification Body | Yes | Push notification message text |
| Notification URL | No | Where tapping the notification navigates (defaults to "/surveys") |

### Questions

Click **+ Add Question** to add questions. Each question has:

| Field | Description |
|-------|-------------|
| Identifier | A short code for this question (e.g., "q1", "satisfaction") |
| Type | Radio Buttons, Open Text, or Display Text |
| Required | Whether the tenant must answer before submitting |
| Question Text | The actual question shown to the tenant |

#### Question Types

- **Radio Buttons** — Single choice from a list of options. Each option has a Value (stored internally) and a Label (shown to the tenant). You can add or remove options.
- **Open Text** — Free-form text input for the tenant's own words.
- **Display Text** — Informational content only (supports HTML). Not a question — just shows text to the tenant.

#### Reordering and Removing

- Use the **Up/Down** buttons to reorder questions
- Use the **Remove** button to delete a question
- At least one question is recommended before sending

---

## Sending a Survey

Click **Send** on any survey to open the send dialog.

### Selecting Houses

You can select which houses receive the survey in several ways:

1. **Alert Rule Shortcuts** — If alert rules exist, buttons appear showing each rule name and the number of houses that triggered it in the last 30 days. Click to add those houses to your selection.
2. **Select All / Select None** — Quick-select buttons
3. **Individual checkboxes** — Check or uncheck specific houses

The selected count is shown at the bottom.

### Sending

Click **Send to [X] House(s)** to send. The result shows:

- How many assignments were created
- How many notifications were delivered
- How many notifications failed (if any)

> A survey can only be assigned once per house. Sending the same survey to a house that already has it will not create a duplicate.

---

## Survey Triggers

Click **Trigger** on a survey to set up automatic sending based on sensor conditions.

### How Triggers Work

When a trigger is active, the system checks sensor data every 5 minutes. If all conditions are met for a house, the survey is automatically sent to that house with a push notification — just like a manual send.

Once the condition resolves (sensor readings return to normal), the trigger resets and can fire again if conditions are met later.

### Setting Up Conditions

Each condition specifies a sensor reading to watch:

| Field | Options |
|-------|---------|
| Sensor | Temperature, Humidity, CO2, TVOC, Pressure, Light Level |
| Operator | Above or Below |
| Threshold | The comparison value (e.g., 28 for 28 degrees) |

You can add multiple conditions. **All conditions must be true at the same time** (AND logic) for the trigger to fire.

### Sustained Duration

| Value | Behavior |
|-------|----------|
| 0 (default) | Triggers immediately when the latest reading meets all conditions |
| 30+ minutes | Conditions must persist for the specified duration before triggering |

> Sensors report approximately every 15 minutes. For sustained triggers, use at least 30 minutes to ensure at least 2 readings confirm the condition.

### Managing Triggers

- **Active checkbox** — Enable or disable the trigger without deleting it
- **Remove Trigger** — Permanently delete the trigger (asks for confirmation)
- Each survey can have one trigger. Saving a new trigger replaces any existing one.

---

## Viewing Responses

Click **Responses** on a survey to see all answers.

### Summary

Four statistics at the top:

| Stat | Meaning |
|------|---------|
| Total Assigned | Number of houses that received the survey |
| Completed | Houses where the tenant finished the survey |
| Pending | Sent but not yet answered |
| Dismissed | Tenant dismissed without completing |

### Individual Responses

Each house's response is shown as a card with:

- **House ID and name**
- **Status badge** (completed, pending, or dismissed)
- **Answers** (for completed surveys) — each question with the tenant's response
- **Completion timestamp**

If a question was skipped, it shows "No answer" in italics.
