ALTER TABLE houses ADD COLUMN IF NOT EXISTS tariff_schedule JSONB;

-- Migrate existing data
UPDATE houses
SET tariff_schedule = jsonb_build_object(
  'mon', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'tue', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'wed', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'thu', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'fri', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'sat', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI')),
  'sun', jsonb_build_object('high', to_char(tariff_high_start, 'HH24:MI'), 'low', to_char(tariff_low_start, 'HH24:MI'))
)
WHERE tariff_high_start IS NOT NULL OR tariff_low_start IS NOT NULL;

ALTER TABLE houses DROP COLUMN IF EXISTS tariff_high_start;
ALTER TABLE houses DROP COLUMN IF EXISTS tariff_low_start;
