-- Link meetings to Google Calendar events for deletion sync
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id text;
CREATE INDEX IF NOT EXISTS idx_meetings_google_event_id ON meetings(google_event_id) WHERE google_event_id IS NOT NULL;
