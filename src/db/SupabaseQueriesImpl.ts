// src/db/SupabaseQueries.ts - Capa de repositorio Supabase para El Buen Café
// Misma interfaz que Queries.ts pero usando Supabase PostgreSQL en lugar de IndexedDB.
// Para migrar: cambiar imports de '../db/Queries' → '../db/SupabaseQueries'

import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
    Mesa,
    Mesero,
    Cuenta,
    SeatConfig,
    Minicomanda,
    ItemMinicomanda,
    ItemComensalShare,
    ItemOpcion,
    HistorialAccion,
    CarroItem,
    Producto,
    Extra
} from './Schema';

// ============================================================================
// FUNCIONES DE MESAS
// ============================================================================

export const obtenerTodasLasMesas = async (): Promise<Mesa[]> => {
    const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .order('id', { ascending: true });

    if (error) throw new Error(`Error al obtener mesas: ${error.message}`);
    return data as Mesa[];
};

export const sincronizarMesasConfiguradas = async (cantidad: number): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    const mesas = await obtenerTodasLasMesas();

    // Filtrar mesas cuyo numero sea un numero valido para encontrar el máximo
    const numerosActuales = mesas
        .map(m => parseInt(m.numero))
        .filter(n => !isNaN(n));

    const maxActual = numerosActuales.length > 0 ? Math.max(...numerosActuales) : 0;

    if (cantidad > maxActual) {
        const nuevasMesas = [];
        for (let i = maxActual + 1; i <= cantidad; i++) {
            nuevasMesas.push({
                numero: i.toString(),
                capacidad: 4,
                estado: 'LIBRE',
                ubicacion: 'General'
            });
        }

        const { error } = await supabase.from('mesas').insert(nuevasMesas);
        if (error) {
            console.error('Error al sincronizar mesas:', error.message);
        }
    }
};

export const obtenerMesaPorId = async (id: number): Promise<Mesa | undefined> => {
    const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined; // No rows returned
        throw new Error(`Error al obtener mesa: ${error.message}`);
    }
    return data as Mesa;
};

export const obtenerMesaPorNumero = async (numero: string): Promise<Mesa | undefined> => {
    const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('numero', numero)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener mesa: ${error.message}`);
    }
    return data as Mesa;
};

export const actualizarEstadoMesa = async (
    mesaId: number,
    estado: 'LIBRE' | 'OCUPADA' | 'COBRADA'
): Promise<void> => {
    const { error } = await supabase
        .from('mesas')
        .update({ estado })
        .eq('id', mesaId);

    if (error) throw new Error(`Error al actualizar estado de mesa: ${error.message}`);
};

// ============================================================================
// FUNCIONES DE MESEROS
// ============================================================================

export const obtenerTodosLosMeseros = async (): Promise<Mesero[]> => {
    const { data, error } = await supabase
        .from('meseros')
        .select('*')
        .order('id', { ascending: true });

    if (error) throw new Error(`Error al obtener meseros: ${error.message}`);
    return data as Mesero[];
};

export const obtenerMeseroPorId = async (id: number): Promise<Mesero | undefined> => {
    const { data, error } = await supabase
        .from('meseros')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener mesero: ${error.message}`);
    }
    return data as Mesero;
};

export const agregarMesero = async (mesero: Omit<Mesero, 'id'>): Promise<number> => {
    const { data, error } = await supabase
        .from('meseros')
        .insert(mesero)
        .select('id')
        .single();

    if (error) throw new Error(`Error al agregar mesero: ${error.message}`);
    return data.id;
};

export const actualizarMesero = async (mesero: Mesero): Promise<void> => {
    const { error } = await supabase
        .from('meseros')
        .update(mesero)
        .eq('id', mesero.id);

    if (error) throw new Error(`Error al actualizar mesero: ${error.message}`);
};

