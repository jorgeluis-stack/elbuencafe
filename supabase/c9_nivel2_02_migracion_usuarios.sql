-- ============================================================================
-- c9_nivel2_02_migracion_usuarios.sql
-- Fecha: 2026-10-07
--
-- NOTA: archivo DOCUMENTAL — refleja la migración YA aplicada en Supabase
-- (proyecto klrjltzwuzakclfzngbs). NO re-ejecutar: los UUIDs y emails ya
-- existen en auth.users. Las contraseñas aquí son placeholder '<PASSWORD>'
-- (el owner cambia en producción).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INSERT en auth.users con los UUIDs REALES migrados.
-- ----------------------------------------------------------------------------

-- admin@elbuencafe.local — 41b712ae-3334-4267-8c33-efb981c29b39
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '41b712ae-3334-4267-8c33-efb981c29b39',
  'authenticated',
  'authenticated',
  'admin@elbuencafe.local',
  '<PASSWORD>',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"admin","roles":"admin,mesero,cocina","mesero_id":4}',
  '', '', '', ''
);

-- jorge@elbuencafe.local — 35f223a8-e39c-4e30-b91f-153c5a48afcc
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '35f223a8-e39c-4e30-b91f-153c5a48afcc',
  'authenticated',
  'authenticated',
  'jorge@elbuencafe.local',
  '<PASSWORD>',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"jorge","roles":"mesero,cocina","mesero_id":19}',
  '', '', '', ''
);

-- javier@elbuencafe.local — 6a06fcac-bfe0-4a11-9dfc-1208a9339c59
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '6a06fcac-bfe0-4a11-9dfc-1208a9339c59',
  'authenticated',
  'authenticated',
  'javier@elbuencafe.local',
  '<PASSWORD>',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"javier","roles":"mesero,cocina","mesero_id":24}',
  '', '', '', ''
);

-- ----------------------------------------------------------------------------
-- 2. INSERT multi-fila en auth.identities con los 3 UUIDs reales y sus emails.
-- ----------------------------------------------------------------------------
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
  (
    '41b712ae-3334-4267-8c33-efb981c29b39',
    '41b712ae-3334-4267-8c33-efb981c29b39',
    '{"sub":"41b712ae-3334-4267-8c33-efb981c29b39","email":"admin@elbuencafe.local"}',
    'email', 'admin@elbuencafe.local', now(), now(), now()
  ),
  (
    '35f223a8-e39c-4e30-b91f-153c5a48afcc',
    '35f223a8-e39c-4e30-b91f-153c5a48afcc',
    '{"sub":"35f223a8-e39c-4e30-b91f-153c5a48afcc","email":"jorge@elbuencafe.local"}',
    'email', 'jorge@elbuencafe.local', now(), now(), now()
  ),
  (
    '6a06fcac-bfe0-4a11-9dfc-1208a9339c59',
    '6a06fcac-bfe0-4a11-9dfc-1208a9339c59',
    '{"sub":"6a06fcac-bfe0-4a11-9dfc-1208a9339c59","email":"javier@elbuencafe.local"}',
    'email', 'javier@elbuencafe.local', now(), now(), now()
  );

-- ----------------------------------------------------------------------------
-- 3. Backfill de mesero_id en public.profiles (ya aplicado en la base).
--    Meseros relacionados: admin=4, jorge=19, javier=24.
-- ----------------------------------------------------------------------------
UPDATE public.profiles SET mesero_id = 4
  WHERE id = '41b712ae-3334-4267-8c33-efb981c29b39';

UPDATE public.profiles SET mesero_id = 19
  WHERE id = '35f223a8-e39c-4e30-b91f-153c5a48afcc';

UPDATE public.profiles SET mesero_id = 24
  WHERE id = '6a06fcac-bfe0-4a11-9dfc-1208a9339c59';

-- Passwords temporales: TempAdmin2026, TempJorge2026, TempJavier2026
-- (cambiar en producción antes de publicar).
