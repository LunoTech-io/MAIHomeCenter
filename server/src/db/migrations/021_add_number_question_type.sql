-- Allow 'number' as a question type alongside radio / open_text / display.
-- Postgres names the inline CHECK constraint `<table>_<column>_check` by default.
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN ('radio', 'open_text', 'display', 'number'));
