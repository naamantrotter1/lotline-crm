-- Add states_serviced column to contacts for tracking which states a contact operates in
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS states_serviced text[] NOT NULL DEFAULT '{}';
