-- ============================================================================
-- C9 FASE 1 — Infraestructura para cobro atómico (cobrar_asientos RPC)
-- Proyecto: El Buen Café
-- Ejecutar en Supabase Dashboard > SQL Editor (como postgres / owner).
-- Idempotente: puede re-ejecutarse sin efectos (IF NOT EXISTS / DO NOTHING).
--
-- Contenido:
--   1. Extensión pgcrypto (request_hash SHA-256 de idempotencia).
--   2. Asegurar mesas.mesero_activo_id + mesero virtual 999
--      (DIVERGENCIA FASE 0: la BD en vivo NO tiene esta columna aunque el repo
--      la usa en AccountContext y existe supabase/fix_mesas_rls_ocupacion.sql.
--      Si ese fix ya se aplicó, este bloque es no-op.)
--   3. Asegurar cuentas.referencia_pago (la BD en vivo SÍ la tiene; el repo no.
--      La RPC guarda aquí p_referencia en vez de sobrescribir notas).
--   4. Tabla cobro_idempotencia (Nivel 1 de idempotencia).
--   5. Columna historial_acciones.idempotency_key + UNIQUE
--      (una sola cabecera económica por operación idempotente).
--   6. RLS/permisos: cobro_idempotencia NO escribible desde el cliente.
--
-- NO toca: src/, C5, C3, Realtime, IndexedDB ni ninguna tabla existente
-- (solo ADD COLUMN IF NOT EXISTS, sin UPDATE/DELETE de datos históricos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) pgcrypto para digest(..., 'sha256')
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 2) mesas.mesero_activo_id (pendiente del fix del repo) + mesero virtual 999
--    Requiere la RPC para su cláusula de liberación condicional.
-- ----------------------------------------------------------------------------
ALTER TABLE public.mesas
    ADD COLUMN IF NOT EXISTS mesero_activo_id INTEGER REFERENCES public.meseros(id);

INSERT INTO public.meseros (id, nombre, username, password_hash, rol, activo)
VALUES (999, 'Administrador', 'admin-virtual', 'admin', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- RLS de escritura para mesas (igual que fix_mesas_rls_ocupacion.sql; no-op si
-- ya existe la política completa). Sin esto los UPDATE de estado/liberación
-- se descartan en silencio vía PostgREST.
DROP POLICY IF EXISTS "mesas_select_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_all_policy" ON public.mesas;
CREATE POLICY "mesas_all_policy" ON public.mesas FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3) cuentas.referencia_pago (existe en vivo; se asegura para BDs frescas)
-- ----------------------------------------------------------------------------
ALTER TABLE public.cuentas
    ADD COLUMN IF NOT EXISTS referencia_pago TEXT DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 4) Tabla de idempotencia Nivel 1 (misma clave -> mismo resultado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cobro_idempotencia (
    idempotency_key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    resultado JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cobro_idempotencia IS
    'C9: resultado por operación de cobro idempotente. Solo la escribe la RPC cobrar_asientos (SECURITY DEFINER); nunca el cliente.';

-- RLS: habilitado SIN políticas => denegado todo acceso vía PostgREST
-- (lectura y escritura). Solo el owner / SECURITY DEFINER la toca.
ALTER TABLE public.cobro_idempotencia ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: revocar acceso directo aunque RLS ya lo deniega.
REVOKE ALL ON TABLE public.cobro_idempotencia FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) historial_acciones.idempotency_key (nullable: preserva historial previo)
-- ----------------------------------------------------------------------------
ALTER TABLE public.historial_acciones
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT DEFAULT NULL;

-- UNIQUE para impedir dos cabeceras económicas con la misma clave.
-- (Índice único en vez de constraint: IF NOT EXISTS disponible.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_historial_idempotency_key
    ON public.historial_acciones (idempotency_key);

-- ----------------------------------------------------------------------------
-- 6) Verificación post-migración (solo lectura)
-- ----------------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'cobro_idempotencia';
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'historial_acciones'
--   AND column_name = 'idempotency_key';
