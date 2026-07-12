-- Secure scan_logs table by restricting SELECT access to platform staff only.
-- This resolves the P0 security leak where scan logs were public.

DROP POLICY IF EXISTS "public_select_logs" ON scan_logs;
DROP POLICY IF EXISTS "staff_select_logs" ON scan_logs;

CREATE POLICY "staff_select_logs" ON scan_logs
  FOR SELECT USING (is_platform_staff());
