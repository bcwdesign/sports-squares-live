CREATE POLICY "Users can upload their own brand logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own brand logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own brand logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own brand logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);