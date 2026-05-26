-- Seniority enum
CREATE TYPE seniority_level AS ENUM ('junior', 'mid', 'senior', 'lead', 'principal');

-- Updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Positions table
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  seniority seniority_level NOT NULL,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Candidates table
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_position_id ON candidates(position_id);

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Evaluations table
CREATE TABLE evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_scores jsonb NOT NULL,
  ranking jsonb,
  all_rejected boolean NOT NULL DEFAULT false,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_position_id_unique UNIQUE (position_id)
);

CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Positions RLS: direct ownership
CREATE POLICY "Users can select own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON positions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON positions FOR DELETE
  USING (auth.uid() = user_id);

-- Candidates RLS: transitive ownership via position
CREATE POLICY "Users can select own candidates"
  ON candidates FOR SELECT
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own candidates"
  ON candidates FOR INSERT
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own candidates"
  ON candidates FOR UPDATE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()))
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own candidates"
  ON candidates FOR DELETE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

-- Evaluations RLS: transitive ownership via position
CREATE POLICY "Users can select own evaluations"
  ON evaluations FOR SELECT
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own evaluations"
  ON evaluations FOR INSERT
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own evaluations"
  ON evaluations FOR UPDATE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()))
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own evaluations"
  ON evaluations FOR DELETE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

-- Storage bucket for CV PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cvs', 'cvs', false, 5242880, ARRAY['application/pdf']);
