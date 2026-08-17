-- ============================================================================
-- NOMBRES DE COMENSALES: columna JSONB seat_config en cuentas
-- Ejecutar en el Supabase SQL Editor:
-- https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
-- ============================================================================

-- Agregar columna seat_config a la tabla cuentas.
-- Formato esperado (JSONB):
-- {
--   "1": { "nombre": "Juan" },
--   "3": { "nombre": "María" }
-- }
-- La clave es el número de asiento (string) y el valor el nombre personalizado.
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS seat_config JSONB DEFAULT NULL;

-- Comentario para documentación en el catálogo de la DB
COMMENT ON COLUMN cuentas.seat_config IS
  'Mapa asiento -> { nombre } para renombrar comensales en la comanda';

-- La política RLS existente (FOR ALL USING (true)) ya cubre esta columna,
-- no se requieren cambios adicionales de seguridad.
