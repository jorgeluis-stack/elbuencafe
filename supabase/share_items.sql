-- ============================================================================
-- FASE 2: Ítems compartidos entre comensales
-- Ejecutar en el Supabase SQL Editor:
-- https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
-- ============================================================================

-- 1) Permitir que un ítem compartido NO tenga un comensal único asignado.
--    Cuando seat_number es NULL el ítem se considera compartido y su reparto
--    vive en la tabla item_comensal_share.
ALTER TABLE items_minicomanda ALTER COLUMN seat_number DROP NOT NULL;

-- 2) Tabla intermedia de reparto de ítems compartidos.
--    Un registro por cada comensal que comparte un ítem.
CREATE TABLE IF NOT EXISTS item_comensal_share (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items_minicomanda(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL,                 -- comensal que comparte
  porcentaje NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  monto NUMERIC(10,2) NOT NULL DEFAULT 0,       -- importe que le corresponde
  pagado BOOLEAN NOT NULL DEFAULT false,         -- trazabilidad de pago parcial
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_item_comensal_share_item ON item_comensal_share(item_id);
CREATE INDEX IF NOT EXISTS idx_item_comensal_share_seat ON item_comensal_share(seat_number);

-- Habilitar RLS (igual que las demás tablas del sistema, con política abierta)
ALTER TABLE item_comensal_share ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_comensal_share_policy" ON item_comensal_share;
CREATE POLICY "item_comensal_share_policy"
  ON item_comensal_share FOR ALL
  USING (true)
  WITH CHECK (true);

-- Realtime (opcional, para sincronización en vivo entre dispositivos)
ALTER PUBLICATION supabase_realtime ADD TABLE item_comensal_share;
