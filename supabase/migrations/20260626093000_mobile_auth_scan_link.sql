-- Mobile app auth/profile access and scan quota accounting.

CREATE OR REPLACE FUNCTION is_school_member(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "members_read_school" ON schools;
DROP POLICY IF EXISTS "school_members_read" ON schools;
CREATE POLICY "school_members_read" ON schools
  FOR SELECT USING (is_school_member(id));

DROP POLICY IF EXISTS "members_read_own" ON school_members;
CREATE POLICY "members_read_own" ON school_members
  FOR SELECT USING (user_id = auth.uid() OR is_school_admin(school_id));

DROP POLICY IF EXISTS "admin_manage_members" ON school_members;
CREATE POLICY "admin_manage_members" ON school_members
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

DROP POLICY IF EXISTS "school_quizzes" ON quizzes;
CREATE POLICY "school_quizzes" ON quizzes
  FOR ALL USING (is_school_member(school_id))
  WITH CHECK (is_school_member(school_id));

DROP POLICY IF EXISTS "school_papers" ON papers;
CREATE POLICY "school_papers" ON papers
  FOR ALL USING (is_school_member(school_id))
  WITH CHECK (is_school_member(school_id));

DROP POLICY IF EXISTS "school_students" ON students;
CREATE POLICY "school_students" ON students
  FOR ALL USING (is_school_member(school_id))
  WITH CHECK (is_school_member(school_id));

CREATE OR REPLACE FUNCTION increment_school_scan_usage()
RETURNS TRIGGER AS $$
DECLARE
  current_limit INT;
  current_used INT;
BEGIN
  SELECT scans_limit, scans_used
  INTO current_limit, current_used
  FROM schools
  WHERE id = NEW.school_id
  FOR UPDATE;

  IF current_limit IS NOT NULL AND current_used >= current_limit THEN
    RAISE EXCEPTION 'scan quota exceeded';
  END IF;

  UPDATE schools
  SET scans_used = COALESCE(scans_used, 0) + 1,
      updated_at = NOW()
  WHERE id = NEW.school_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_paper_insert_increment_scan_usage ON papers;
CREATE TRIGGER on_paper_insert_increment_scan_usage
  AFTER INSERT ON papers
  FOR EACH ROW
  EXECUTE FUNCTION increment_school_scan_usage();
