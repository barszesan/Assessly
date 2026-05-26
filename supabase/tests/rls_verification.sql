-- RLS Verification Script
-- Run against local Supabase: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_verification.sql

\echo '=== RLS Verification Script ==='
\echo ''

-- Setup: Create two test users in auth.users
DO $$
BEGIN
  -- Clean up any previous test data
  DELETE FROM auth.users WHERE id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  );

  -- Create test user A
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  );

  -- Create test user B
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  );
END $$;

-- Insert test data as postgres (bypasses RLS)
INSERT INTO positions (id, user_id, title, seniority, requirements) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Position A', 'senior', '[]'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Position B', 'mid', '[]'::jsonb);

INSERT INTO candidates (id, position_id, file_name, file_path) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cv_a.pdf', 'cvs/cv_a.pdf'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cv_b.pdf', 'cvs/cv_b.pdf');

INSERT INTO evaluations (id, position_id, candidate_scores, questions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[]'::jsonb, '[]'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '[]'::jsonb, '[]'::jsonb);

\echo '--- Test: User A can only see their own positions ---'

-- Simulate User A
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

DO $$
DECLARE
  row_count int;
BEGIN
  SELECT count(*) INTO row_count FROM positions;
  IF row_count = 1 THEN
    RAISE NOTICE 'PASS: User A sees only 1 position';
  ELSE
    RAISE NOTICE 'FAIL: User A sees % positions (expected 1)', row_count;
  END IF;
END $$;

\echo '--- Test: User A can only see their own candidates ---'

DO $$
DECLARE
  row_count int;
BEGIN
  SELECT count(*) INTO row_count FROM candidates;
  IF row_count = 1 THEN
    RAISE NOTICE 'PASS: User A sees only 1 candidate';
  ELSE
    RAISE NOTICE 'FAIL: User A sees % candidates (expected 1)', row_count;
  END IF;
END $$;

\echo '--- Test: User A can only see their own evaluations ---'

DO $$
DECLARE
  row_count int;
BEGIN
  SELECT count(*) INTO row_count FROM evaluations;
  IF row_count = 1 THEN
    RAISE NOTICE 'PASS: User A sees only 1 evaluation';
  ELSE
    RAISE NOTICE 'FAIL: User A sees % evaluations (expected 1)', row_count;
  END IF;
END $$;

\echo '--- Test: User A cannot insert into User B position ---'

DO $$
BEGIN
  INSERT INTO candidates (id, position_id, file_name, file_path)
  VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'hack.pdf', 'cvs/hack.pdf');
  RAISE NOTICE 'FAIL: User A was able to insert candidate into User B position';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'PASS: User A cannot insert candidate into User B position';
END $$;

\echo '--- Test: User A cannot update User B position ---'

DO $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE positions SET title = 'Hacked' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RAISE NOTICE 'PASS: User A cannot update User B position (0 rows affected)';
  ELSE
    RAISE NOTICE 'FAIL: User A updated % of User B positions', rows_affected;
  END IF;
END $$;

\echo '--- Test: User A cannot delete User B position ---'

DO $$
DECLARE
  rows_affected int;
BEGIN
  DELETE FROM positions WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RAISE NOTICE 'PASS: User A cannot delete User B position (0 rows affected)';
  ELSE
    RAISE NOTICE 'FAIL: User A deleted % of User B positions', rows_affected;
  END IF;
END $$;

\echo '--- Test: User A cannot delete User B candidates ---'

DO $$
DECLARE
  rows_affected int;
BEGIN
  DELETE FROM candidates WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RAISE NOTICE 'PASS: User A cannot delete User B candidate (0 rows affected)';
  ELSE
    RAISE NOTICE 'FAIL: User A deleted % of User B candidates', rows_affected;
  END IF;
END $$;

\echo '--- Test: User A cannot delete User B evaluations ---'

DO $$
DECLARE
  rows_affected int;
BEGIN
  DELETE FROM evaluations WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RAISE NOTICE 'PASS: User A cannot delete User B evaluation (0 rows affected)';
  ELSE
    RAISE NOTICE 'FAIL: User A deleted % of User B evaluations', rows_affected;
  END IF;
END $$;

-- Reset role
RESET ROLE;
RESET request.jwt.claims;

\echo ''
\echo '=== RLS Verification Complete ==='
