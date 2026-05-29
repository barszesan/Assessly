-- Storage RLS policies for the `cvs` bucket.
-- Object paths follow `{user_id}/{position_id}/{filename}`.
-- The first folder segment must equal auth.uid() for the operation to succeed.
-- This was explicitly deferred from the initial schema migration (F-01).

CREATE POLICY "Users can select own cv objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can insert own cv objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own cv objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
