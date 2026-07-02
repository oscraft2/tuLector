-- Guarda el recorte del nombre manuscrito (dataURL JPEG, generado por
-- cropNameBox() en src/tulector/omr.ts) para papers sin RUT o sin match de
-- alumno, permitiendo identificacion manual desde el dashboard.
ALTER TABLE papers ADD COLUMN IF NOT EXISTS name_img_url TEXT;
