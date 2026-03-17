CREATE TABLE IF NOT EXISTS dataset_records (
  selfie_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  consented BOOLEAN NOT NULL DEFAULT FALSE,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence DOUBLE PRECISION,
  model_name TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_records_created_at ON dataset_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_records_tags ON dataset_records USING GIN (tags);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
