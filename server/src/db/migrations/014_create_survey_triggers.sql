-- Survey triggers: automatically send a survey when sensor conditions are met
CREATE TABLE IF NOT EXISTS survey_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  organization VARCHAR(255) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  sustained_minutes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track which house+room combinations have already been sent a survey for a trigger
-- to avoid sending duplicates on every evaluation cycle
CREATE TABLE IF NOT EXISTS survey_trigger_state (
  trigger_id UUID NOT NULL REFERENCES survey_triggers(id) ON DELETE CASCADE,
  house_id VARCHAR(255) NOT NULL,
  room_name VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'triggered',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(trigger_id, house_id, room_name)
);
