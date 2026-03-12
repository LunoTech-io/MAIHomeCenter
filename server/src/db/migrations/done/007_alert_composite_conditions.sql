-- Migration 007: Replace single sensor_field/operator/threshold with JSONB conditions array
-- Supports composite rules like: temperature > 28 AND humidity < 40

-- Add the new conditions column
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS conditions JSONB;

-- Migrate existing single-condition rules into the conditions array
-- Only runs if sensor_field column still exists (first run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_rules' AND column_name = 'sensor_field'
  ) THEN
    UPDATE alert_rules
    SET conditions = jsonb_build_array(
      jsonb_build_object(
        'sensorField', sensor_field,
        'operator', operator,
        'threshold', threshold
      )
    )
    WHERE conditions IS NULL;
  END IF;
END $$;

-- Make conditions NOT NULL now that all rows have data
ALTER TABLE alert_rules ALTER COLUMN conditions SET NOT NULL;

-- Drop the old single-condition columns
ALTER TABLE alert_rules DROP COLUMN IF EXISTS sensor_field;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS operator;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS threshold;
