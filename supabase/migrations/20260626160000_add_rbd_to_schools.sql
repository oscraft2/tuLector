ALTER TABLE schools ADD COLUMN IF NOT EXISTS rbd text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS institucion_tipo text;
CREATE INDEX IF NOT EXISTS idx_schools_rbd ON schools (rbd);
