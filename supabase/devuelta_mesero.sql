-- Migracion: Agregar estado 'DEVUELTA' a minicomandas
-- Ejecutar en Supabase Dashboard > SQL Editor

ALTER TABLE minicomandas DROP CONSTRAINT IF EXISTS minicomandas_estado_check;
ALTER TABLE minicomandas ADD CONSTRAINT minicomandas_estado_check 
    CHECK (estado IN ('PENDIENTE', 'LISTO', 'ENTREGADO', 'DEVUELTA'));