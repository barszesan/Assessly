ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_position_id_file_name_key UNIQUE (position_id, file_name);
