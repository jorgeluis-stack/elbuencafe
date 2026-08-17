import * as SupabaseImpl from './SupabaseQueriesImpl';
import * as LocalQueries from './Queries';
import { isSupabaseConfigured } from './supabaseClient';

export type * from './SupabaseQueriesImpl';
export * from './Schema';

function withFallback<T extends keyof typeof SupabaseImpl>(name: T): typeof SupabaseImpl[T] {
    return (async (...args: any[]) => {
        const localFn = (LocalQueries as any)[name];
        if (!isSupabaseConfigured()) {
            if (localFn) return localFn(...args);
            return (SupabaseImpl[name] as any)(...args);
        }
        try {
            return await (SupabaseImpl[name] as any)(...args);
        } catch (e: any) {
            console.warn(`Supabase fallback activated for ${String(name)} due to error: `, e.message || e);
            if (localFn) return localFn(...args);
            throw e;
        }
    }) as any;
}

export const obtenerTodasLasMesas = withFallback('obtenerTodasLasMesas');
export const sincronizarMesasConfiguradas = withFallback('sincronizarMesasConfiguradas');
export const obtenerMesaPorId = withFallback('obtenerMesaPorId');
export const obtenerMesaPorNumero = withFallback('obtenerMesaPorNumero');
export const actualizarEstadoMesa = withFallback('actualizarEstadoMesa');
export const obtenerTodosLosMeseros = withFallback('obtenerTodosLosMeseros');
export const obtenerMeseroPorId = withFallback('obtenerMeseroPorId');
export const agregarMesero = withFallback('agregarMesero');
export const actualizarMesero = withFallback('actualizarMesero');
export const obtenerMeseroPorUsername = withFallback('obtenerMeseroPorUsername');
export const verificarCredencialesMesero = withFallback('verificarCredencialesMesero');
export const obtenerTodasLasCuentas = withFallback('obtenerTodasLasCuentas');
export const obtenerCuentasCobradasEnFecha = withFallback('obtenerCuentasCobradasEnFecha');
export const obtenerMinicomandasConItemsPorCuentas = withFallback('obtenerMinicomandasConItemsPorCuentas');
export const obtenerCuentaPorId = withFallback('obtenerCuentaPorId');
export const obtenerCuentasPorMesa = withFallback('obtenerCuentasPorMesa');
export const obtenerCuentasPorMesero = withFallback('obtenerCuentasPorMesero');
export const obtenerCuentasAbiertasPorMesa = withFallback('obtenerCuentasAbiertasPorMesa');
export const obtenerCuentaAbiertaPorMesa = withFallback('obtenerCuentaAbiertaPorMesa');
export const crearCuenta = withFallback('crearCuenta');
export const actualizarCuenta = withFallback('actualizarCuenta');
export const actualizarSeatConfig = withFallback('actualizarSeatConfig');
export const cerrarCuenta = withFallback('cerrarCuenta');
export const obtenerTodasLasMinicomandas = withFallback('obtenerTodasLasMinicomandas');
export const obtenerMinicomandaPorId = withFallback('obtenerMinicomandaPorId');
export const obtenerMinicomandasPorCuenta = withFallback('obtenerMinicomandasPorCuenta');
export const obtenerMinicomandasPorMesa = withFallback('obtenerMinicomandasPorMesa');
export const crearMinicomanda = withFallback('crearMinicomanda');
export const actualizarMinicomanda = withFallback('actualizarMinicomanda');
export const marcarMinicomandaComoListo = withFallback('marcarMinicomandaComoListo');
export const obtenerTodosLosItemsMinicomanda = withFallback('obtenerTodosLosItemsMinicomanda');
export const obtenerItemMinicomandaPorId = withFallback('obtenerItemMinicomandaPorId');
export const obtenerItemsPorMinicomanda = withFallback('obtenerItemsPorMinicomanda');
export const crearItemMinicomanda = withFallback('crearItemMinicomanda');
export const actualizarItemMinicomanda = withFallback('actualizarItemMinicomanda');
export const actualizarSeatItemMinicomanda = withFallback('actualizarSeatItemMinicomanda');
export const moverItemACuenta = withFallback('moverItemACuenta');
export const eliminarItemMinicomanda = withFallback('eliminarItemMinicomanda');
export const crearItemComensalShare = withFallback('crearItemComensalShare');
export const obtenerSharesPorItem = withFallback('obtenerSharesPorItem');
export const obtenerSharesPendientesPorAsiento = withFallback('obtenerSharesPendientesPorAsiento');
export const actualizarShare = withFallback('actualizarShare');
export const marcarSharePagado = withFallback('marcarSharePagado');
export const eliminarSharesPorItem = withFallback('eliminarSharesPorItem');
export const itemCompartidoLiquidado = withFallback('itemCompartidoLiquidado');
export const obtenerSubtotalesPorAsiento = withFallback('obtenerSubtotalesPorAsiento');
export const obtenerTodasLasOpciones = withFallback('obtenerTodasLasOpciones');
export const obtenerOpcionesPorItem = withFallback('obtenerOpcionesPorItem');
export const crearOpcion = withFallback('crearOpcion');
export const crearMultiplesOpciones = withFallback('crearMultiplesOpciones');
export const obtenerTodoElHistorial = withFallback('obtenerTodoElHistorial');
export const obtenerHistorialPorCuenta = withFallback('obtenerHistorialPorCuenta');
export const obtenerHistorialPorMesa = withFallback('obtenerHistorialPorMesa');
export const obtenerHistorialPorMesero = withFallback('obtenerHistorialPorMesero');
export const crearHistorialAccion = withFallback('crearHistorialAccion');
export const obtenerEstadoMesaCompleto = withFallback('obtenerEstadoMesaCompleto');
export const calcularTotalCuenta = withFallback('calcularTotalCuenta');
export const obtenerProductos = withFallback('obtenerProductos');
export const guardarCarroLocal = withFallback('guardarCarroLocal');
export const obtenerCarroLocal = withFallback('obtenerCarroLocal');
export const limpiarCarroLocal = withFallback('limpiarCarroLocal');
export const obtenerOrdenesCliente = withFallback('obtenerOrdenesCliente');
export const crearOrdenCliente = withFallback('crearOrdenCliente');
export const actualizarEstadoOrdenCliente = withFallback('actualizarEstadoOrdenCliente');
export const marcarOrdenPagada = withFallback('marcarOrdenPagada');
export const eliminarOrdenCliente = withFallback('eliminarOrdenCliente');
export const verificarCredencialesUsuario = withFallback('verificarCredencialesUsuario');
export const obtenerTodosLosUsuarios = withFallback('obtenerTodosLosUsuarios');
export const guardarUsuario = withFallback('guardarUsuario');
export const eliminarUsuario = withFallback('eliminarUsuario');
export const suscribirACambios = (...args: any[]) => (SupabaseImpl as any).suscribirACambios(...args);

// Funciones de Extras
export const obtenerTodosLosExtras = withFallback('obtenerTodosLosExtras');
export const agregarExtra = withFallback('agregarExtra');
export const actualizarExtra = withFallback('actualizarExtra');
export const eliminarExtra = withFallback('eliminarExtra');
