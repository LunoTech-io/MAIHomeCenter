-- Append-only log of point awards per house. A house's total score is
-- SUM(points) over its events. The UNIQUE(house_id, event_type, assignment_id)
-- constraint makes awards idempotent for any event tied to a specific
-- assignment. Event types without an assignment (assignment_id NULL) are
-- allowed to stack, since NULL is never equal in a unique index.
CREATE TABLE IF NOT EXISTS house_point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  assignment_id UUID REFERENCES survey_assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(house_id, event_type, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_house_point_events_house ON house_point_events(house_id);
