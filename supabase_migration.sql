-- ============================================================================
-- MIGRACIÓN: El Buen Café — IndexedDB → Supabase PostgreSQL
-- Ejecutar este script en el SQL Editor de Supabase Dashboard:
-- https://supabase.com/dashboard/project/klrjltzwuzakclfzngbs/sql/new
-- ============================================================================

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

-- Mesas (catálogo estático)
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    numero TEXT NOT NULL UNIQUE,
    capacidad INTEGER NOT NULL DEFAULT 4,
    estado TEXT NOT NULL DEFAULT 'LIBRE'
        CHECK (estado IN ('LIBRE', 'OCUPADA', 'COBRADA')),
    ubicacion TEXT DEFAULT 'Interior',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meseros (personal)
CREATE TABLE IF NOT EXISTS meseros (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'mesero'
        CHECK (rol IN ('mesero', 'admin', 'cocina')),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cuentas (entidad viva — una cuenta por mesa ocupada)
CREATE TABLE IF NOT EXISTS cuentas (
    id SERIAL PRIMARY KEY,
    mesa_id INTEGER NOT NULL REFERENCES mesas(id),
    mesero_id INTEGER NOT NULL REFERENCES meseros(id),
    estado TEXT NOT NULL DEFAULT 'ABIERTA'
        CHECK (estado IN ('ABIERTA', 'COBRADA')),
    total_acumulado DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'electronico')),
    total_pagado DECIMAL(10,2),
    cambio DECIMAL(10,2),
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Minicomandas (comandas enviadas a cocina)
CREATE TABLE IF NOT EXISTS minicomandas (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    mesa_id INTEGER NOT NULL REFERENCES mesas(id),
    mesero_id INTEGER NOT NULL REFERENCES meseros(id),
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'LISTO', 'ENTREGADO')),
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_entrega TIMESTAMPTZ,
    total DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Items de minicomanda (productos dentro de cada comanda)
