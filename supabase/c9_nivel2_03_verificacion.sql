-- ============================================================================
-- c9_nivel2_03_verificacion.sql
-- Fecha: 2026-10-07
--
-- Queries de verificación (solo lectura) para comprobar la migración
-- Nivel 2 aplicada en Supabase. No modifican datos.
-- ============================================================================

-- 1. Conteo de usuarios migrados en auth.users (esperado: 3).
SELECT count(*) AS total_usuarios_migrados
FROM auth.users
WHERE email IN (
  'admin@elbuencafe.local',
  'jorge@elbuencafe.local',
  'javier@elbuencafe.local'
);

-- 2. Profiles migrados con sus roles y mesero_id (esperado: 3 filas).
SELECT id, username, roles, mesero_id, created_at
FROM public.profiles
ORDER BY username;

-- 3. Conteo de identities (esperado: 3).
SELECT count(*) AS total_identities
FROM auth.identities
WHERE user_id IN (
  '41b712ae-3334-4267-8c33-efb981c29b39',
  '35f223a8-e39c-4e30-b91f-153c5a48afcc',
  '6a06fcac-bfe0-4a11-9dfc-1208a9339c59'
);

-- 4. Verificación de passwords con crypt() (placeholder '<PASSWORD>').
--    Sustituir '<PASSWORD>' por la contraseña temporal correspondiente antes
--    de ejecutar. Esperado: 1 fila por usuario si la password coincide.
SELECT id, email
FROM auth.users
WHERE id = '41b712ae-3334-4267-8c33-efb981c29b39'
  AND encrypted_password = crypt('<PASSWORD>', encrypted_password);

SELECT id, email
FROM auth.users
WHERE id = '35f223a8-e39c-4e30-b91f-153c5a48afcc'
  AND encrypted_password = crypt('<PASSWORD>', encrypted_password);

SELECT id, email
FROM auth.users
WHERE id = '6a06fcac-bfe0-4a11-9dfc-1208a9339c59'
  AND encrypted_password = crypt('<PASSWORD>', encrypted_password);
