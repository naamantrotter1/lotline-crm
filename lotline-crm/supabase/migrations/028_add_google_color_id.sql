-- Phase 14: Add google_color_id to meetings for calendar color coding
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_color_id text;
