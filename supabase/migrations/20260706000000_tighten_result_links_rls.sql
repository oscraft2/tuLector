-- Tighten result_links UPDATE so the post-update row stays inside the same tenant.
DROP POLICY IF EXISTS "admins_update_result_links" ON public.result_links;
CREATE POLICY "admins_update_result_links" ON public.result_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
        AND school_members.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
        AND school_members.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
