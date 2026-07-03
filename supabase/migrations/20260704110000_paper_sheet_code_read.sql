ALTER TABLE papers ADD COLUMN IF NOT EXISTS sheet_code_read INT;

NOTIFY pgrst, 'reload schema';