CREATE TABLE IF NOT EXISTS items_minicomanda (
    id SERIAL PRIMARY KEY,
    minicomanda_id INTEGER NOT NULL REFERENCES minicomandas(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    notas TEXT DEFAULT '',
    total_item DECIMAL(10,2) NOT NULL
);

-- Opciones de items (personalizaciones: ej. "Salsa Verde", "Sin cebolla")
CREATE TABLE IF NOT EXISTS items_opciones (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items_minicomanda(id) ON DELETE CASCADE,
    opcion_nombre TEXT NOT NULL,
    choice_nombre TEXT NOT NULL,
    precio_extra DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Historial de acciones (auditoría completa)
CREATE TABLE IF NOT EXISTS historial_acciones (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER REFERENCES cuentas(id),
    minicomanda_id INTEGER REFERENCES minicomandas(id),
    mesa_id INTEGER REFERENCES mesas(id),
    mesero_id INTEGER REFERENCES meseros(id),
    accion TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    monto DECIMAL(10,2),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Órdenes de cliente (vista cliente — pedidos desde el menú interactivo)
CREATE TABLE IF NOT EXISTS ordenes_cliente (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('local', 'domicilio')),
    table_number TEXT,
    waiter_name TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    address TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('pendiente', 'listo', 'entregado', 'cobrado')),
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    payment_method TEXT CHECK (payment_method IN ('efectivo', 'electronico')),
    paid BOOLEAN NOT NULL DEFAULT false,
    payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usuarios del sistema (para login en mesero/cocina/admin)
CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'mesero', 'cocina', 'repartidor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. DATOS INICIALES (SEED)
-- ============================================================================

-- Mesas iniciales
INSERT INTO mesas (numero, capacidad, ubicacion, estado) VALUES
    ('1', 2, 'Interior', 'LIBRE'),
    ('2', 4, 'Interior', 'LIBRE'),
    ('3', 4, 'Terraza', 'LIBRE'),
    ('4', 6, 'Terraza', 'LIBRE'),
    ('5', 2, 'Barra', 'LIBRE'),
    ('6', 2, 'Barra', 'LIBRE'),
    ('7', 2, 'Barra', 'LIBRE'),
    ('8', 4, 'Terraza', 'LIBRE'),
    ('Barra', 10, 'Barra', 'LIBRE')
ON CONFLICT (numero) DO NOTHING;

-- Meseros iniciales
INSERT INTO meseros (nombre, username, password_hash, rol, activo) VALUES
    ('Carlos Méndez', 'carlos', 'carlos123', 'mesero', true),
    ('Sofía López', 'sofia', 'sofia123', 'mesero', true),
    ('Juan Pérez', 'juan', 'juan123', 'mesero', true),
    ('Admin', 'admin', 'admin123', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Usuarios del sistema (para login)
INSERT INTO usuarios_sistema (username, password, role) VALUES
    ('admin', 'admin', 'admin'),
    ('cocina', 'cocina123', 'cocina'),
    ('carlos', 'carlos123', 'mesero'),
    ('sofia', 'sofia123', 'mesero'),
    ('juan', 'juan123', 'mesero')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 3. ÍNDICES PARA RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cuentas_mesa_id ON cuentas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_mesero_id ON cuentas(mesero_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas(estado);
CREATE INDEX IF NOT EXISTS idx_minicomandas_cuenta_id ON minicomandas(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_minicomandas_mesa_id ON minicomandas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_minicomandas_estado ON minicomandas(estado);
CREATE INDEX IF NOT EXISTS idx_items_minicomanda_id ON items_minicomanda(minicomanda_id);
CREATE INDEX IF NOT EXISTS idx_historial_mesa_id ON historial_acciones(mesa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente_status ON ordenes_cliente(status);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente_created_at ON ordenes_cliente(created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) — Políticas de acceso
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE meseros ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE minicomandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_minicomanda ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;

-- Políticas: Permitir acceso público a tablas de catálogo (lectura)
CREATE POLICY "mesas_select_policy" ON mesas FOR SELECT USING (true);
CREATE POLICY "meseros_all_policy" ON meseros FOR ALL USING (true);

-- Políticas: Acceso completo para operaciones autenticadas (anónimas con RLS)
-- En producción, ajustar según el rol del usuario autenticado
CREATE POLICY "cuentas_all_policy" ON cuentas FOR ALL USING (true);
CREATE POLICY "minicomandas_all_policy" ON minicomandas FOR ALL USING (true);
CREATE POLICY "items_minicomanda_all_policy" ON items_minicomanda FOR ALL USING (true);
CREATE POLICY "items_opciones_all_policy" ON items_opciones FOR ALL USING (true);
CREATE POLICY "historial_all_policy" ON historial_acciones FOR ALL USING (true);
CREATE POLICY "ordenes_cliente_all_policy" ON ordenes_cliente FOR ALL USING (true);
CREATE POLICY "usuarios_sistema_all_policy" ON usuarios_sistema FOR ALL USING (true);

-- NOTA: Las políticas anteriores son permisivas (ALL USING true) para desarrollo.
-- Para producción, se deben restringir por rol. Ejemplo:
-- CREATE POLICY "cuentas_mesero_policy" ON cuentas
--     FOR ALL USING (auth.role() = 'mesero' OR auth.role() = 'admin');

-- ============================================================================
-- 5. MIGRACIÓN: SOPORTE PARA MÚLTIPLES ROLES POR USUARIO
-- ============================================================================

-- 5.1 Modificar tabla meseros: eliminar CHECK constraint y permitir múltiples roles
ALTER TABLE meseros DROP CONSTRAINT IF EXISTS meseros_rol_check;
ALTER TABLE meseros ALTER COLUMN rol TYPE TEXT;
ALTER TABLE meseros ALTER COLUMN rol SET DEFAULT 'mesero';

-- 5.2 Modificar tabla usuarios_sistema: agregar columna 'roles' y migrar datos
-- Primero agregar la columna 'roles' (si no existe)
ALTER TABLE usuarios_sistema ADD COLUMN IF NOT EXISTS roles TEXT;
-- Migrar datos existentes: copiar 'role' a 'roles'
UPDATE usuarios_sistema SET roles = role WHERE roles IS NULL;
-- Eliminar el CHECK constraint de 'role'
ALTER TABLE usuarios_sistema DROP CONSTRAINT IF EXISTS usuarios_sistema_role_check;
-- Hacer que 'role' acepte cualquier texto (para compatibilidad)
ALTER TABLE usuarios_sistema ALTER COLUMN role DROP NOT NULL;

-- 5.3 Actualizar datos iniciales para reflejar múltiples roles (ejemplo)
-- Usuario admin con acceso a todo
UPDATE usuarios_sistema SET roles = 'admin,mesero,cocina' WHERE username = 'admin';
-- Usuario cocina solo con acceso a cocina
UPDATE usuarios_sistema SET roles = 'cocina' WHERE username = 'cocina';
-- Usuarios meseros solo con acceso a mesero
UPDATE usuarios_sistema SET roles = 'mesero' WHERE username IN ('carlos', 'sofia', 'juan');

-- ============================================================================
-- 6. HABILITAR REALTIME (para sincronización en tiempo real)
-- ============================================================================

-- Las tablas que necesitan notificaciones en tiempo real:
-- - minicomandas: cocina recibe nuevas comandas al instante
-- - cuentas: cambios de estado de cuenta
-- - ordenes_cliente: nuevos pedidos desde cliente
ALTER PUBLICATION supabase_realtime ADD TABLE minicomandas;
ALTER PUBLICATION supabase_realtime ADD TABLE cuentas;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_cliente;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios_sistema;
ALTER PUBLICATION supabase_realtime ADD TABLE meseros;