export const obtenerMeseroPorUsername = async (username: string): Promise<Mesero | undefined> => {
    const { data, error } = await supabase
        .from('meseros')
        .select('*')
        .eq('username', username)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener mesero: ${error.message}`);
    }
    return data as Mesero;
};

export const verificarCredencialesMesero = async (
    username: string,
    password: string
): Promise<Mesero | undefined> => {
    // Obtener el mesero por username, password y activo (sin filtrar por rol exacto)
    const { data, error } = await supabase
        .from('meseros')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .eq('activo', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al verificar credenciales: ${error.message}`);
    }

    // Verificar que el mesero tenga rol 'mesero' o 'admin' (soporta múltiples roles separados por coma)
    const mesero = data as Mesero;
    const roles = mesero.rol.split(',').map(r => r.trim());
    if (roles.includes('mesero') || roles.includes('admin')) {
        return mesero;
    }
    return undefined;
};

// ============================================================================
// FUNCIONES DE CUENTAS
// ============================================================================

export const obtenerTodasLasCuentas = async (): Promise<Cuenta[]> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .order('fecha_apertura', { ascending: false });

    if (error) throw new Error(`Error al obtener cuentas: ${error.message}`);
    return data as Cuenta[];
};

export const obtenerCuentaPorId = async (id: number): Promise<Cuenta | undefined> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener cuenta: ${error.message}`);
    }
    return data as Cuenta;
};

export const obtenerCuentasPorMesa = async (mesaId: number): Promise<Cuenta[]> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('mesa_id', mesaId)
        .order('fecha_apertura', { ascending: false });

    if (error) throw new Error(`Error al obtener cuentas por mesa: ${error.message}`);
    return data as Cuenta[];
};

export const obtenerCuentasPorMesero = async (meseroId: number): Promise<Cuenta[]> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('mesero_id', meseroId)
        .order('fecha_apertura', { ascending: false });

    if (error) throw new Error(`Error al obtener cuentas por mesero: ${error.message}`);
    return data as Cuenta[];
};

export const obtenerCuentasAbiertasPorMesa = async (mesaId: number): Promise<Cuenta[]> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('mesa_id', mesaId)
        .eq('estado', 'ABIERTA')
        .order('fecha_apertura', { ascending: true });

    if (error) throw new Error(`Error al obtener cuentas abiertas por mesa: ${error.message}`);
    return data as Cuenta[];
};

export const obtenerCuentaAbiertaPorMesa = async (mesaId: number): Promise<Cuenta | undefined> => {
    const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('mesa_id', mesaId)
        .eq('estado', 'ABIERTA')
        .order('fecha_apertura', { ascending: false })
        .limit(1);

    if (error) throw new Error(`Error al obtener cuenta abierta: ${error.message}`);

    return data && data.length > 0 ? (data[0] as Cuenta) : undefined;
};

export const crearCuenta = async (cuenta: Omit<Cuenta, 'id' | 'created_at'>): Promise<number> => {
    const { data, error } = await supabase
        .from('cuentas')
        .insert({
            ...cuenta,
            created_at: new Date().toISOString()
        })
        .select('id')
        .single();

    if (error) throw new Error(`Error al crear cuenta: ${error.message}`);
    return data.id;
};

export const actualizarCuenta = async (cuenta: Cuenta): Promise<void> => {
    const { error } = await supabase
        .from('cuentas')
        .update(cuenta)
        .eq('id', cuenta.id);

    if (error) throw new Error(`Error al actualizar cuenta: ${error.message}`);
};

// Actualizar el mapa de nombres de comensales (seat_config) de una cuenta.
// Retorna { success, error? } para que la UI pueda reaccionar ante fallos.
export const actualizarSeatConfig = async (
    cuentaId: number,
    seatConfig: Record<string, SeatConfig>
): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
        .from('cuentas')
        .update({ seat_config: seatConfig })
        .eq('id', cuentaId);

    if (error) {
        console.error('Error actualizando seat_config:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

export const cerrarCuenta = async (
    cuentaId: number,
    totalPagado: number,
    cambio: number,
    metodoPago: 'efectivo' | 'electronico'
): Promise<void> => {
    const { error } = await supabase
        .from('cuentas')
        .update({
            estado: 'COBRADA',
            fecha_cierre: new Date().toISOString(),
            total_pagado: totalPagado,
            cambio: cambio,
            metodo_pago: metodoPago
        })
        .eq('id', cuentaId);

    if (error) throw new Error(`Error al cerrar cuenta: ${error.message}`);
};

export const obtenerCuentasCobradasEnFecha = async (fecha: string): Promise<any[]> => {
    const fechaInicio = `${fecha}T00:00:00.000Z`;
    const fechaFin = `${fecha}T23:59:59.999Z`;

    const { data, error } = await supabase
        .from('cuentas')
        .select(`
            *,
            mesas!inner(numero)
        `)
        .eq('estado', 'COBRADA')
        .gte('fecha_cierre', fechaInicio)
        .lte('fecha_cierre', fechaFin)
        .order('fecha_cierre', { ascending: false });

    if (error) throw new Error(`Error al obtener cuentas cobradas: ${error.message}`);
    return data || [];
};

export const obtenerMinicomandasConItemsPorCuentas = async (cuentaIds: number[]): Promise<any[]> => {
    if (cuentaIds.length === 0) return [];

    const { data, error } = await supabase
        .from('minicomandas')
        .select(`
            *,
            items_minicomanda(*)
        `)
        .in('cuenta_id', cuentaIds);

    if (error) throw new Error(`Error al obtener minicomandas con items: ${error.message}`);
    return data || [];
};

// ============================================================================
// FUNCIONES DE MINICOMANDAS
// ============================================================================

export const obtenerTodasLasMinicomandas = async (): Promise<Minicomanda[]> => {
    const { data, error } = await supabase
        .from('minicomandas')
        .select('*')
        .order('fecha_envio', { ascending: false });

    if (error) throw new Error(`Error al obtener minicomandas: ${error.message}`);
    return data as Minicomanda[];
};

export const obtenerMinicomandaPorId = async (id: number): Promise<Minicomanda | undefined> => {
    const { data, error } = await supabase
        .from('minicomandas')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener minicomanda: ${error.message}`);
    }
    return data as Minicomanda;
};

