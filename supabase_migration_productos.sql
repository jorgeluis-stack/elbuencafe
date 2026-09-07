-- ============================================================================
-- MIGRACIÓN: El Buen Café — Catálogo de productos (platillos) en Supabase
-- Ejecutar este script en el SQL Editor de Supabase Dashboard:
-- https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
--
-- Habilita:
--   • Tabla `productos` (catálogo vivo gestionado desde el panel de admin)
--   • Realtime en `productos` (cambios visibles al instante en tablets/PCs)
--   • Bucket público `platillos` para subir imágenes desde el admin
-- ============================================================================

-- ============================================================================
-- 1. TABLA DE PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    categoria TEXT NOT NULL DEFAULT 'especiales',
    popular BOOLEAN NOT NULL DEFAULT false,
    imagen_url TEXT,
    opciones JSONB NOT NULL DEFAULT '[]',
    calorias INTEGER,
    tiempo_prep INTEGER,
    picante BOOLEAN NOT NULL DEFAULT false,
    vegetariano BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_clave ON productos(clave);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) — Políticas de acceso
-- ============================================================================

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- Política permisiva (consistente con el resto del proyecto, para desarrollo)
CREATE POLICY "productos_all_policy" ON productos FOR ALL USING (true);

-- ============================================================================
-- 3. REALTIME — sincronización de cambios de menú en todos los dispositivos
-- ============================================================================

ALTER TABLE productos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE productos;

-- ============================================================================
-- 4. STORAGE — bucket público para imágenes de platillos
-- ============================================================================

-- Crear bucket público 'platillos' (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platillos', 'platillos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso al bucket (lectura pública, escritura anónima en desarrollo)
DROP POLICY IF EXISTS "platillos_select_policy" ON storage.objects;
CREATE POLICY "platillos_select_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'platillos');

DROP POLICY IF EXISTS "platillos_insert_policy" ON storage.objects;
CREATE POLICY "platillos_insert_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'platillos');

DROP POLICY IF EXISTS "platillos_update_policy" ON storage.objects;
CREATE POLICY "platillos_update_policy"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'platillos');

DROP POLICY IF EXISTS "platillos_delete_policy" ON storage.objects;
CREATE POLICY "platillos_delete_policy"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'platillos');

-- ============================================================================
-- NOTA: El seed inicial de productos (los platillos actuales de menu.ts) se
-- hace automáticamente desde la app la primera vez que se abre el menú,
-- para que los datos existentes se conserven sin SQL manual adicional.
-- ============================================================================