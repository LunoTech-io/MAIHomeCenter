-- Add room_types filter to survey triggers and alert rules.
-- Empty array [] means: apply to all rooms (no filter). A non-empty array
-- like ["bedroom","living"] restricts evaluation to rooms whose derived
-- room type is one of those values.
ALTER TABLE survey_triggers
  ADD COLUMN IF NOT EXISTS room_types JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS room_types JSONB NOT NULL DEFAULT '[]'::jsonb;
