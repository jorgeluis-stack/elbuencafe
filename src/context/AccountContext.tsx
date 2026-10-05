// src/context/AccountContext.tsx - Contexto de gestión de cuentas para El Buen Café
// MIGRADO: IndexedDB → Supabase PostgreSQL + Realtime

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
    Mesa,
    Mesero,
    Cuenta,
    Minicomanda,
    ItemMinicomanda,
    CarroItem,
    EstadoMesa,
    MinicomandaConItems,
    CuentaConMinicomandas,
    MesaEstado,
    CuentaEstado,
    MinicomandaEstado,
    Extra
} from '../types';
import {
    obtenerTodasLasMesas,
    obtenerMeseroPorId,
    obtenerMeseroPorUsername,
    verificarCredencialesMesero,
    obtenerCuentaAbiertaPorMesa,
    obtenerCuentasAbiertasPorMesa,
    obtenerCuentasAbiertas,
    obtenerCuentaPorId,
    obtenerCuentasPorMesa,
    crearCuenta,
    actualizarCuenta,
    cerrarCuenta,
    obtenerMinicomandasPorCuenta,
    obtenerMinicomandaPorId,
    obtenerItemMinicomandaPorId,
    crearMinicomanda,
    crearItemMinicomanda,
    actualizarItemMinicomanda,
    crearMultiplesOpciones,
    crearMultiplesItemExtras,
    actualizarSeatItemMinicomanda,
    moverItemACuenta,
    crearItemComensalShare,
    obtenerSharesPorItem,
    obtenerSharesPendientesPorAsiento,
    actualizarShare,
    marcarSharePagado,
    eliminarSharesPorItem,
    itemCompartidoLiquidado,
    obtenerSubtotalesPorAsiento,
    obtenerItemsPorMinicomanda,
    eliminarItemMinicomanda,
    obtenerTodasLasMinicomandas,
    actualizarCuentaDeMinicomanda,
    actualizarEstadoMinicomandaParcial,
    actualizarEstadoMesa,
    obtenerMesaPorId,
    obtenerMesaPorNumero,
    obtenerHistorialPorMesa,
    crearHistorialAccion,
    obtenerCarroLocal,
    guardarCarroLocal,
    limpiarCarroLocal,
    calcularTotalCuenta,
    obtenerEstadoMesaCompleto,
    suscribirACambios,
    verificarCredencialesUsuario,
    agregarMesero,
    UsuarioSistema
} from '../db/SupabaseQueries';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';

export type MetodoPago = 'efectivo' | 'electronico';

export interface CobroResultado {
    mesaNumero: string;
    totalPagado: number;
    cambio: number;
    metodoPago: MetodoPago;
    referencia?: string;
    tipo: 'global' | 'asientos';
    mesaLiberada: boolean;
    pendientesRestantes: number;
    asientosCobrados?: number[];
}

interface AccountContextType {
    // Estado de autenticación
    meseroLogueado: Mesero | null;
    cocinaLogueada: boolean;
    mesas: Mesa[];
    mesaSeleccionada: Mesa | null;
    setMesaSeleccionada: React.Dispatch<React.SetStateAction<Mesa | null>>;
    estadoMesa: EstadoMesa | null;

    // Carro local
    carroLocal: CarroItem[];
    setCarroLocal: React.Dispatch<React.SetStateAction<CarroItem[]>>;

    // Comensal activo para asignar platos (división por asiento)
    comensalActivo: number;
    setComensalActivo: React.Dispatch<React.SetStateAction<number>>;

    // Cuenta actual
    cuentaActual: Cuenta | null;
    minicomandas: Minicomanda[];
    cuentasAbiertas: Cuenta[];
    cuentaActivaIndex: number;

    // Contador de minicomandas pendientes (para el badge de cocina)
    pendingMinicomandasCount: number;

    // Funciones de autenticación
    loginMesero: (username: string, password: string) => Promise<boolean>;
    logoutMesero: () => Promise<void>;
    loginMeseroAsAdmin: () => Promise<void> | void;
    loginCocina: (username: string, password: string) => Promise<boolean>;
    loginCocinaAsAdmin: () => void;
    logoutCocina: () => void;

    // Funciones de mesa
    seleccionarMesa: (mesa: Mesa) => Promise<void>;
    liberarMesa: () => Promise<boolean>;
    cambiarMesa: () => Promise<void>;

    // Funciones de carro
    agregarAlCarro: (product: any, quantity: number, notes: string, options: any[], extras?: { nombre: string; precio: number }[], seatNumber?: number) => void;
    removeFromCarro: (cartItemId: string) => void;
    updateCarroQuantity: (cartItemId: string, quantity: number) => void;
    clearCarro: () => void;

    // Funciones de minicomandas
    enviarACocina: () => Promise<{ ok: boolean; error?: string; items?: CarroItem[]; total?: number }>;
    enviandoACocina: boolean;
    actualizarEstadoMinicomanda: (minicomandaId: number, estado: MinicomandaEstado) => Promise<void>;
    devolverAMesero: (minicomandaId: number) => Promise<void>;

    // Funciones de cuenta
    cobrarCuenta: (totalPagado: number, cambio: number, metodoPago: MetodoPago, referencia?: string) => Promise<CobroResultado | null>;
    cobrarAsientos: (seatNumbers: number[], totalPagado: number, cambio: number, metodoPago: MetodoPago, referencia: string | undefined, idempotencyKey: string) => Promise<CobroResultado | null>;
    resolverSalidaComensal: (itemId: number, asientoSale: number, decision: 'pasar' | 'repartir' | 'completa', destino?: number, asientosRestantes?: number[]) => Promise<void>;
    // Convierte un ítem individual en compartido durante el checkout (seat_number -> null + shares exactos).
    compartirItemIndividual: (itemId: number, reparto: { seat: number; porcentaje: number; monto: number }[]) => Promise<void>;
    actualizarRepartoItem: (itemId: number, nuevosShares: { seat: number; porcentaje: number; monto: number }[]) => Promise<void>;
    obtenerSharesPorItem: (itemId: number) => Promise<any[]>;
    verHistorial: () => Promise<void>;
    seleccionarCuentaAbierta: (index: number) => Promise<void>;
    moverItem: (itemId: number, nuevaCuentaId: number) => Promise<void>;
    dividirPorAsiento: (numComensales: number) => Promise<void>;
    combinarCuentas: (cuentaIds: number[]) => Promise<void>;

    // Items de cocina (persisten entre vistas)
    itemsDeCocina: ItemMinicomanda[];
    cargarItemsDeCocina: () => Promise<void>;
    asientosActivos: number[];
    setAsientosActivos: React.Dispatch<React.SetStateAction<number[]>>;

    // Bloqueo de mesa por mesero
    solicitudReemplazo: { mesa: Mesa; meseroActualId: number } | null;
    confirmarReemplazo: () => Promise<void>;
    cancelarReemplazo: () => void;
    obtenerNombreMesero: (id: number) => Promise<string>;

    // Utilidades
    recargarEstadoMesa: () => Promise<any>;
    calcularTotalCarro: () => number;
    recargarContadorPendientes: () => Promise<void>;
    obtenerCuentasAbiertasPorMesa: (mesaId: number) => Promise<any[]>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [meseroLogueado, setMeseroLogueado] = useState<Mesero | null>(null);
    const [cocinaLogueada, setCocinaLogueada] = useState<boolean>(false);
    const [mesas, setMesas] = useState<Mesa[]>([]);
    const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
    const [estadoMesa, setEstadoMesa] = useState<EstadoMesa | null>(null);
    const [cuentaActual, setCuentaActual] = useState<Cuenta | null>(null);
    // Referencia siempre actualizada de cuentaActual para evitar stale closures en callbacks/realtime
    const cuentaActualRef = useRef<Cuenta | null>(null);
    useEffect(() => { cuentaActualRef.current = cuentaActual; }, [cuentaActual]);
    // Referencia siempre actualizada de recargarEstadoMesa para el Realtime (debe declararse antes de usarse en suscripciones)
    const recargarEstadoMesaRef = useRef<(() => Promise<void>) | null>(null);
    const [minicomandas, setMinicomandas] = useState<Minicomanda[]>([]);
    const [cuentasAbiertas, setCuentasAbiertas] = useState<Cuenta[]>([]);
    const [cuentaActivaIndex, setCuentaActivaIndex] = useState<number>(0);
    const [carroLocal, setCarroLocal] = useState<CarroItem[]>([]);
    const [comensalActivo, setComensalActivo] = useState<number>(1);
    const [pendingMinicomandasCount, setPendingMinicomandasCount] = useState<number>(0);
    const [enviandoACocina, setEnviandoACocina] = useState<boolean>(false);
    // Items de BD (enviados a cocina) con estado de minicomanda — persisten entre vistas
    const [itemsDeCocina, setItemsDeCocina] = useState<ItemMinicomanda[]>([]);
    // Solicitud de reemplazo de mesero (para mostrar modal de confirmación)
    const [solicitudReemplazo, setSolicitudReemplazo] = useState<{
        mesa: Mesa;
        meseroActualId: number;
    } | null>(null);
    // Asientos/comensales activos con items — persisten entre vistas
    const [asientosActivos, setAsientosActivos] = useState<number[]>([1]);

    // Cargar mesas al montar el componente
    useEffect(() => {
        cargarMesas();
        recargarContadorPendientes();

        const handleReload = () => cargarMesas();
        window.addEventListener('reload_tables', handleReload);
        return () => window.removeEventListener('reload_tables', handleReload);
    }, []);