export const obtenerMinicomandasPorCuenta = async (cuentaId: number): Promise<Minicomanda[]> => {
    const { data, error } = await supabase
        .from('minicomandas')
        .select('*')
        .eq('cuenta_id', cuentaId)
        .order('fecha_envio', { ascending: false });

    if (error) throw new Error(`Error al obtener minicomandas por cuenta: ${error.message}`);
    return data as Minicomanda[];
};

export const obtenerMinicomandasPorMesa = async (mesaId: number): Promise<Minicomanda[]> => {
    const { data, error } = await supabase
        .from('minicomandas')
        .select('*')
        .eq('mesa_id', mesaId)
        .order('fecha_envio', { ascending: false });

    if (error) throw new Error(`Error al obtener minicomandas por mesa: ${error.message}`);
    return data as Minicomanda[];
};

export const crearMinicomanda = async (minicomanda: Omit<Minicomanda, 'id'>): Promise<number> => {
    const { data, error } = await supabase
        .from('minicomandas')
        .insert(minicomanda)
        .select('id')
        .single();

    if (error) throw new Error(`Error al crear minicomanda: ${error.message}`);
    return data.id;
};

export const actualizarMinicomanda = async (minicomanda: Minicomanda): Promise<void> => {
    const { error } = await supabase
        .from('minicomandas')
        .update(minicomanda)
        .eq('id', minicomanda.id);

    if (error) throw new Error(`Error al actualizar minicomanda: ${error.message}`);
};

export const marcarMinicomandaComoListo = async (minicomandaId: number): Promise<void> => {
    const { error } = await supabase
        .from('minicomandas')
        .update({
            estado: 'LISTO',
            fecha_entrega: new Date().toISOString()
        })
        .eq('id', minicomandaId);

    if (error) throw new Error(`Error al marcar minicomanda como listo: ${error.message}`);
};

// ============================================================================
// FUNCIONES DE ITEMS DE MINICOMANDA
// ============================================================================

export const obtenerTodosLosItemsMinicomanda = async (): Promise<ItemMinicomanda[]> => {
    const { data, error } = await supabase
        .from('items_minicomanda')
        .select('*');

    if (error) throw new Error(`Error al obtener items: ${error.message}`);
    return data as ItemMinicomanda[];
};

