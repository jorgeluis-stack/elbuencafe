-- ============================================================================
-- FIX: Ocupación y bloqueo de mesas entre meseros
-- ============================================================================
-- Problema diagnosticado (contra la BD en vivo):
--   1. UPDATE en la tabla `mesas` NO persistía: PostgREST respondía 200 pero no
--      modificaba ninguna fila. La causa: la tabla tiene RLS activo y SOLO existe
--      la política "mesas_select_policy" (SELECT). Sin políticas INSERT/UPDATE/
--      DELETE, todos los cambios de estado de mesa se descartan en silencio.
--      (INSERT/UPDATE en `cuentas` sí funcionan, por eso el app creaba cuentas
--      duplicadas sobre mesas que en BD seguían 'LIBRE'.)
--   2. La columna `mesero_activo_id` (que el código usa para bloquear la mesa al
--      mesero que la atiende) nunca se creó en la BD.
--
-- Ejecutar este script COMPLETO en el SQL Editor de Supabase:
--   https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Columna faltante: mesero que tiene la mesa ocupada
-- ----------------------------------------------------------------------------
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS mesero_activo_id INTEGER REFERENCES meseros(id);

-- ----------------------------------------------------------------------------
-- 2) Mesero virtual id=999 para el acceso del Admin como mesero (id 0 -> 999)
--    El código crea cuentas y escribe mesero_activo_id = 999; sin esta fila las
--    FKs (cuentas.mesero_id, mesas.mesero_activo_id) rechazarían la escritura.
-- ----------------------------------------------------------------------------
INSERT INTO meseros (id, nombre, username, password_hash, rol, activo)
VALUES (999, 'Administrador', 'admin-virtual', 'admin', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) Políticas RLS de escritura para `mesas`
--    Se reemplaza la política de solo lectura por una de acceso completo
--    (mismo criterio permisivo que el resto del esquema en desarrollo).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "mesas_select_policy" ON mesas;
DROP POLICY IF EXISTS "mesas_all_policy" ON mesas;
CREATE POLICY "mesas_all_policy" ON mesas FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4) (Opcional pero recomendado) Limpieza de cuentas ABIERTA huérfanas
--    Restos de pruebas con total 0 que hacen aparecer mesas como "ocupadas".
--    Se conserva solo la cuenta ABIERTA más reciente por mesa.
--    4a. VISTA PREVIA — qué registros se van a borrar
-- ----------------------------------------------------------------------------
SELECT c.id, c.mesa_id, c.mesero_id, c.total_acumulado, c.fecha_apertura
FROM cuentas c
JOIN (
    SELECT mesa_id, MAX(id) AS keep_id
    FROM cuentas
    WHERE estado = 'ABIERTA' AND total_acumulado = 0
    GROUP BY mesa_id
) k ON k.mesa_id = c.mesa_id AND c.id <> k.keep_id
WHERE c.estado = 'ABIERTA' AND c.total_acumulado = 0
ORDER BY c.mesa_id, c.id;

--    4b. BORRADO (primero referencias hijas para respetar las FKs)
--        Descomenta las 3 líneas siguientes cuando la vista previa te convenza.
-- WITH borrar AS (
--     SELECT id FROM cuentas
--     WHERE estado = 'ABIERTA' AND total_acumulado = 0
--       AND id NOT IN (
--           SELECT MAX(id) FROM cuentas
--           WHERE estado = 'ABIERTA' AND total_acumulado = 0
--           GROUP BY mesa_id
--       )
-- )
-- DELETE FROM historial_acciones WHERE cuenta_id IN (SELECT id FROM borrar);
-- DELETE FROM minicomandas       WHERE cuenta_id IN (SELECT id FROM borrar);
-- DELETE FROM cuentas            WHERE id IN (SELECT id FROM borrar);

-- ----------------------------------------------------------------------------
-- 5) VERIFICACIÓN POST-FIX — debe devolver filas solo para mesas ocupadas de verdad
--    (SELECT de `mesas` con su estado real tras los cambios)
-- ----------------------------------------------------------------------------
-- SELECT m.id, m.numero, m.estado, m.mesero_activo_id
-- FROM mesas m
-- WHERE m.estado <> 'LIBRE' OR m.mesero_activo_id IS NOT NULL;