    // Suscripción Realtime: cambios en minicomandas (nuevas comandas, cambios de estado)
    useEffect(() => {
        // [KDS-TRACE] Instrumentación temporal de diagnóstico — solo observa, no altera lógica.
        const unsubscribe = suscribirACambios('minicomandas', (payload: any) => {
            console.log(`[KDS-TRACE] REALTIME_MINICOMANDA event=${String(payload?.eventType ?? payload?.event)} id=${String(payload?.new?.id ?? payload?.old?.id)} oldEstado=${String(payload?.old?.estado)} newEstado=${String(payload?.new?.estado)} timestamp=${new Date().toISOString()}`);
            recargarContadorPendientes();
            // Si hay una mesa seleccionada, recargar su estado también
            if (mesaSeleccionada) {
                recargarEstadoMesa();
            }
        });
        return unsubscribe;
    }, [mesaSeleccionada]);

    // Suscripción Realtime: cambios en mesas (estado LIBRE/OCUPADA/COBRADA)
    useEffect(() => {
        const unsubscribe = suscribirACambios('mesas', () => {
            cargarMesas();
        });
        return unsubscribe;
    }, []);

    // Suscripción Realtime: cambios en cuentas
    useEffect(() => {
        const unsubscribe = suscribirACambios('cuentas', () => {
            recargarContadorPendientes();

            // La ocupación de las mesas se deriva de las cuentas ABIERTA (no del campo
            // mesas.estado, que puede quedar stale si su escritura falla silenciosamente).
            // Al cerrarse/cobrarse una cuenta desde OTRO dispositivo (otro mesero), hay
            // que refrescar la grilla: si no, quien veía la mesa ocupada la seguirá viendo
            // ocupada aunque ya esté disponible.
            cargarMesas();

            // Si el mesero tenía la mesa seleccionada y ya no tiene cuentas abiertas
            // (fue cobrada/liberada desde otro lado), volver a la grilla de selección.
            if (mesaSeleccionada) {
                obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id).then((abiertas) => {
                    if (abiertas.length === 0) {
                        setMesaSeleccionada(null);
                        setEstadoMesa(null);
                        setCuentaActual(null);
                        setMinicomandas([]);
                        setCarroLocal([]);
                    }
                });
                recargarEstadoMesaRef.current?.();
            }
        });
        return unsubscribe;
    }, [mesaSeleccionada]);

    // Suscripción Realtime: cambios en meseros (roles actualizados por admin)
    useEffect(() => {
        const unsubscribe = suscribirACambios('meseros', async () => {
            // Si hay un mesero logueado, refrescar sus datos
            if (meseroLogueado) {
                try {
                    const { data: updatedMesero } = await supabase
                        .from('meseros')
                        .select('*')
                        .eq('id', meseroLogueado.id)
                        .single();
                    if (updatedMesero) {
                        setMeseroLogueado(updatedMesero);
                    }
                } catch (error) {
                    console.error('Error al recargar mesero por Realtime:', error);
                }
            }
        });
        return unsubscribe;
    }, [meseroLogueado]);

    // Realtime: notificación al mesero saliente cuando es reemplazado
    useEffect(() => {
        if (!meseroLogueado) return;
        const unsubscribe = suscribirACambios('historial_acciones', (payload) => {
            if (payload.new?.accion === 'REEMPLAZADO' &&
                payload.new?.mesero_id === meseroLogueado.id) {
                alert(`⚠️ ${payload.new.descripcion}`);
                if (mesaSeleccionada && payload.new.mesa_id === mesaSeleccionada.id) {
                    setMesaSeleccionada(null);
                    setEstadoMesa(null);
                    setCuentaActual(null);
                    setMinicomandas([]);
                    setCarroLocal([]);
                }
            }
        });
        return unsubscribe;
    }, [meseroLogueado, mesaSeleccionada]);

    // Cargar mesas desde Supabase
    const cargarMesas = async () => {
        let mesasData: Mesa[] | null = null;
        try {
            mesasData = await obtenerTodasLasMesas();
        } catch (error) {
            console.error('Error al cargar mesas:', error);
        }

        // Fuente de verdad de ocupación: las cuentas ABIERTA (persisten en Supabase) y NO
        // el campo mesas.estado, cuya escritura puede fallar silenciosamente (RLS/schema).
        // Con esto, la ocupación propaga entre navegadores (A ocupa → B lo ve Ocupada).
        const determinarOcupacion = async (lista: Mesa[]): Promise<Mesa[]> => {
            let abiertas: Cuenta[] = [];
            try {
                // Solo cuentas ABIERTA en BD (rápido, sin traer todo el histórico)
                abiertas = await obtenerCuentasAbiertas();
            } catch (error) {
                console.error('Error al cargar cuentas para estados de mesa:', error);
            }

            // Map mesa_id → cuentas ABIERTA (obtenerCuentasAbiertas ordena desc por fecha_apertura,
            // así que el primer elemento por mesa es el más reciente = propietario actual)
            const abiertasPorMesa: Record<number, Cuenta[]> = {};
            abiertas.forEach(c => {
                (abiertasPorMesa[c.mesa_id] ||= []).push(c);
            });

            return lista.map(m => {
                const abiertas = abiertasPorMesa[m.id];
                if (abiertas && abiertas.length > 0) {
                    const masReciente = abiertas[0];
                    return {
                        ...m,
                        estado: 'OCUPADA',
                        // Propietario real: columna mesero_activo_id (si existe en BD) o el
                        // mesero de la cuenta abierta más reciente como respaldo
                        mesero_activo_id: m.mesero_activo_id ?? masReciente.mesero_id
                    };
                }
                // Sin cuentas ABIERTA la mesa no puede estar ocupada. Respetar 'COBRADA'
                // (marca que quedó pendiente de liberar), pero forzar 'LIBRE' si la columna
                // mesas.estado quedó stale en 'OCUPADA' (escritura fallida u orden de eventos).
                const estadoCorregido = m.estado === 'COBRADA' ? 'COBRADA' : 'LIBRE';
                return { ...m, estado: estadoCorregido, mesero_activo_id: m.estado === 'OCUPADA' ? undefined : m.mesero_activo_id };
            });
        };

        if (mesasData && mesasData.length > 0) {
            setMesas(await determinarOcupacion(mesasData));
        } else {
            // Fallback a localStorage
            const tableCountStr = localStorage.getItem('elbuencafe_table_count') || '15';
            const tableCount = parseInt(tableCountStr, 10);
            const fakeMesas: Mesa[] = [];
            for (let i = 1; i <= tableCount; i++) {
                fakeMesas.push({
                    id: i,
                    numero: i.toString(),
                    capacidad: 4,
                    ubicacion: 'General',
                    estado: 'LIBRE'
                });
            }
            // Add Barra
            fakeMesas.push({
                id: tableCount + 1,
                numero: 'Barra',
                capacidad: 1,
                ubicacion: 'Barra',
                estado: 'LIBRE'
            });
            setMesas(await determinarOcupacion(fakeMesas));
        }
    };

    // Login de mesero (busca en meseros, fallback a usuarios_sistema con auto-creación)
    const loginMesero = async (username: string, password: string): Promise<boolean> => {
        try {
            let loginValido = false;
            let meseroData = null;

            if (isSupabaseConfigured()) {
                // 1. Buscar directamente en tabla meseros
                const mesero = await verificarCredencialesMesero(username, password);
                if (mesero) {
                    meseroData = mesero;
                    loginValido = true;
                } else {
                    // 2. No existe en meseros → buscar en usuarios_sistema
                    const usuario = await verificarCredencialesUsuario(username, password);
                    if (usuario && (usuario.roles.includes('mesero') || usuario.roles.includes('admin'))) {
                        // Auto-crear registro en meseros
                        const nuevoId = await agregarMesero({
                            nombre: usuario.username,
                            username: usuario.username,
                            password_hash: usuario.password,
                            rol: usuario.roles,
                            activo: true
                        });
                        meseroData = {
                            id: nuevoId,
                            nombre: usuario.username,
                            username: usuario.username,
                            password_hash: usuario.password,
                            rol: usuario.roles,
                            activo: true
                        };
                        loginValido = true;
                    }
                }
            }

            if (!loginValido) {
                // Fallback a localStorage
                const savedUsers = localStorage.getItem('elbuencafe_users');
                if (savedUsers) {
                    const users = JSON.parse(savedUsers);
                    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
                    if (user && (user.roles?.includes('mesero') || user.role?.includes('mesero') || user.roles?.includes('admin') || user.role?.includes('admin'))) {
                        meseroData = {
                            id: Date.now(), // Fake ID
                            nombre: user.username,
                            username: user.username,
                            password_hash: user.password,
                            rol: user.roles || user.role || 'mesero',
                            activo: true
                        };
                        loginValido = true;
                    }
                }
            }

            if (loginValido && meseroData) {
                setMeseroLogueado(meseroData);
                // Forzar recarga de mesas y estado pendiente después de login
                // para garantizar consistencia tras cerrar/reiniciar sesión
                cargarMesas();
                recargarContadorPendientes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error en login:', error);
            return false;
        }
    };

    // Login de mesero para admin (sin credenciales específicas)
    const loginMeseroAsAdmin = async () => {
        if (isSupabaseConfigured()) {
            try {
                const { data: adminUser } = await supabase
                    .from('meseros')
                    .select('*')
                    .eq('username', 'admin')
                    .single();
                if (adminUser) {
                    setMeseroLogueado(adminUser);
                    return;
                }
            } catch (error) {
                console.error('Error al obtener usuario admin:', error);
            }
        }

        // Crear un objeto mesero virtual para el admin
        const adminMesero: Mesero = {
            id: 0,
            nombre: 'Administrador',
            username: 'admin',
            password_hash: 'admin',
            rol: 'admin',
            activo: true
        };
        setMeseroLogueado(adminMesero);
    };

    // Logout de mesero
    const logoutMesero = async () => {
        if (mesaSeleccionada) {
            try {
                await guardarCarroLocal(mesaSeleccionada.id, carroLocal);
            } catch (error) {
                console.error('Error al guardar carro antes de logout:', error);
            }
            try {
                localStorage.setItem(`elbuencafe_carro_${mesaSeleccionada.id}`, JSON.stringify(carroLocal));
            } catch { /* ignorar */ }
        }
        setMeseroLogueado(null);
        setMesaSeleccionada(null);
        setEstadoMesa(null);
        setCuentaActual(null);
        setMinicomandas([]);
        setCarroLocal([]);
    };

    // Login de cocina (busca en usuarios_sistema y meseros)
    const loginCocina = async (username: string, password: string): Promise<boolean> => {
        try {
            let loginValido = false;

            if (isSupabaseConfigured()) {
                // 1. Buscar en usuarios_sistema
                const usuario = await verificarCredencialesUsuario(username, password);
                if (usuario && (usuario.roles.includes('cocina') || usuario.roles.includes('admin'))) {
                    loginValido = true;
                } else {
                    // 2. Fallback: buscar en meseros (usando password_hash)
                    const { data: mesero } = await supabase
                        .from('meseros')
                        .select('*')
                        .eq('username', username)
                        .eq('password_hash', password)
                        .eq('activo', true)
                        .single();

                    if (mesero) {
                        const roles = (mesero.rol || '').split(',').map((r: string) => r.trim());
                        if (roles.includes('cocina') || roles.includes('admin')) {
                            loginValido = true;
                        }
                    }
                }
            }

            if (!loginValido) {
                // Fallback a localStorage
                const savedUsers = localStorage.getItem('elbuencafe_users');
                if (savedUsers) {
                    const users = JSON.parse(savedUsers);
                    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
                    if (user && (user.roles?.includes('cocina') || user.role?.includes('cocina') || user.roles?.includes('admin') || user.role?.includes('admin'))) {
                        loginValido = true;
                    }
                }
            }

            if (loginValido) {
                setCocinaLogueada(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error en login de cocina:', error);
            return false;
        }
    };

    // Login de cocina como admin (sin verificar en Supabase)
    const loginCocinaAsAdmin = () => {
        setCocinaLogueada(true);
    };

    // Logout de cocina
    const logoutCocina = () => {
        setCocinaLogueada(false);
    };

    // Seleccionar mesa
    const seleccionarMesa = async (mesa: Mesa, reemplazarMesero: boolean = false) => {
        try {
            // LEER FRESCO desde BD: la grilla puede estar desactualizada (navegador/realtime).
            // Fuente de verdad de ocupación = cuentas ABIERTA (persisten en Supabase),
            // no el campo mesas.estado que puede estar stale o fallar su escritura en BD.
            const mesaFresca = (await obtenerMesaPorId(mesa.id)) ?? mesa;
            const abiertas = await obtenerCuentasAbiertasPorMesa(mesa.id);
            const ocupada = abiertas.length > 0;
            // Propietario real: mesero_activo_id (si existe) o el mesero de la cuenta más reciente
            const propietario = mesaFresca.mesero_activo_id
                ?? (abiertas.length > 0 ? abiertas[0].mesero_id : undefined);
            const mesaObjetivo: Mesa = {
                ...mesaFresca,
                estado: ocupada ? 'OCUPADA' : mesaFresca.estado,
                mesero_activo_id: propietario
            };

            // Bloqueo por otro mesero (solo si no está confirmando reemplazo)
            if (ocupada && propietario &&
                propietario !== meseroLogueado!.id && !reemplazarMesero) {
                setSolicitudReemplazo({ mesa: mesaObjetivo, meseroActualId: propietario });
                return;
            }

            // Variables para almacenar datos cargados
            let cuenta: Cuenta | null = null;
            let minis: Minicomanda[] = [];
            let estadoCompleto: EstadoMesa | null = null;
            let carroItems: CarroItem[] = [];

            // Cargar SIEMPRE el carro local guardado previamente para esta mesa (si existe)
            let carroGuardado = await obtenerCarroLocal(mesa.id);
            if (!carroGuardado || carroGuardado.length === 0) {
                // Respaldo directo desde localStorage (por si el backend cambió de modo)
                const raw = localStorage.getItem(`elbuencafe_carro_${mesa.id}`);
                if (raw) {
                    try { carroGuardado = JSON.parse(raw) as CarroItem[]; } catch { }
                }
            }
            carroItems = (carroGuardado as CarroItem[]) || [];

            // Manejar según estado real de la mesa (cuentas ABIERTA frescas)
            if (ocupada) {
                // Mesa ocupada: usar la cuenta abierta más reciente (ya consultada arriba)
                cuenta = abiertas.length > 0 ? abiertas[0] : null;

                if (cuenta) {
                    // Hay cuenta abierta: cargar minicomandas y estado
                    minis = await obtenerMinicomandasPorCuenta(cuenta.id);
                    estadoCompleto = await obtenerEstadoMesaCompleto(mesa.id);
                } else {
                    // Mesa figura ocupada pero no tiene cuenta abierta: crear cuenta nueva
                    cuenta = null;
                }
            } else if (mesaObjetivo.estado === 'COBRADA') {
                // Mesa cobrada: requiere confirmación explícita para liberar y reabrir
                const confirmar = window.confirm(
                    `La mesa ${mesa.numero} está en estado "Cobrada".\n\n` +
                    `¿Desea liberarla y abrir una nueva cuenta?`
                );
                if (!confirmar) {
                    return; // No seleccionar la mesa
                }
                // Liberar mesa primero
                await actualizarEstadoMesa(mesa.id, 'LIBRE');
                await cargarMesas();
                cuenta = null;
            }

            // Si no hay cuenta cargada (mesa LIBRE, COBRADA confirmada, u OCUPADA sin cuenta), crear nueva
            if (!cuenta && meseroLogueado) {
                // Si el admin accede como mesero (id: 0), usar un ID especial
                const meseroId = meseroLogueado.id === 0 ? 999 : meseroLogueado.id;
                const nuevaCuenta: Omit<Cuenta, 'id' | 'created_at'> = {
                    mesa_id: mesa.id,
                    mesero_id: meseroId,
                    estado: 'ABIERTA',
                    total_acumulado: 0,
                    fecha_apertura: new Date().toISOString()
                };

                const cuentaId = await crearCuenta(nuevaCuenta);
                cuenta = { ...nuevaCuenta, id: cuentaId, created_at: nuevaCuenta.fecha_apertura };

                // Actualizar estado de mesa a OCUPADA
                await actualizarEstadoMesa(mesa.id, 'OCUPADA');
                // Refrescar lista de mesas inmediatamente
                await cargarMesas();

                // Guardar en historial
                await crearHistorialAccion({
                    cuenta_id: cuentaId,
                    mesa_id: mesa.id,
                    mesero_id: meseroId,
                    accion: 'ABRIR_CUENTA',
                    descripcion: `Mesa ${mesa.numero} abierta por ${meseroLogueado.nombre}`
                });
            // Actualizar el estado local de mesas inmediatamente (sin esperar round-trip a BD)
                setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, estado: 'OCUPADA', mesero_activo_id: meseroId } : m));

                // Bloquear mesa al mesero actual (la ocupación real se deriva de la cuenta ABIERTA,
                // así que si esta escritura falla (RLS/columna faltante) la vista sigue correcta)
                const { error: errBloqueo } = await supabase.from('mesas').update({ mesero_activo_id: meseroId }).eq('id', mesa.id);
                if (errBloqueo) console.error('No se pudo guardar el mesero activo de la mesa:', errBloqueo.message);
            }

            // Lógica de reemplazo: si se está reemplazando a otro mesero
            if (reemplazarMesero && propietario && propietario !== meseroLogueado.id) {
                await crearHistorialAccion({
                    mesa_id: mesa.id,
                    mesero_id: propietario,
                    accion: 'REEMPLAZADO',
                    descripcion: `Tu mesa ${mesa.numero} fue tomada por ${meseroLogueado.nombre}`,
                });
                const meseroId = meseroLogueado.id === 0 ? 999 : meseroLogueado.id;
                const { error: errReemplazo } = await supabase.from('mesas').update({ mesero_activo_id: meseroId }).eq('id', mesa.id);
                if (errReemplazo) console.error('No se pudo actualizar el mesero activo al reemplazar:', errReemplazo.message);
                setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, mesero_activo_id: meseroId } : m));
            }

            // Actualizar estado UI
            const cuentasDeLaMesa = await obtenerCuentasAbiertasPorMesa(mesa.id);
            const indiceActivo = cuenta && cuentasDeLaMesa.length > 0
                ? cuentasDeLaMesa.findIndex(c => c.id === cuenta.id)
                : 0;

            setMesaSeleccionada(mesaObjetivo);
            setCuentaActual(cuenta);
            setMinicomandas(minis);
            setEstadoMesa(estadoCompleto);
            setCarroLocal(carroItems);
            setCuentasAbiertas(cuentasDeLaMesa);
            setCuentaActivaIndex(indiceActivo >= 0 ? indiceActivo : 0);

            console.log('[DEBUG seleccionarMesa]', {
                mesaId: mesa.id,
                mesaEstado: mesaObjetivo.estado,
                meseroActivoId: mesaObjetivo.mesero_activo_id,
                meseroLogueadoId: meseroLogueado?.id,
                cuentaEncontrada: !!cuenta,
                cuentaId: cuenta?.id,
                seatConfig: cuenta?.seat_config,
                minisCount: minis.length,
                carroItemsCount: carroItems.length,
                cuentasAbiertasCount: cuentasDeLaMesa.length
            });

        } catch (error) {
            console.error('Error al seleccionar mesa:', error);
            // Limpiar selección en caso de error
            setMesaSeleccionada(null);
            throw error;
        }
    };

    // Confirmar reemplazo de mesero (llamado desde el modal de WaiterView)
    const confirmarReemplazo = async () => {
        if (solicitudReemplazo) {
            const mesa = solicitudReemplazo.mesa;
            setSolicitudReemplazo(null);
            await seleccionarMesa(mesa, true);
        }
    };

    const cancelarReemplazo = () => setSolicitudReemplazo(null);

    // Obtener nombre del mesero por ID (para mostrar en UI)
    const obtenerNombreMesero = async (meseroId: number): Promise<string> => {
        try {
            const mesero = await obtenerMeseroPorId(meseroId);
            return mesero?.nombre || 'Desconocido';
        } catch {
            return 'Desconocido';
        }
    };

    // Recargar estado de mesa
    const recargarEstadoMesa = useCallback(async () => {
        // Usar la última cuentaActual conocida vía ref para evitar stale closures
        const cuentaActualViva = cuentaActualRef.current;
        if (mesaSeleccionada) {
            try {
                const estado = await obtenerEstadoMesaCompleto(mesaSeleccionada.id);
                setEstadoMesa(estado);

                // Mantener la cuenta que el usuario tiene seleccionada (no sobrescribir con la primera)
                const cuentaObjetivo = estado.cuenta ?? cuentaActualViva;

                if (cuentaObjetivo) {
                    // Filtrar minicomandas SOLO de la cuenta activa (evita mezclar cuentas divididas)
                    const minisFiltradas = cuentaActualViva
                        ? estado.minicomandas.filter(m => m.cuenta_id === cuentaActualViva.id)
                        : estado.minicomandas;
                    setCuentaActual(cuentaObjetivo);
                    setMinicomandas(minisFiltradas);
                }

                // Cargar carro local (solo si tiene items; evitar que un array vacío sobrescriba)
                const carro = await obtenerCarroLocal(mesaSeleccionada.id);
                if (carro && carro.length > 0) {
                    setCarroLocal(carro as CarroItem[]);
                }

                // Sincronizar lista de cuentas abiertas de la mesa, conservando la cuenta activa
                const cuentasDeLaMesa = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
                setCuentasAbiertas(cuentasDeLaMesa);
                if (cuentasDeLaMesa.length > 0 && cuentaActualViva) {
                    const idx = cuentasDeLaMesa.findIndex(c => c.id === cuentaActualViva.id);
                    if (idx >= 0) setCuentaActivaIndex(idx);
                    else setCuentaActivaIndex(0);
                }

                return estado;
            } catch (error) {
                console.error('Error al recargar estado de mesa:', error);
            }
        }
    }, [mesaSeleccionada]);

    // Cargar items de BD (enviados a cocina) con su estado — se llama al montar WaiterView y tras cambios
    const cargarItemsDeCocina = useCallback(async () => {
        if (!minicomandas || minicomandas.length === 0) {
            setItemsDeCocina([]);
            return;
        }
        try {
            const minisActivas = minicomandas.filter(m => m.estado !== 'ENTREGADO');
            const miniEstados = new Map(minicomandas.map(m => [m.id, m.estado]));
            const results = await Promise.allSettled(
                minisActivas.map(m => obtenerItemsPorMinicomanda(m.id))
            );
            const itemsConEstado = results
                .filter(r => r.status === 'fulfilled')
                .map((r: any) => r.value)
                .flat()
                .map(item => ({
                    ...item,
                    estado_minicomanda: miniEstados.get(item.minicomanda_id) || 'PENDIENTE'
                }));
            setItemsDeCocina(itemsConEstado);

            // Sincronizar asientos activos desde los items
            const seatsSet = new Set<number>(itemsConEstado.map(it => it.seat_number || 1));
            const seats: number[] = Array.from(seatsSet).sort((a, b) => a - b);
            setAsientosActivos(prev => {
                const todos = new Set<number>([...prev, ...seats]);
                return Array.from(todos).sort((a, b) => a - b);
            });
        } catch (error) {
            console.error('Error al cargar items de cocina:', error);
        }
    }, [minicomandas]);

    // Cargar items de cocina cuando cambien las minicomandas
    useEffect(() => {
        cargarItemsDeCocina();
    }, [cargarItemsDeCocina]);

    // Mantener la referencia de recargarEstadoMesa actualizada para el Realtime
    useEffect(() => { recargarEstadoMesaRef.current = recargarEstadoMesa; }, [recargarEstadoMesa]);

    // Agregar al carro
    const agregarAlCarro = (
        product: any,
        quantity: number,
        notes: string,
        options: any[],
        extras?: { nombre: string; precio: number }[],
        seatNumber?: number,
        sharedWith?: { seat: number; porcentaje: number; monto: number }[]
    ) => {
        console.log('[DEBUG agregarAlCarro] product:', product?.name, '| quantity:', quantity, '| options:', options);
        const asiento = seatNumber || comensalActivo;
        const optionFingerprint = options.map(o => `${o.optionName}:${o.choiceName}`).join('|');
        const extrasFingerprint = extras ? extras.map(e => `${e.nombre}:${e.precio}`).join('|') : '';
        const shareFingerprint = sharedWith
            ? '|SHARE:' + sharedWith.map(s => `${s.seat}:${s.porcentaje}:${s.monto}`).join(',')
            : '';
        const localId = `${product.id}-${optionFingerprint}-${extrasFingerprint}-${notes.substring(0, 10)}${shareFingerprint}-seat${asiento}`;
        console.log('[DEBUG agregarAlCarro] localId:', localId, '| carroLocal.length:', carroLocal.length);

        const existingIndex = carroLocal.findIndex(item => item.id === localId);
        if (existingIndex > -1) {
            const updated = [...carroLocal];
            updated[existingIndex].quantity += quantity;
            setCarroLocal(updated);
        } else {
            const newItem: CarroItem = {
                id: localId,
                product,
                quantity,
                notes,
                selectedOptions: options,
                selectedExtras: extras,
                seatNumber: sharedWith && sharedWith.length > 0 ? null : asiento,
                sharedWith
            };
            setCarroLocal([...carroLocal, newItem]);
        }
    };

    // Eliminar del carro
    const removeFromCarro = (cartItemId: string) => {
        setCarroLocal(carroLocal.filter(item => item.id !== cartItemId));
    };

    // Actualizar cantidad en carro
    const updateCarroQuantity = (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCarro(cartItemId);
            return;
        }
        setCarroLocal(carroLocal.map(item =>
            item.id === cartItemId ? { ...item, quantity } : item
        ));
    };

    // Limpiar carro
    const clearCarro = () => {
        setCarroLocal([]);
    };

    // Cambiar mesa (guardar carro actual explícitamente y deseleccionar)
    const cambiarMesa = async () => {
        if (mesaSeleccionada) {
            try {
                await guardarCarroLocal(mesaSeleccionada.id, carroLocal);
            } catch (error) {
                console.error('Error al guardar carro al cambiar mesa:', error);
            }
            // Respaldo directo en localStorage (por si el backend falla o cambia de modo)
            try {
                localStorage.setItem(`elbuencafe_carro_${mesaSeleccionada.id}`, JSON.stringify(carroLocal));
            } catch { /* ignorar */ }
        }
        setMesaSeleccionada(null);
        window.dispatchEvent(new CustomEvent('reload_tables'));
    };