export const obtenerItemMinicomandaPorId = async (id: number): Promise<ItemMinicomanda | undefined> => {
    const { data, error } = await supabase
        .from('items_minicomanda')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al obtener item: ${error.message}`);
    }
    return data as ItemMinicomanda;
};

export const obtenerItemsPorMinicomanda = async (minicomandaId: number): Promise<ItemMinicomanda[]> => {
    const { data, error } = await supabase
        .from('items_minicomanda')
        .select('*')
        .eq('minicomanda_id', minicomandaId);

    if (error) throw new Error(`Error al obtener items por minicomanda: ${error.message}`);
    return data as ItemMinicomanda[];
};

export const crearItemMinicomanda = async (item: Omit<ItemMinicomanda, 'id'>): Promise<number> => {
    const { data, error } = await supabase
        .from('items_minicomanda')
        .insert(item)
        .select('id')
        .single();

    if (error) throw new Error(`Error al crear item: ${error.message}`);
    return data.id;
};

export const actualizarItemMinicomanda = async (item: ItemMinicomanda): Promise<void> => {
    const { error } = await supabase
        .from('items_minicomanda')
        .update(item)
        .eq('id', item.id);

    if (error) throw new Error(`Error al actualizar item: ${error.message}`);
};

export const actualizarSeatItemMinicomanda = async (
    itemId: number,
    seatNumber: number
): Promise<void> => {
    const { error } = await supabase
        .from('items_minicomanda')
        .update({ seat_number: seatNumber })
        .eq('id', itemId);

    if (error) throw new Error(`Error al actualizar asiento de item: ${error.message}`);
};

export const moverItemACuenta = async (
    itemId: number,
    nuevaMinicomandaId: number
): Promise<void> => {
    const { error } = await supabase
        .from('items_minicomanda')
        .update({ minicomanda_id: nuevaMinicomandaId })
        .eq('id', itemId);

    if (error) throw new Error(`Error al mover item de minicomanda: ${error.message}`);
};

export const eliminarItemMinicomanda = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('items_minicomanda')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Error al eliminar item: ${error.message}`);
};

// ============================================================================
// FUNCIONES DE REPARTO DE ÍTEMS COMPARTIDOS (item_comensal_share)
// ============================================================================

export const crearItemComensalShare = async (
    share: Omit<ItemComensalShare, 'id' | 'created_at'>
): Promise<number> => {
    const { data, error } = await supabase
        .from('item_comensal_share')
        .insert(share)
        .select('id')
        .single();
    if (error) throw new Error(`Error al crear share: ${error.message}`);
    return data.id;
};

export const obtenerSharesPorItem = async (itemId: number): Promise<ItemComensalShare[]> => {
    const { data, error } = await supabase
        .from('item_comensal_share')
        .select('*')
        .eq('item_id', itemId);
    if (error) throw new Error(`Error al obtener shares: ${error.message}`);
    return (data as ItemComensalShare[]) || [];
};

export const obtenerSharesPendientesPorAsiento = async (
    itemId: number,
    seatNumber: number
): Promise<ItemComensalShare[]> => {
    const { data, error } = await supabase
        .from('item_comensal_share')
        .select('*')
        .eq('item_id', itemId)
        .eq('seat_number', seatNumber)
        .eq('pagado', false);
    if (error) throw new Error(`Error al obtener shares pendientes: ${error.message}`);
    return (data as ItemComensalShare[]) || [];
};

export const actualizarShare = async (share: ItemComensalShare): Promise<void> => {
    const { error } = await supabase
        .from('item_comensal_share')
        .update({
            seat_number: share.seat_number,
            porcentaje: share.porcentaje,
            monto: share.monto,
            pagado: share.pagado
        })
        .eq('id', share.id);
    if (error) throw new Error(`Error al actualizar share: ${error.message}`);
};

export const marcarSharePagado = async (shareId: number, pagado: boolean): Promise<void> => {
    const { error } = await supabase
        .from('item_comensal_share')
        .update({ pagado })
        .eq('id', shareId);
    if (error) throw new Error(`Error al marcar share: ${error.message}`);
};

