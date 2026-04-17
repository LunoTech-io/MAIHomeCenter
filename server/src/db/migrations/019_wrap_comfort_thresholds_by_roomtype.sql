-- Wrap existing flat comfort_thresholds into { default: {...} } so per-room-type overrides can live alongside.
-- Rows already in the new shape (have a `default` key) are left untouched.
UPDATE admins
SET comfort_thresholds = jsonb_build_object('default', comfort_thresholds)
WHERE comfort_thresholds IS NOT NULL
  AND NOT (comfort_thresholds ? 'default');