// Calcular total del carro
    const calcularTotalCarro = () => {
      return carroLocal.reduce((sum, item) => {
          const optExtra = item.selectedOptions.reduce((oSum: number, o: any) => oSum + o.extraPrice, 0);
          const extrasTotal = item.selectedExtras?.reduce((eSum: number, e: any) => eSum + e.precio, 0) || 0;
          return sum + (item.product.price + optExtra + extrasTotal) * item.quantity;
      }, 0);
    };

    // Guardar carro local en IndexedDB
    useEffect(() => {
        if (mesaSeleccionada && carroLocal.length > 0) {
            guardarCarroLocal(mesaSeleccionada.id, carroLocal).catch(error => {
                console.error('Error al guardar carro:', error);
            });
            // Respaldo directo en localStorage
            try {
                localStorage.setItem(`elbuencafe_carro_${mesaSeleccionada.id}`, JSON.stringify(carroLocal));
            } catch { /* ignorar */ }
        }
    }, [carroLocal, mesaSeleccionada]);

    // Enviar a cocina
    const enviarACocina = async () => {
        if (enviandoACocina) return { ok: false, error: 'Ya se está enviando' };

        if (!mesaSeleccionada || !meseroLogueado || carroLocal.length === 0) {
            return { ok: false, error: 'Seleccione una mesa y agregue productos primero' };
        }

        // Validar que exista una cuenta activa
        if (!cuentaActual) {
            return { ok: false, error: 'No hay una cuenta activa para esta mesa. Intente seleccionar la mesa nuevamente.' };
        }

        setEnviandoACocina(true);

        try {
            // Agrupar items del carro por asiento (comensal) para crear una minicomanda por comensal
            const itemsPorAsiento = new Map<number, CarroItem[]>();
            for (const item of carroLocal) {
                const seat = item.seatNumber || 1;
                if (!itemsPorAsiento.has(seat)) itemsPorAsiento.set(seat, []);
                itemsPorAsiento.get(seat)!.push(item);
            }

            // Si el admin accede como mesero (id: 0), usar un ID especial
            const meseroId = meseroLogueado.id === 0 ? 999 : meseroLogueado.id;

            // Crear una minicomanda por comensal y sus items
            for (const [seat, itemsAsiento] of itemsPorAsiento) {
                const totalAsiento = itemsAsiento.reduce((sum, item) => {
                    const optExtra = item.selectedOptions.reduce((oSum: number, o: any) => oSum + o.extraPrice, 0);
                    const extrasTotal = item.selectedExtras?.reduce((eSum: number, e: any) => eSum + e.precio, 0) || 0;
                    return sum + (item.product.price + optExtra + extrasTotal) * item.quantity;
                }, 0);

                const nuevaMinicomanda: Omit<Minicomanda, 'id'> = {
                    cuenta_id: cuentaActual.id,
                    mesa_id: mesaSeleccionada.id,
                    mesero_id: meseroId,
                    estado: 'PENDIENTE',
                    fecha_envio: new Date().toISOString(),
                    total: totalAsiento
                };

                const minicomandaId = await crearMinicomanda(nuevaMinicomanda);

                for (const item of itemsAsiento) {
                    const optExtra = item.selectedOptions.reduce((oSum: number, o: any) => oSum + o.extraPrice, 0);
                    const extrasTotal = item.selectedExtras?.reduce((eSum: number, e: any) => eSum + e.precio, 0) || 0;
                    const precioUnitario = item.product.price + optExtra + extrasTotal;
                    const totalItem = precioUnitario * item.quantity;

                    const esCompartido = !!(item.sharedWith && item.sharedWith.length > 1);

                    const itemId = await crearItemMinicomanda({
                        minicomanda_id: minicomandaId,
                        producto_id: item.product.id,
                        cantidad: item.quantity,
                        precio_unitario: precioUnitario,
                        notas: esCompartido ? `${item.notes} – Compartida`.trim() : item.notes,
                        total_item: totalItem,
                        // Ítem compartido: seat_number = NULL (el reparto vive en item_comensal_share)
                        seat_number: esCompartido ? null : (item.seatNumber || 1)
                    });

                    // Si es compartido, registrar el reparto por comensal
                    if (esCompartido) {
                        for (const share of item.sharedWith!) {
                            await crearItemComensalShare({
                                item_id: itemId,
                                seat_number: share.seat,
                                porcentaje: share.porcentaje,
                                monto: share.monto,
                                pagado: false
                            });
                        }
                    }

                    // Guardar opciones seleccionadas (filas hijas de items_opciones).
                    // Solo DESPUÉS de tener el item_id del items_minicomanda recién creado.
                    if (item.selectedOptions.length > 0) {
                        await crearMultiplesOpciones(
                            item.selectedOptions.map(opt => ({
                                item_id: itemId,
                                opcion_nombre: opt.optionName,
                                choice_nombre: opt.choiceName,
                                precio_extra: opt.extraPrice
                            }))
                        );
                    }

                    // Guardar extras seleccionados (filas hijas de item_extras).
                    // nombre + precio son snapshot histórico; extra_id queda null
                    // porque selectedExtras no conserva el id del catálogo.
                    if (item.selectedExtras && item.selectedExtras.length > 0) {
                        await crearMultiplesItemExtras(
                            item.selectedExtras.map(ex => ({
                                item_id: itemId,
                                extra_id: null,
                                nombre: ex.nombre,
                                precio: ex.precio
                            }))
                        );
                    }
                }
            }

            // Actualizar total acumulado de la cuenta
            const totalCarro = calcularTotalCarro();
            const nuevaCuenta = { ...cuentaActual, total_acumulado: cuentaActual.total_acumulado + totalCarro };
            await actualizarCuenta(nuevaCuenta);

            // Actualizar el estado local de cuentaActual con el nuevo total
            setCuentaActual(nuevaCuenta);

            // Capturar items antes de limpiar el carro
            const itemsEnviados = [...carroLocal];

            // Guardar en historial
            await crearHistorialAccion({
                cuenta_id: cuentaActual.id,
                mesa_id: mesaSeleccionada.id,
                mesero_id: meseroId,
                accion: 'ENVIAR_COCINA',
                descripcion: `Comanda enviada a cocina (${itemsPorAsiento.size} comensal/es)`,
                monto: totalCarro
            });

            // Limpiar carro (estado React + localStorage/IndexedDB)
            setCarroLocal([]);
            await limpiarCarroLocal(mesaSeleccionada!.id);

            // Recargar estado
            await recargarEstadoMesa();

            return { ok: true, items: itemsEnviados, total: totalCarro };
        } catch (error) {
            console.error('Error al enviar a cocina:', error);
            return { ok: false, error: (error as Error).message };
        } finally {
            setEnviandoACocina(false);
        }
    };

    // Actualizar estado de minicomanda (UPDATE parcial por intención C3:
    // solo escribe `estado` + `fecha_entrega` cuando corresponde; nunca
    // reenvía `cuenta_id` ni el resto del snapshot para no revertir
    // movimientos concurrentes de cuenta).
    const actualizarEstadoMinicomanda = async (minicomandaId: number, estado: MinicomandaEstado) => {
        try {
            // Lectura solo para trazabilidad (estadoAnterior en el log); la
            // escritura parcial no utiliza ningún campo del snapshot.
            const minicomanda = await obtenerMinicomandaPorId(minicomandaId);
            if (minicomanda) {
                const estadoAnterior = minicomanda.estado;
                // [KDS-TRACE] Instrumentación temporal de diagnóstico — solo observa, no altera lógica.
                console.log(`[KDS-TRACE] DB_UPDATE_START id=${String(minicomandaId)} estadoAnterior=${String(estadoAnterior)} estadoNuevo=${String(estado)} timestamp=${new Date().toISOString()}`);
                await actualizarEstadoMinicomandaParcial(minicomandaId, estado);
                console.log(`[KDS-TRACE] DB_UPDATE_SUCCESS id=${String(minicomandaId)} estadoNuevo=${String(estado)} timestamp=${new Date().toISOString()}`);
            }
            await recargarEstadoMesa();

            // Realtime se encarga de notificar a otros dispositivos automáticamente
            recargarContadorPendientes();
        } catch (error) {
            console.log(`[KDS-TRACE] DB_UPDATE_ERROR id=${String(minicomandaId)} error=${String(error)} timestamp=${new Date().toISOString()}`);
            console.error('Error al actualizar estado de minicomanda:', error);
        }
    };

    // Devolver minicomanda a mesero para modificacion
    const devolverAMesero = async (minicomandaId: number) => {
        try {
            await actualizarEstadoMinicomanda(minicomandaId, 'DEVUELTA');
        } catch (error) {
            console.error('Error al devolver minicomanda a mesero:', error);
        }
    };

    // Cobrar cuenta
    const cobrarCuenta = async (totalPagado: number, cambio: number, metodoPago: MetodoPago, referencia?: string): Promise<CobroResultado | null> => {
        throw new Error(
            'DEPRECATED (C9.12): cobrarCuenta es ruta legacy sin garantías C9.7. ' +
            'Usar cobrarAsientos (RPC cobrar_asientos).'
        );
        if (!mesaSeleccionada || !cuentaActual) {
            alert('Error: No hay cuenta activa');
            return null;
        }

        try {
            // Capturar datos antes de limpiar el estado
            const mesaNumero = mesaSeleccionada.numero;

            // Guardar referencia si se proporcionó
            if (referencia) {
                await supabase.from('cuentas').update({ notas: `Ref: ${referencia}` }).eq('id', cuentaActual.id);
            }

            // Cerrar cuenta
            await cerrarCuenta(cuentaActual.id, totalPagado, cambio, metodoPago);

            // Guardar en historial
            await crearHistorialAccion({
                cuenta_id: cuentaActual.id,
                mesa_id: mesaSeleccionada.id,
                mesero_id: meseroLogueado!.id,
                accion: 'COBRAR_CUENTA',
                descripcion: `Cuenta cobrada por ${meseroLogueado!.nombre}. Total: $${totalPagado.toFixed(2)}, Recibido: $${totalPagado.toFixed(2)}, Cambio: $${cambio.toFixed(2)}, Método: ${metodoPago}${referencia ? `, Ref: ${referencia}` : ''}`,
                monto: totalPagado
            });

            // Verificar si quedan otras cuentas abiertas en la mesa
            const cuentasRestantes = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
            setCuentasAbiertas(cuentasRestantes);

            if (cuentasRestantes.length > 0) {
                // Todavía hay cuentas por cobrar → la mesa sigue OCUPADA
                const siguiente = cuentasRestantes[0];
                const minisSiguiente = await obtenerMinicomandasPorCuenta(siguiente.id);
                const carroSiguiente = await obtenerCarroLocal(mesaSeleccionada.id);

                setCuentaActual(siguiente);
                setMinicomandas(minisSiguiente);
                setCuentaActivaIndex(0);
                setCarroLocal((carroSiguiente as CarroItem[]) || []);

                return {
                    mesaNumero,
                    totalPagado,
                    cambio,
                    metodoPago,
                    referencia,
                    tipo: 'global',
                    mesaLiberada: false,
                    pendientesRestantes: cuentasRestantes.length
                };
            }

            // No quedan cuentas → liberar mesa para nuevos clientes
            await actualizarEstadoMesa(mesaSeleccionada.id, 'LIBRE');
            await limpiarCarroLocal(mesaSeleccionada.id);
            setMesas(prev => prev.map(m => m.id === mesaSeleccionada.id ? { ...m, estado: 'LIBRE', mesero_activo_id: undefined } : m));

            // Limpiar bloqueo de mesa
            const { error: errLiberarMesa } = await supabase.from('mesas').update({ mesero_activo_id: null }).eq('id', mesaSeleccionada.id);
            if (errLiberarMesa) console.error('No se pudo liberar el mesero activo de la mesa:', errLiberarMesa.message);

            // Limpiar estado
            setMesaSeleccionada(null);
            setEstadoMesa(null);
            setCuentaActual(null);
            setMinicomandas([]);
            setCarroLocal([]);
            setCuentasAbiertas([]);
            setCuentaActivaIndex(0);

            // Recargar mesas
            await cargarMesas();

            return {
                mesaNumero,
                totalPagado,
                cambio,
                metodoPago,
                referencia,
                tipo: 'global',
                mesaLiberada: true,
                pendientesRestantes: 0
            };
        } catch (error) {
            console.error('Error al cobrar cuenta:', error);
            alert('Error al cobrar cuenta');
            return null;
        }
    };

    // Cobrar uno o varios comensales (asientos) via RPC atomica C9.
    // Camino economico unico: supabase.rpc('cobrar_asientos'). FAIL CLOSED:
    // sin ruta local si Supabase falla.
    const cobrarAsientos = async (
        seatNumbers: number[],
        totalPagado: number,
        cambio: number,
        metodoPago: MetodoPago,
        referencia: string | undefined,
        idempotencyKey: string
    ): Promise<CobroResultado | null> => {
        if (!mesaSeleccionada || !cuentaActual || seatNumbers.length === 0) {
            alert('Error: No hay cuenta activa o asientos seleccionados');
            return null;
        }
        if (!meseroLogueado) {
            alert('Error: No hay mesero autenticado');
            return null;
        }
        // C9.12 Fase 1.5: la idempotency_key la genera el caller UNA vez por
        // operacion de cobro y se reutiliza en reintentos (incluido retry
        // manual tras timeout). Aqui NO se genera ni se regenera: recibir una
        // key vacia es FAIL CLOSED, nunca se inventa una nueva.
        if (!idempotencyKey) {
            console.error('Error al cobrar asientos: falta idempotencyKey del caller (FAIL CLOSED)');
            alert('Error al cobrar: falta la clave de la operación. No se aplicó ningún cobro.');
            return null;
        }

        try {
            // Capturar datos antes de limpiar el estado
            const mesaNumero = mesaSeleccionada.numero;
            const mesaId = mesaSeleccionada.id;
            const meseroId = meseroLogueado.id === 0 ? 999 : meseroLogueado.id;

            if (!isSupabaseConfigured()) {
                console.error('Error al cobrar asientos: Supabase no configurado (FAIL CLOSED)');
                alert('Error al cobrar: servicio no disponible. No se aplicó ningún cobro.');
                return null;
            }

            const { data, error } = await supabase.rpc('cobrar_asientos', {
                p_mesa_id: mesaId,
                p_seat_numbers: seatNumbers,
                p_total_recibido: totalPagado,
                p_cambio: cambio,
                p_metodo_pago: metodoPago,
                p_referencia: referencia ?? null,
                p_mesero_id: meseroId,
                p_idempotency_key: idempotencyKey
            });

            if (error) {
                console.error('Error al cobrar asientos:', error);
                const codigo = (error as { code?: string }).code ?? '';
                const mensaje = (error as { message?: string }).message ?? '';
                const texto = `${codigo} ${mensaje}`;
                if (texto.includes('C9001') || texto.includes('DUPLICATE_KEY_CONFLICT')) {
                    alert('Error de cobro (DUPLICATE_KEY_CONFLICT): la clave de este intento ya se usó con parámetros distintos. No se aplicó ningún cobro adicional.');
                } else if (texto.includes('C9002') || texto.includes('SHARE_HUERFANO')) {
                    alert('No se pudo cobrar: hay un ítem compartido sin reparto válido. Revisa la cuenta antes de reintentar. No se aplicó ningún cobro.');
                } else if (texto.includes('C9003')) {
                    alert(`No se pudo cobrar: ${mensaje}`);
                } else {
                    alert('Error al cobrar');
                }
                return null;
            }

            const crudo: unknown = Array.isArray(data) ? (data as unknown[])[0] : data;
            const resultado = crudo as {
                status?: string;
                recibido?: number;
                cambio?: number;
                mesa_liberada?: boolean;
                pendientes_restantes?: number;
            } | null;

            if (!resultado || typeof resultado.status !== 'string') {
                console.error('Error al cobrar asientos: respuesta inesperada del RPC', data);
                alert('Error al cobrar');
                return null;
            }

            if (resultado.status === 'COBRADO' || resultado.status === 'YA_PROCESADO') {
                const mesaLiberada = resultado.mesa_liberada === true;
                const pendientesRestantes = Number(resultado.pendientes_restantes ?? 0);
                const recibido = Number(resultado.recibido);
                const cambioRpc = Number(resultado.cambio);
                const cobro: CobroResultado = {
                    mesaNumero,
                    totalPagado: recibido,
                    cambio: cambioRpc,
                    metodoPago,
                    referencia,
                    tipo: 'asientos',
                    mesaLiberada,
                    pendientesRestantes,
                    asientosCobrados: seatNumbers
                };

                if (mesaLiberada) {
                    setMesaSeleccionada(null);
                    setEstadoMesa(null);
                    setCuentaActual(null);
                    setMinicomandas([]);
                    setCarroLocal([]);
                    setCuentasAbiertas([]);
                    setCuentaActivaIndex(0);
                    setMesas(prev => prev.map(m => m.id === mesaId ? { ...m, estado: 'LIBRE', mesero_activo_id: undefined } : m));
                    await cargarMesas();
                    return cobro;
                }

                // La mesa sigue activa: refresco de UI por lectura (sin aplicar dinero).
                const restantes = await obtenerCuentasAbiertasPorMesa(mesaId);
                setCuentasAbiertas(restantes);
                if (restantes.length > 0) {
                    const siguiente = restantes[0];
                    setCuentaActual(siguiente);
                    const minisSiguiente = await obtenerMinicomandasPorCuenta(siguiente.id);
                    setMinicomandas(minisSiguiente);
                    setCuentaActivaIndex(0);
                } else {
                    await recargarEstadoMesa();
                }
                return cobro;
            }

            if (resultado.status === 'SIN_CAMBIOS') {
                await recargarEstadoMesa();
                alert('No había nada pendiente por cobrar para los asientos seleccionados.');
                return null;
            }

            console.error('Error al cobrar asientos: estado no reconocido', resultado.status);
            alert('Error al cobrar');
            return null;
        } catch (error) {
            console.error('Error al cobrar asientos:', error);
            alert('Error al cobrar');
            return null;
        }
    };

    // Resolver la porción pendiente de un comensal que se retira de un ítem compartido.
    // Opciones:
    //   'pasar'     -> transferir la porción a otro comensal (destino)
    //   'repartir'  -> repartir la porción entre los demás comensales que siguen
    //   'completa'  -> el comensal absorbe toda la responsabilidad pendiente
    //                   (se reasigna, nunca se marca deuda ajena como pagada)
    // Distribución exacta en centavos con convención determinista de negocio:
    // el residuo se reparte de a 1¢ entre las ÚLTIMAS `resto` partes, es decir,
    // la parte i recibe base+1 solo si i >= n - resto. Así:
    //   95/2  -> [4750, 4750]  ($47.50 / $47.50)
    //   95/3  -> [3166, 3167, 3167]  ($31.66 / $31.67 / $31.67)
    //   100/3 -> [3333, 3333, 3334]  ($33.33 / $33.33 / $33.34)
    // Difiere deliberadamente de repartirExacto de WaiterView (todo el residuo
    // al último índice: 95/3 -> [3166,3166,3168]) y de montosExactos (requiere
    // porcentajes y también absorbe en el último); ninguna de esas lógicas
    // existentes puede producir el triple mandado sin modificarse globalmente
    // (prohibido). Implementado aquí porque AccountContext no puede importar
    // del componente sin crear dependencia circular.
    const repartirCentavosExactos = (totalCents: number, n: number): number[] => {
        if (n <= 0) return [];
        const base = Math.floor(totalCents / n);
        const resto = totalCents - base * n;
        return Array.from({ length: n }, (_, i) => base + (i >= n - resto ? 1 : 0));
    };

    // Porcentajes exactos en centésimas para un conjunto de montos (centavos) cuya
    // suma es totalCents. El último absorbe el residuo para sumar 100.00% siempre.
    const porcentajesExactos = (montosCents: number[], totalCents: number): number[] => {
        if (totalCents <= 0 || montosCents.length === 0) return montosCents.map(() => 0);
        const partes = montosCents.map(m => Math.floor((m * 10000) / totalCents));
        const suma = partes.reduce((s, p) => s + p, 0);
        partes[partes.length - 1] += 10000 - suma;
        return partes.map(p => p / 100);
    };

    // Relee los shares y verifica Σ montos == total_item (en centavos).
    // Detecta estados parcialmente modificados tras una operación de BD.
    const validarIntegridadShares = async (itemId: number, totalItem: number): Promise<void> => {
        const rows = await obtenerSharesPorItem(itemId);
        const suma = rows.reduce((s: number, r: any) => s + Math.round(Number(r.monto) * 100), 0);
        if (suma !== Math.round(Number(totalItem) * 100)) {
            throw new Error(`Integridad de reparto rota en item ${itemId}: shares suman ${suma} vs total ${Math.round(Number(totalItem) * 100)}`);
        }
    };

    // Convierte un ítem individual en compartido durante el checkout:
    // seat_number -> null + shares exactos (todas pagado=false).
    // Orden fail-safe: si los INSERT fallan tras el UPDATE, el ítem queda huérfano
    // y el checkout lo bloquea ("Participación no disponible"); nunca se cobra de más.
    const compartirItemIndividual = async (
        itemId: number,
        reparto: { seat: number; porcentaje: number; monto: number }[]
    ): Promise<void> => {
        try {
            const item = await obtenerItemMinicomandaPorId(itemId);
            if (!item) {
                alert('Ítem no encontrado');
                return;
            }
            if (item.seat_number === null) {
                alert('El ítem ya está compartido');
                return;
            }
            const existentes = await obtenerSharesPorItem(itemId);
            if (existentes.length > 0) {
                alert('El ítem ya tiene participaciones registradas');
                return;
            }
            if (!reparto || reparto.length < 2) {
                alert('Selecciona al menos 2 comensales para compartir');
                return;
            }
            const totalCents = Math.round(Number(item.total_item) * 100);
            const sumaCents = reparto.reduce((s, r) => s + Math.round(Number(r.monto) * 100), 0);
            if (sumaCents !== totalCents) {
                alert('El reparto no suma el total del platillo');
                return;
            }
            await actualizarItemMinicomanda({ ...item, seat_number: null });
            for (const r of reparto) {
                await crearItemComensalShare({
                    item_id: itemId,
                    seat_number: r.seat,
                    porcentaje: Number(r.porcentaje),
                    monto: Number(r.monto),
                    pagado: false
                });
            }
            await validarIntegridadShares(itemId, item.total_item);
            await recargarEstadoMesa();
        } catch (error) {
            console.error('Error al compartir el platillo:', error);
            alert('No se pudo compartir el platillo. Revisa la cuenta antes de cobrar.');
        }
    };

    const resolverSalidaComensal = async (
        itemId: number,
        asientoSale: number,
        decision: 'pasar' | 'repartir' | 'completa',
        destino?: number,
        asientosRestantes?: number[]
    ): Promise<void> => {
        try {
            const item = await obtenerItemMinicomandaPorId(itemId);
            if (!item) return;
            const shares = await obtenerSharesPorItem(itemId);
            const shareSale = shares.find(s => s.seat_number === asientoSale && !s.pagado);
            // Sin porción pendiente del que sale (ya pagada o inexistente): no-op
            // controlado. Nunca se transfiere ni se revive dinero liquidado.
            if (!shareSale) return;

            const totalCents = Math.round(Number(item.total_item) * 100);

            if (decision === 'pasar' && destino) {
                // Transferir únicamente la porción pendiente: cambia el responsable,
                // conserva monto, porcentaje y estado. Σ e invariantes intactos.
                await actualizarShare({ ...shareSale, seat_number: destino });
                await validarIntegridadShares(itemId, item.total_item);
                return;
            }

            if (decision === 'repartir') {
                // La porción pendiente del que sale se distribuye entre los demás
                // DEUDORES: asientos con deuda impaga (se excluye al que sale, a
                // los ya liquidados y a quienes nunca participaron: no se crea
                // deuda fantasma ni se reabre deuda pagada).
                // Las filas pagadas (suyas o ajenas) y los montos ajenos NO se tocan.
                const otros = (asientosRestantes || shares.map(s => s.seat_number))
                    .filter(s => s !== asientoSale);
                const deudores = otros.filter(seat => shares.some(s => s.seat_number === seat && !s.pagado));
                // Sin destinatarios válidos: no-op. Nunca una redistribución destructiva.
                if (deudores.length === 0) return;
                const montoSaleCents = Math.round(Number(shareSale.monto) * 100);
                const partes = repartirCentavosExactos(montoSaleCents, deudores.length);
                // Nuevo conjunto: se conservan pagadas e impagas ajenas; la parte del
                // que sale se suma a la fila impaga de cada deudor (siempre existe).
                // Una sola fila impaga por asiento.
                const filas: { seat: number; montoCents: number; pagado: boolean }[] = [];
                for (const s of shares) {
                    if (s.seat_number === asientoSale && !s.pagado) continue; // sale su parte
                    filas.push({ seat: s.seat_number, montoCents: Math.round(Number(s.monto) * 100), pagado: s.pagado });
                }
                deudores.forEach((seat, i) => {
                    const ex = filas.find(f => f.seat === seat && !f.pagado);
                    if (ex) ex.montoCents += partes[i];
                });
                const pcts = porcentajesExactos(filas.map(f => f.montoCents), totalCents);
                await eliminarSharesPorItem(itemId);
                for (let i = 0; i < filas.length; i++) {
                    await crearItemComensalShare({
                        item_id: itemId,
                        seat_number: filas[i].seat,
                        porcentaje: pcts[i],
                        monto: filas[i].montoCents / 100,
                        pagado: filas[i].pagado
                    });
                }
                await validarIntegridadShares(itemId, item.total_item);
                return;
            }

            if (decision === 'completa') {
                // Absorción real: toda la responsabilidad PENDIENTE del platillo se
                // reasigna al comensal, que la pagará en el checkout. Nunca se marca
                // deuda ajena como pagada sin cobrarla.
                const impagas = shares.filter(s => !s.pagado);
                const montoAbsCents = impagas.reduce((s: number, r: any) => s + Math.round(Number(r.monto) * 100), 0);
                if (montoAbsCents <= 0) return; // nada pendiente: no-op
                // Nuevo conjunto: pagadas intactas + una sola fila impaga del
                // absorbente con todo lo pendiente; impagas ajenas eliminadas.
                const filas: { seat: number; montoCents: number; pagado: boolean }[] = [];
                for (const s of shares) {
                    if (!s.pagado) continue;
                    filas.push({ seat: s.seat_number, montoCents: Math.round(Number(s.monto) * 100), pagado: true });
                }
                filas.push({ seat: asientoSale, montoCents: montoAbsCents, pagado: false });
                const pcts = porcentajesExactos(filas.map(f => f.montoCents), totalCents);
                await eliminarSharesPorItem(itemId);
                for (let i = 0; i < filas.length; i++) {
                    await crearItemComensalShare({
                        item_id: itemId,
                        seat_number: filas[i].seat,
                        porcentaje: pcts[i],
                        monto: filas[i].montoCents / 100,
                        pagado: filas[i].pagado
                    });
                }
                await validarIntegridadShares(itemId, item.total_item);
                return;
            }
        } catch (error) {
            console.error('Error al resolver salida de comensal:', error);
            alert('Error al resolver la porción del ítem compartido. Revisa la cuenta antes de cobrar.');
        }
    };

    // Actualizar el reparto de un ítem compartido ya enviado a cocina
    const actualizarRepartoItem = async (
        itemId: number,
        nuevosShares: { seat: number; porcentaje: number; monto: number }[]
    ): Promise<void> => {
        try {
            await eliminarSharesPorItem(itemId);
            for (const s of nuevosShares) {
                await crearItemComensalShare({
                    item_id: itemId,
                    seat_number: s.seat,
                    porcentaje: s.porcentaje,
                    monto: s.monto,
                    pagado: false
                });
            }
        } catch (error) {
            console.error('Error al actualizar reparto:', error);
            alert('Error al actualizar el reparto del ítem');
        }
    };

    // Liberar mesa
    const liberarMesa = async (): Promise<boolean> => {
        if (!mesaSeleccionada) {
            return false;
        }

        try {
            // Cerrar TODAS las cuentas ABIERTA de la mesa (puede haber varias si se abrieron
            // duplicadas en pruebas o por división por asiento). Si solo se cerrara la actual,
            // al recargar la mesa seguiría "ocupada" por las cuentas restantes.
            const abiertasDeMesa = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
            for (const cuenta of abiertasDeMesa) {
                // Cerrar cuenta sin cobro (monto 0, cambio 0)
                await cerrarCuenta(cuenta.id, 0, 0, 'efectivo');

                // Guardar en historial
                if (meseroLogueado) {
                    await crearHistorialAccion({
                        cuenta_id: cuenta.id,
                        mesa_id: mesaSeleccionada.id,
                        mesero_id: meseroLogueado.id,
                        accion: 'CANCELAR_CUENTA',
                        descripcion: `Cuenta cancelada y mesa liberada por ${meseroLogueado.nombre}`,
                        monto: 0
                    });
                }
            }

            // Actualizar estado de mesa a LIBRE
            await actualizarEstadoMesa(mesaSeleccionada.id, 'LIBRE');
            const { error: errLiberarMesa } = await supabase.from('mesas').update({ mesero_activo_id: null }).eq('id', mesaSeleccionada.id);
            if (errLiberarMesa) console.error('No se pudo liberar el mesero activo de la mesa:', errLiberarMesa.message);
            await limpiarCarroLocal(mesaSeleccionada.id);
            setMesas(prev => prev.map(m => m.id === mesaSeleccionada.id ? { ...m, estado: 'LIBRE', mesero_activo_id: undefined } : m));

            // Limpiar estado
            setMesaSeleccionada(null);
            setEstadoMesa(null);
            setCuentaActual(null);
            setMinicomandas([]);
            setCarroLocal([]);

            // Recargar mesas
            await cargarMesas();

            return true;
        } catch (error) {
            console.error('Error al liberar mesa:', error);
            alert('Error al liberar mesa');
            return false;
        }
    };

    // Seleccionar una cuenta abierta de la mesa (cambiar entre cuentas divididas)
    const seleccionarCuentaAbierta = async (index: number) => {
        if (!mesaSeleccionada) return;
        const cuenta = cuentasAbiertas[index];
        if (!cuenta) return;

        const minis = await obtenerMinicomandasPorCuenta(cuenta.id);
        const carro = await obtenerCarroLocal(mesaSeleccionada.id);
        const estado = await obtenerEstadoMesaCompleto(mesaSeleccionada.id);

        setCuentaActual(cuenta);
        setMinicomandas(minis);
        setEstadoMesa(estado);
        setCarroLocal((carro as CarroItem[]) || []);
        setCuentaActivaIndex(index);
    };

    // Mover un item de minicomanda a otra cuenta (división por asiento: mover ítems individuales)
    const moverItem = async (itemId: number, nuevaCuentaId: number) => {
        if (!mesaSeleccionada || !cuentaActual) {
            alert('No hay una cuenta activa');
            return;
        }

        try {
            // Obtener el item y su minicomanda actual
            const item = await obtenerItemMinicomandaPorId(itemId);
            if (!item) {
                alert('Ítem no encontrado');
                return;
            }

            const minicomandaActual = await obtenerMinicomandaPorId(item.minicomanda_id);
            const meseroId = meseroLogueado!.id === 0 ? 999 : meseroLogueado!.id;

            // Buscar o crear una minicomanda en la cuenta destino para ese asiento
            const minisDestino = await obtenerMinicomandasPorCuenta(nuevaCuentaId);
            let minicomandaDestino = minisDestino.find(m => m.estado === 'PENDIENTE' && (m as any).seat_number === item.seat_number);
            let minicomandaDestinoId: number;

            if (!minicomandaDestino) {
                const nuevaMini: Omit<Minicomanda, 'id'> = {
                    cuenta_id: nuevaCuentaId,
                    mesa_id: mesaSeleccionada.id,
                    mesero_id: meseroId,
                    estado: 'PENDIENTE',
                    fecha_envio: new Date().toISOString(),
                    total: 0
                };
                minicomandaDestinoId = await crearMinicomanda(nuevaMini);
            } else {
                minicomandaDestinoId = minicomandaDestino.id;
            }

            // Mover el item
            await moverItemACuenta(itemId, minicomandaDestinoId);

            // Recalcular totales de ambas minicomandas y cuentas
            const minisOrigen = await obtenerMinicomandasPorCuenta(cuentaActual.id);
            const minisDest = await obtenerMinicomandasPorCuenta(nuevaCuentaId);

            const totalOrigen = minisOrigen.reduce((s, m) => s + m.total, 0);
            const totalDest = minisDest.reduce((s, m) => s + m.total, 0);

            await actualizarCuenta({ ...cuentaActual, total_acumulado: totalOrigen });
            const cuentaDestino = await obtenerCuentaPorId(nuevaCuentaId);
            if (cuentaDestino) {
                await actualizarCuenta({ ...cuentaDestino, total_acumulado: totalDest });
            }

            // Si la minicomanda de origen quedó vacía, cerrarla (UPDATE parcial:
            // solo `estado` + `fecha_entrega`; no reenviar el snapshot).
            const itemsOrigen = await obtenerItemsPorMinicomanda(item.minicomanda_id);
            if (itemsOrigen.length === 0) {
                await actualizarEstadoMinicomandaParcial(minicomandaActual!.id, 'ENTREGADO');
            }

            await recargarEstadoMesa();
            const cuentas = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
            setCuentasAbiertas(cuentas);
            alert('Ítem movido con éxito');
        } catch (error) {
            console.error('Error al mover item:', error);
            alert('Error al mover el ítem');
        }
    };

    // Generar una sub-cuenta por cada comensal (división por asiento)
    const dividirPorAsiento = async (numComensales: number) => {
        if (!mesaSeleccionada || !cuentaActual) {
            alert('No hay una cuenta activa');
            return;
        }

        try {
            const meseroId = meseroLogueado!.id === 0 ? 999 : meseroLogueado!.id;

            // Obtener todos los items de la cuenta agrupados por asiento
            const subtotales = await obtenerSubtotalesPorAsiento(cuentaActual.id);

            // Asientos presentes
            const asientos = subtotales.map(s => s.seat_number).sort((a, b) => a - b);

            if (asientos.length <= 1) {
                alert('Todos los platos ya están asignados a un solo comensal. No hay división que hacer.');
                return;
            }

            // Para cada asiento con items, crear una sub-cuenta y mover sus minicomandas
            for (const seat of asientos) {
                if (seat === asientos[0]) continue; // El primer asiento se queda en la cuenta original

                const nuevaCuenta: Omit<Cuenta, 'id' | 'created_at'> = {
                    mesa_id: mesaSeleccionada.id,
                    mesero_id: meseroId,
                    estado: 'ABIERTA',
                    total_acumulado: 0,
                    fecha_apertura: new Date().toISOString()
                };
                const nuevaCuentaId = await crearCuenta(nuevaCuenta);

                // Mover todas las minicomandas de ese asiento a la nueva cuenta
                // (UPDATE parcial: solo `cuenta_id`, sin reenviar el snapshot).
                const minis = await obtenerMinicomandasPorCuenta(cuentaActual.id);
                for (const mini of minis) {
                    const itemsMini = await obtenerItemsPorMinicomanda(mini.id);
                    const perteneceAlAsiento = itemsMini.some(it => (it.seat_number || 1) === seat);
                    if (perteneceAlAsiento) {
                        await actualizarCuentaDeMinicomanda(mini.id, nuevaCuentaId);
                    }
                }

                const minisNuevas = await obtenerMinicomandasPorCuenta(nuevaCuentaId);
                const totalNuevo = minisNuevas.reduce((s, m) => s + m.total, 0);
                await actualizarCuenta({ ...nuevaCuenta, id: nuevaCuentaId, created_at: nuevaCuenta.fecha_apertura, total_acumulado: totalNuevo });

                await crearHistorialAccion({
                    cuenta_id: nuevaCuentaId,
                    mesa_id: mesaSeleccionada.id,
                    mesero_id: meseroId,
                    accion: 'DIVIDIR_POR_ASIENTO',
                    descripcion: `Sub-cuenta creada para comensal ${seat}. Total: $${totalNuevo.toFixed(2)}`,
                    monto: totalNuevo
                });
            }

            // Recalcular cuenta original
            const minisOriginales = await obtenerMinicomandasPorCuenta(cuentaActual.id);
            const totalOriginal = minisOriginales.reduce((s, m) => s + m.total, 0);
            await actualizarCuenta({ ...cuentaActual, total_acumulado: totalOriginal });

            alert('Cuenta dividida por comensal con éxito');
            await recargarEstadoMesa();
            const cuentas = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
            setCuentasAbiertas(cuentas);
        } catch (error) {
            console.error('Error al dividir por asiento:', error);
            alert('Error al dividir la cuenta por comensal');
        }
    };

    // Combinar varias cuentas abiertas en la primera (unir comensales restantes)
    const combinarCuentas = async (cuentaIds: number[]) => {
        if (!mesaSeleccionada || cuentaIds.length < 2) {
            alert('Selecciona al menos 2 cuentas para combinar');
            return;
        }

        try {
            const meseroId = meseroLogueado!.id === 0 ? 999 : meseroLogueado!.id;
            const [cuentaDestinoId, ...otrasCuentas] = cuentaIds;

            const cuentaDestino = await obtenerCuentaPorId(cuentaDestinoId);
            if (!cuentaDestino) {
                alert('No se encontró la cuenta destino');
                return;
            }

            // Mover todas las minicomandas de las cuentas a combinar hacia la destino
            // (UPDATE parcial: solo `cuenta_id`, sin reenviar el snapshot).
            for (const id of otrasCuentas) {
                const minis = await obtenerMinicomandasPorCuenta(id);
                for (const mini of minis) {
                    await actualizarCuentaDeMinicomanda(mini.id, cuentaDestinoId);
                }
            }

            // Recalcular totales de la cuenta destino
            const minisDestino = await obtenerMinicomandasPorCuenta(cuentaDestinoId);
            const totalDestino = minisDestino.reduce((s, m) => s + m.total, 0);
            await actualizarCuenta({ ...cuentaDestino, total_acumulado: totalDestino });

            // Cerrar (sin cobro) las cuentas combinadas que no son la destino
            for (const id of otrasCuentas) {
                await cerrarCuenta(id, 0, 0, 'efectivo');
                await crearHistorialAccion({
                    cuenta_id: id,
                    mesa_id: mesaSeleccionada.id,
                    mesero_id: meseroId,
                    accion: 'COMBINAR_CUENTA',
                    descripcion: `Cuenta combinada en cuenta #${cuentaDestinoId}`,
                    monto: 0
                });
            }

            // Recargar lista de cuentas abiertas y activar la destino
            const cuentas = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
            setCuentasAbiertas(cuentas);
            const idxDestino = cuentas.findIndex(c => c.id === cuentaDestinoId);
            await seleccionarCuentaAbierta(idxDestino >= 0 ? idxDestino : 0);

            alert('Cuentas combinadas con éxito');
        } catch (error) {
            console.error('Error al combinar cuentas:', error);
            alert('Error al combinar las cuentas');
        }
    };

    // Ver historial
    const verHistorial = async () => {
        if (!mesaSeleccionada) {
            return;
        }

        try {
            const historial = await obtenerHistorialPorMesa(mesaSeleccionada.id);
            console.log('Historial:', historial);
            // Aquí se podría mostrar un modal con el historial
        } catch (error) {
            console.error('Error al obtener historial:', error);
        }
    };

    // Recargar contador de minicomandas pendientes
    const recargarContadorPendientes = async () => {
        try {
            const todasLasMinicomandas = await obtenerTodasLasMinicomandas();
            const pendientes = todasLasMinicomandas.filter(m => m.estado === 'PENDIENTE').length;
            setPendingMinicomandasCount(pendientes);
        } catch (error) {
            console.error('Error al recargar contador de pendientes:', error);
        }
    };

    // Limpiar todas las minicomandas (solo para desarrollo/testing)
    const limpiarTodasLasMinicomandas = async () => {
        try {
            const todas = await obtenerTodasLasMinicomandas();
            for (const mini of todas) {
                // Usar Supabase para eliminar (en lugar de IndexedDB deleteRecord)
                const { error } = await supabase.from('minicomandas').delete().eq('id', mini.id);
                if (error) console.error('Error al eliminar minicomanda:', error);
            }
            setPendingMinicomandasCount(0);
            console.log('Todas las minicomandas han sido eliminadas');
        } catch (error) {
            console.error('Error al limpiar minicomandas:', error);
        }
    };

    return (
        <AccountContext.Provider value={{
            meseroLogueado,
            cocinaLogueada,
            mesas,
            mesaSeleccionada,
            setMesaSeleccionada, // Expose setMesaSeleccionada directly so we can deselect/change tables
            estadoMesa,
            carroLocal,
            setCarroLocal,
            comensalActivo,
            setComensalActivo,
            cuentaActual,
            setCuentaActual,
            minicomandas,
            cuentasAbiertas,
            cuentaActivaIndex,
            pendingMinicomandasCount,
            loginMesero,
            logoutMesero,
            loginMeseroAsAdmin,
            loginCocina,
            loginCocinaAsAdmin,
            logoutCocina,
            seleccionarMesa,
            liberarMesa,
            cambiarMesa,
            agregarAlCarro,
            removeFromCarro,
            updateCarroQuantity,
            clearCarro,
            enviarACocina,
            enviandoACocina,
            actualizarEstadoMinicomanda,
            devolverAMesero,
            cobrarCuenta,
            cobrarAsientos,
            resolverSalidaComensal,
            compartirItemIndividual,
            actualizarRepartoItem,
            obtenerSharesPorItem,
            verHistorial,
            seleccionarCuentaAbierta,
            moverItem,
            dividirPorAsiento,
            combinarCuentas,
            recargarEstadoMesa,
            calcularTotalCarro,
            recargarContadorPendientes,
            obtenerCuentasAbiertasPorMesa,
            itemsDeCocina,
            cargarItemsDeCocina,
            asientosActivos,
            setAsientosActivos,
            solicitudReemplazo,
            confirmarReemplazo,
            cancelarReemplazo,
            obtenerNombreMesero
        }}>
            {children}
        </AccountContext.Provider>
    );
};

export const useAccount = () => {
    const context = useContext(AccountContext);
    if (context === undefined) {
        throw new Error('useAccount must be used within an AccountProvider');
    }
    return context;
};
