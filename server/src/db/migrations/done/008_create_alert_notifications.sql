CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  house_id VARCHAR(50) NOT NULL,
  room_name VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_alert_notifications_house ON alert_notifications(house_id, created_at DESC);