export const eliminarSharesPorItem = async (itemId: number): Promise<void> => {
    const { error } = await supabase
        .from('item_comensal_share')
        .delete()
        .eq('item_id', itemId);
    if (error) throw new Error(`Error al eliminar shares: ${error.message}`);
};

// Un ítem compartido está "liquidado" cuando TODOS sus shares están pagados.
// NO se elimina de la BD; las consultas de ítems activos lo ignoran.
export const itemCompartidoLiquidado = async (itemId: number): Promise<boolean> => {
    const shares = await obtenerSharesPorItem(itemId);
    if (shares.length === 0) return false; // no es compartido
    return shares.every(s => s.pagado);
};

/**
 * Obtener subtotales por asiento (comensal) para una cuenta.
 * Devuelve un mapa seat_number -> total acumulado de sus items.
 */
export const obtenerSubtotalesPorAsiento = async (
    cuentaId: number
): Promise<{ seat_number: number; total: number; items: ItemMinicomanda[] }[]> => {
    // Obtener minicomandas de la cuenta
    const minicomandas = await obtenerMinicomandasPorCuenta(cuentaId);
    const minicomandaIds = minicomandas.map(m => m.id);
    if (minicomandaIds.length === 0) return [];

    // Obtener los items de cada minicomanda (funciona en Supabase y fallback local)
    const itemsPromesas = minicomandas.map(m => obtenerItemsPorMinicomanda(m.id));
    const itemsArrays = await Promise.all(itemsPromesas);
    const itemsDeLaCuenta = itemsArrays.flat();

    // Agrupar por seat_number
    const mapa = new Map<number, { seat_number: number; total: number; items: ItemMinicomanda[] }>();
    for (const it of itemsDeLaCuenta) {
        const seat = it.seat_number || 1;
        if (!mapa.has(seat)) {
            mapa.set(seat, { seat_number: seat, total: 0, items: [] });
        }
        const entrada = mapa.get(seat)!;
        entrada.total += it.total_item;
        entrada.items.push(it);
    }

    return Array.from(mapa.values()).sort((a, b) => a.seat_number - b.seat_number);
};

// ============================================================================
// FUNCIONES DE ITEMS OPCIONES
// ============================================================================

export const obtenerTodasLasOpciones = async (): Promise<ItemOpcion[]> => {
    const { data, error } = await supabase
        .from('items_opciones')
        .select('*');

    if (error) throw new Error(`Error al obtener opciones: ${error.message}`);
    return data as ItemOpcion[];
};

export const obtenerOpcionesPorItem = async (itemId: number): Promise<ItemOpcion[]> => {
    const { data, error } = await supabase
        .from('items_opciones')
        .select('*')
        .eq('item_id', itemId);

    if (error) throw new Error(`Error al obtener opciones por item: ${error.message}`);
    return data as ItemOpcion[];
};

export const crearOpcion = async (opcion: Omit<ItemOpcion, 'id'>): Promise<number> => {
    const { data, error } = await supabase
        .from('items_opciones')
        .insert(opcion)
        .select('id')
        .single();

    if (error) throw new Error(`Error al crear opción: ${error.message}`);
    return data.id;
};

export const crearMultiplesOpciones = async (opciones: Omit<ItemOpcion, 'id'>[]): Promise<number[]> => {
    const { data, error } = await supabase
        .from('items_opciones')
        .insert(opciones)
        .select('id');

    if (error) throw new Error(`Error al crear opciones: ${error.message}`);
    return data.map((row: { id: number }) => row.id);
};

// ============================================================================
// FUNCIONES DE HISTORIAL DE ACCIONES
// ============================================================================

export const obtenerTodoElHistorial = async (): Promise<HistorialAccion[]> => {
    const { data, error } = await supabase
        .from('historial_acciones')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) throw new Error(`Error al obtener historial: ${error.message}`);
    return data as HistorialAccion[];
};

