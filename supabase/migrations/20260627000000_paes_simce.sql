-- Migration to add PAES/SIMCE support and automatic score calculation
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS evaluation_type TEXT CHECK (evaluation_type IN ('custom', 'paes', 'simce')) DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS evaluation_variant TEXT;

ALTER TABLE papers
ADD COLUMN IF NOT EXISTS equivalent_score NUMERIC,
ADD COLUMN IF NOT EXISTS grade NUMERIC;

-- Trigger function to automatically calculate grade and equivalent score on insertion/update
CREATE OR REPLACE FUNCTION calculate_paper_results()
RETURNS TRIGGER AS $$
DECLARE
    v_eval_type TEXT;
    v_eval_variant TEXT;
    v_pct DECIMAL;
    v_exigencia DECIMAL := 0.60;
    v_grade_min DECIMAL := 1.0;
    v_grade_max DECIMAL := 7.0;
    v_passing_grade DECIMAL := 4.0;
BEGIN
    -- Get evaluation type and variant from the associated quiz
    SELECT evaluation_type, evaluation_variant
    INTO v_eval_type, v_eval_variant
    FROM quizzes
    WHERE id = NEW.quiz_id;

    IF NEW.total > 0 AND NEW.score IS NOT NULL THEN
        v_pct := NEW.score::DECIMAL / NEW.total::DECIMAL;

        -- 1. Calculate Chilean Grade (1.0 to 7.0)
        IF v_pct >= v_exigencia THEN
            NEW.grade := ROUND(((v_pct - v_exigencia) / (1.0 - v_exigencia)) * (v_grade_max - v_passing_grade) + v_passing_grade, 1);
        ELSE
            NEW.grade := ROUND((v_pct / v_exigencia) * (v_passing_grade - v_grade_min) + v_grade_min, 1);
        END IF;

        -- 2. Calculate Equivalent Score based on evaluation type
        IF v_eval_type = 'paes' THEN
            NEW.equivalent_score := ROUND(100.0 + v_pct * 900.0);
        ELSIF v_eval_type = 'simce' THEN
            NEW.equivalent_score := ROUND(100.0 + v_pct * 300.0);
        ELSE
            -- Custom/Personalizado uses percentage scale (0-100)
            NEW.equivalent_score := ROUND(v_pct * 100.0);
        END IF;
    ELSE
        NEW.grade := NULL;
        NEW.equivalent_score := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_paper_results ON papers;
CREATE TRIGGER trigger_calculate_paper_results
BEFORE INSERT OR UPDATE OF score, total ON papers
FOR EACH ROW
EXECUTE FUNCTION calculate_paper_results();
