-- users, notes, note_versions, note_shares, tasks, activity

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  tsv tsvector,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS note_versions (
  id SERIAL PRIMARY KEY,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT,
  title TEXT,
  versioned_at TIMESTAMP DEFAULT now(),
  editor_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS note_shares (
  id SERIAL PRIMARY KEY,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT false,
  granted_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  due_date TIMESTAMP,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  note_id INTEGER REFERENCES notes(id),
  action TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- GIN index for full-text search
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tsv tsvector;
UPDATE notes SET tsv = to_tsvector(coalesce(title,'') || ' ' || coalesce(content,''));
CREATE INDEX IF NOT EXISTS notes_tsv_idx ON notes USING GIN(tsv);

-- Trigger to keep tsv updated
CREATE FUNCTION notes_tsv_trigger() RETURNS trigger AS $$
begin
  new.tsv := to_tsvector(coalesce(new.title,'') || ' ' || coalesce(new.content,''));
  return new;
end
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate ON notes;
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
  ON notes FOR EACH ROW EXECUTE PROCEDURE notes_tsv_trigger();
