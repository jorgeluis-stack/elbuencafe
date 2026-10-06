-- ============================================================================
-- FASE: Extras por ítem de comanda (item_extras)
-- Ejecutar en el Supabase SQL Editor:
-- https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
-- ============================================================================
-- Cada fila conserva el SNAPSHOT histórico del extra tal como se cobró
-- (nombre + precio). `extra_id` es solo referencia opcional al catálogo
-- `extras` y nunca la única fuente: si el admin cambia el precio o elimina
-- el extra, la comanda histórica sigue mostrando lo que el cliente pidió.
-- Sin FK hacia `extras` a propósito: el DDL del catálogo no vive en este
-- repo y la referencia debe poder quedar huérfana sin romper nada.
-- ============================================================================

-- 1) Tabla hija de items_minicomanda (un registro por cada extra elegido).
CREATE TABLE IF NOT EXISTS item_extras (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items_minicomanda(id) ON DELETE CASCADE,
  extra_id INTEGER NULL,                          -- referencia opcional al catálogo `extras`
  nombre TEXT NOT NULL,                           -- snapshot: nombre al momento del pedido
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,        -- snapshot: precio cobrado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_item_extras_item ON item_extras(item_id);
CREATE INDEX IF NOT EXISTS idx_item_extras_extra ON item_extras(extra_id);

-- Habilitar RLS (igual que las demás tablas hijas, con política abierta)
ALTER TABLE item_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_extras_policy" ON item_extras;
CREATE POLICY "item_extras_policy"
  ON item_extras FOR ALL
  USING (true)
  WITH CHECK (true);

-- Realtime (opcional, para sincronización en vivo entre dispositivos)
ALTER PUBLICATION supabase_realtime ADD TABLE item_extras;