export const obtenerHistorialPorCuenta = async (cuentaId: number): Promise<HistorialAccion[]> => {
    const { data, error } = await supabase
        .from('historial_acciones')
        .select('*')
        .eq('cuenta_id', cuentaId)
        .order('fecha', { ascending: false });

    if (error) throw new Error(`Error al obtener historial por cuenta: ${error.message}`);
    return data as HistorialAccion[];
};

export const obtenerHistorialPorMesa = async (mesaId: number): Promise<HistorialAccion[]> => {
    const { data, error } = await supabase
        .from('historial_acciones')
        .select('*')
        .eq('mesa_id', mesaId)
        .order('fecha', { ascending: false });

    if (error) throw new Error(`Error al obtener historial por mesa: ${error.message}`);
    return data as HistorialAccion[];
};

export const obtenerHistorialPorMesero = async (meseroId: number): Promise<HistorialAccion[]> => {
    const { data, error } = await supabase
        .from('historial_acciones')
        .select('*')
        .eq('mesero_id', meseroId)
        .order('fecha', { ascending: false });

    if (error) throw new Error(`Error al obtener historial por mesero: ${error.message}`);
    return data as HistorialAccion[];
};

export const crearHistorialAccion = async (
    accion: Omit<HistorialAccion, 'id' | 'fecha'>
): Promise<number> => {
    const { data, error } = await supabase
        .from('historial_acciones')
        .insert({
            ...accion,
            fecha: new Date().toISOString()
        })
        .select('id')
        .single();

    if (error) throw new Error(`Error al crear historial: ${error.message}`);
    return data.id;
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Obtener estado completo de una mesa (cuenta abierta, minicomandas, items).
 */
export const obtenerEstadoMesaCompleto = async (mesaId: number): Promise<{
    mesa: Mesa;
    cuenta?: Cuenta;
    minicomandas: Minicomanda[];
    items: ItemMinicomanda[];
}> => {
    const mesa = await obtenerMesaPorId(mesaId);
    if (!mesa) throw new Error('Mesa no encontrada');

    // Obtener TODAS las cuentas de la mesa (no solo la abierta)
    const cuentas = await obtenerCuentasPorMesa(mesaId);

    // Obtener la cuenta abierta actual (si existe)
    const cuentaAbierta = cuentas.find(c => c.estado === 'ABIERTA');

    // Obtener TODAS las minicomandas de TODAS las cuentas de la mesa
    const minicomandasPromises = cuentas.map(c => obtenerMinicomandasPorCuenta(c.id));
    const minicomandasArrays = await Promise.all(minicomandasPromises);
    const minicomandas = minicomandasArrays.flat();

    // Obtener todos los items de todas las minicomandas
    const itemsPromises = minicomandas.map(m => obtenerItemsPorMinicomanda(m.id));
    const itemsArray = await Promise.all(itemsPromises);
    const items = itemsArray.flat();

    return { mesa, cuenta: cuentaAbierta, minicomandas, items };
};

/**
 * Calcular total de una cuenta sumando todos los items de sus minicomandas.
 * Ignora los ítems compartidos que ya están liquidados (todos sus shares pagados).
 */
export const calcularTotalCuenta = async (cuentaId: number): Promise<number> => {
    const minicomandas = await obtenerMinicomandasPorCuenta(cuentaId);
    const itemsPromises = minicomandas.map(m => obtenerItemsPorMinicomanda(m.id));
    const itemsArray = await Promise.all(itemsPromises);
    const items = itemsArray.flat();

    let total = 0;
    for (const item of items) {
        // Ítem compartido liquidado -> no suma (se mantiene en BD por trazabilidad)
        if (item.seat_number === null) {
            const liquidado = await itemCompartidoLiquidado(item.id);
            if (liquidado) continue;
        }
        total += item.total_item;
    }
    return total;
};

/**
 * Obtener productos desde localStorage (compatible con el sistema actual).
 * Los productos son datos estáticos del menú, no requieren BD.
 */
export const obtenerProductos = async (): Promise<Producto[]> => {
    const savedProducts = localStorage.getItem('elbuencafe_products');
    if (savedProducts) {
        return JSON.parse(savedProducts) as Producto[];
    }
    // Cargar productos desde el archivo menu.ts
    const { PRODUCTS } = await import('../data/menu');
    localStorage.setItem('elbuencafe_products', JSON.stringify(PRODUCTS));
    return PRODUCTS as Producto[];
};

// ============================================================================
// FUNCIONES DE CARRO LOCAL (permanecen en localStorage — el carro es temporal)
// ============================================================================

const CARRO_PREFIX = 'elbuencafe_carro_';

export const guardarCarroLocal = async (mesaId: number, carro: CarroItem[]): Promise<void> => {
    localStorage.setItem(`${CARRO_PREFIX}${mesaId}`, JSON.stringify(carro));
};

export const obtenerCarroLocal = async (mesaId: number): Promise<CarroItem[] | undefined> => {
    const saved = localStorage.getItem(`${CARRO_PREFIX}${mesaId}`);
    if (saved) {
        try {
            return JSON.parse(saved) as CarroItem[];
        } catch {
            return undefined;
        }
    }
    return undefined;
};

export const limpiarCarroLocal = async (mesaId: number): Promise<void> => {
    localStorage.removeItem(`${CARRO_PREFIX}${mesaId}`);
};

// ============================================================================
// FUNCIONES DE ÓRDENES DE CLIENTE (vista cliente)
// ============================================================================

export interface OrdenCliente {
    id: string;
    order_number: string;
    type: 'local' | 'domicilio';
    table_number?: string;
    waiter_name?: string;
    customer_name?: string;
    customer_phone?: string;
    address?: string;
    items: any; // JSONB — array de CartItem
    status: 'pendiente' | 'listo' | 'entregado' | 'cobrado';
    total: number;
    delivery_charge?: number;
    notes?: string;
    payment_method?: 'efectivo' | 'electronico';
    paid: boolean;
    payment_date?: string;
    created_at: string;
}

export const obtenerOrdenesCliente = async (): Promise<OrdenCliente[]> => {
    const { data, error } = await supabase
        .from('ordenes_cliente')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Error al obtener órdenes: ${error.message}`);
    return data as OrdenCliente[];
};

export const crearOrdenCliente = async (orden: Omit<OrdenCliente, 'created_at'>): Promise<OrdenCliente> => {
    const { data, error } = await supabase
        .from('ordenes_cliente')
        .insert(orden)
        .select('*')
        .single();

    if (error) throw new Error(`Error al crear orden: ${error.message}`);
    return data as OrdenCliente;
};

export const actualizarEstadoOrdenCliente = async (
    ordenId: string,
    status: 'pendiente' | 'listo' | 'entregado' | 'cobrado'
): Promise<void> => {
    const { error } = await supabase
        .from('ordenes_cliente')
        .update({ status })
        .eq('id', ordenId);

    if (error) throw new Error(`Error al actualizar orden: ${error.message}`);
};

export const marcarOrdenPagada = async (
    ordenId: string,
    paymentMethod: 'efectivo' | 'electronico'
): Promise<void> => {
    const { error } = await supabase
        .from('ordenes_cliente')
        .update({
            status: 'cobrado',
            paid: true,
            payment_method: paymentMethod,
            payment_date: new Date().toISOString()
        })
        .eq('id', ordenId);

    if (error) throw new Error(`Error al marcar orden como pagada: ${error.message}`);
};

export const eliminarOrdenCliente = async (ordenId: string): Promise<void> => {
    const { error } = await supabase
        .from('ordenes_cliente')
        .delete()
        .eq('id', ordenId);

    if (error) throw new Error(`Error al eliminar orden: ${error.message}`);
};

// ============================================================================
// FUNCIONES DE USUARIOS DEL SISTEMA (login)
// ============================================================================

export interface UsuarioSistema {
    id: number;
    username: string;
    password: string;
    roles: string; // Roles separados por coma: "admin,mesero,cocina,repartidor"
    created_at: string;
}

export const verificarCredencialesUsuario = async (
    username: string,
    password: string
): Promise<UsuarioSistema | undefined> => {
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(`Error al verificar credenciales: ${error.message}`);
    }
    // Normalizar: si tiene 'role' pero no 'roles', usar 'role' como 'roles'
    const result = data as any;
    if (!result.roles && result.role) {
        result.roles = result.role;
    }
    return result as UsuarioSistema;
};

export const obtenerTodosLosUsuarios = async (): Promise<UsuarioSistema[]> => {
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .order('id', { ascending: true });

    if (error) throw new Error(`Error al obtener usuarios: ${error.message}`);
    // Normalizar: si tiene 'role' pero no 'roles', usar 'role' como 'roles'
    return (data as any[]).map(u => ({
        ...u,
        roles: u.roles || u.role || 'mesero'
    })) as UsuarioSistema[];
};

export const guardarUsuario = async (
    usuario: Omit<UsuarioSistema, 'id' | 'created_at'>
): Promise<number> => {
    // Intentar guardar con el campo 'roles' (nuevo esquema)
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .insert({
            username: usuario.username,
            password: usuario.password,
            roles: usuario.roles,
            // También guardar en 'role' para compatibilidad con BD antigua
            role: usuario.roles
        })
        .select('id')
        .single();

    if (error) {
        // Si falla porque no existe la columna 'roles', intentar solo con 'role'
        if (error.message.includes('roles')) {
            const { data: data2, error: error2 } = await supabase
                .from('usuarios_sistema')
                .insert({
                    username: usuario.username,
                    password: usuario.password,
                    role: usuario.roles
                })
                .select('id')
                .single();
            if (error2) throw new Error(`Error al guardar usuario: ${error2.message}`);
            return data2.id;
        }
        throw new Error(`Error al guardar usuario: ${error.message}`);
    }
    return data.id;
};

export const eliminarUsuario = async (username: string): Promise<void> => {
    const { error } = await supabase
        .from('usuarios_sistema')
        .delete()
        .eq('username', username);

    if (error) throw new Error(`Error al eliminar usuario: ${error.message}`);
};

// ============================================================================
// FUNCIONES DE SUSCRIPCIÓN REALTIME (nuevas — no existen en Queries.ts)
// ============================================================================

/**
 * Tipos de eventos de Realtime que Supabase emite.
 */
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Suscribirse a cambios en tiempo real de una tabla.
 * Reemplaza el polling de 3 segundos y los storage events.
 *
 * @param table - Nombre de la tabla a suscribir
 * @param callback - Función que se ejecuta cuando hay cambios
 * @param event - Tipo de evento a escuchar (default: '*')
 * @returns Función para cancelar la suscripción (unsubscribe)
 */
export const suscribirACambios = (
    table: string,
    callback: (payload: { eventType: string; new: any; old: any }) => void,
    event: RealtimeEvent = '*'
): (() => void) => {
    const channel = supabase
        .channel(`${table}-realtime`)
        .on(
            'postgres_changes' as any,
            { event, schema: 'public', table },
            (payload: any) => {
                callback({
                    eventType: payload.eventType,
                    new: payload.new,
                    old: payload.old
                });
            }
        )
        .subscribe();

// Retornar función para cancelar suscripción
    return () => {
      supabase.removeChannel(channel);
    };
};

// ============================================================================
// FUNCIONES DE EXTRAS
// ============================================================================

export const obtenerTodosLosExtras = async (): Promise<Extra[]> => {
  const { data, error } = await supabase
    .from('extras')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw new Error(`Error al obtener extras: ${error.message}`);
  return data as Extra[];
};

export const agregarExtra = async (extra: Omit<Extra, 'id' | 'created_at'>): Promise<number> => {
  const { data, error } = await supabase
    .from('extras')
    .insert(extra)
    .select('id')
    .single();

  if (error) throw new Error(`Error al agregar extra: ${error.message}`);
  return data.id;
};

export const actualizarExtra = async (extra: Extra): Promise<void> => {
  const { error } = await supabase
    .from('extras')
    .update(extra)
    .eq('id', extra.id);

  if (error) throw new Error(`Error al actualizar extra: ${error.message}`);
};

export const eliminarExtra = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('extras')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Error al eliminar extra: ${error.message}`);
};
