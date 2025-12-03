-- notifications (optional)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- ensure one share row per (note, user) — add constraint only if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_note_share'
  ) THEN
    ALTER TABLE note_shares ADD CONSTRAINT uq_note_share UNIQUE (note_id, user_id);
  END IF;
END
$$;