-- Configuracion general del sitio, editable desde /admin/settings sin deploy
-- (banner, boton de WhatsApp flotante, y extensible a futuras keys sin migracion
-- nueva por cada campo). Mismo patron de RLS que feature_flags: lectura publica
-- (el sitio publico la consume sin sesion), escritura solo platform_admin.

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_config_read" ON site_config FOR SELECT USING (true);
CREATE POLICY "site_config_admin" ON site_config FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO site_config (key, enabled, payload) VALUES
  ('whatsapp_button', false, '{"phone": "", "default_message": "Hola, quiero informacion sobre TuLector", "position": "bottom-right"}'),
  ('banner_home', false, '{"text": "", "link_url": "", "link_label": "", "variant": "info"}')
ON CONFLICT (key) DO NOTHING;
