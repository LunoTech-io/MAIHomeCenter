-- Migration 006: Create alert rules and state tracking tables

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sensor_field VARCHAR(50) NOT NULL,
    operator VARCHAR(10) NOT NULL CHECK (operator IN ('above', 'below')),
    threshold DECIMAL NOT NULL,
    sustained_minutes INT NOT NULL DEFAULT 0,
    notification_title VARCHAR(255) NOT NULL,
    notification_body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rule_state (
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    house_id VARCHAR(50) NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('triggered', 'resolved')),
    triggered_at TIMESTAMP,
    resolved_at TIMESTAMP,
    last_notified_at TIMESTAMP,
    UNIQUE(rule_id, house_id, room_name)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_organization ON alert_rules(organization);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rule_state_rule ON alert_rule_state(rule_id);
