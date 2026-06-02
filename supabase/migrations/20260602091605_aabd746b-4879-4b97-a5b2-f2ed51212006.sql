DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='patient_media_select') THEN
    CREATE POLICY "patient_media_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'patient-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='patient_media_insert') THEN
    CREATE POLICY "patient_media_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'patient-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='patient_media_update') THEN
    CREATE POLICY "patient_media_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'patient-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='patient_media_delete') THEN
    CREATE POLICY "patient_media_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'patient-media' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;