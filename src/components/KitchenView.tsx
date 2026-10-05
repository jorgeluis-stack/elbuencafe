// src/components/KitchenView.tsx - KDS profesional (rediseño visual, lógica intacta)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAccount } from '../context/AccountContext';
import { useOrders } from '../context/OrderContext';
import { Minicomanda, MinicomandaEstado, ItemMinicomanda, ItemOpcion, ItemExtra } from '../types';
import { Clock, Check, Inbox, RotateCcw, Trash2, ChefHat, Settings, Undo2, MoreVertical, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  obtenerTodasLasMinicomandas,
  obtenerItemsPorMinicomandas,
  obtenerMesasPorIds,
  obtenerOpcionesPorItems,
  obtenerExtrasPorItems,
  suscribirACambios,
} from '../db/SupabaseQueries';
import { useProductos } from '../hooks/useProductos';
import { PRODUCTS } from '../data/menu';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';

// Helper presentación: si existen extras estructurados, elimina sufijo "| Extras: ..." de la nota.
// Solo afecta visualización en KDS; no modifica persistencia ni compatibilidad con históricos.
const getNotaLimpia = (nota: string | null | undefined, tieneExtras: boolean): string | null => {
  if (!nota) return null;
  const base = tieneExtras ? nota.replace(/\s*\|\s*Extras\s*:.*$/i, '').trim() : nota;
  // Presentación: el marcador "– Compartida" del texto de notas se omite porque
  // la cabecera ya lo indica una sola vez. No modifica datos persistidos.
  const sinCompartida = base.replace(/\s*[–-]\s*Compartida\s*$/i, '').trim();
  return sinCompartida.length > 0 ? sinCompartida : null;
};

// Formato operacional del timer: MM:SS bajo 1h, H:MM:SS a partir de 1h.
const formatoDuracion = (diffSeg: number): string => {
  const m = Math.floor(diffSeg / 60);
  const s = diffSeg % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Jerarquía de espera: >=10m urgente, >=5m atención, si no neutro.
const nivelEspera = (fechaEnvio: string): 'normal' | 'atencion' | 'urgente' => {
  const diff = Math.floor((Date.now() - new Date(fechaEnvio).getTime()) / 1000);
  if (diff >= 600) return 'urgente';
  if (diff >= 300) return 'atencion';
  return 'normal';
};

const useTickComanda = (createdAt: string, stopped?: boolean) => {
  const [tick, setTick] = useState<{ elapsed: string; nivel: 'normal' | 'atencion' | 'urgente' }>(() => ({
    elapsed: formatoDuracion(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))),
    nivel: stopped ? 'normal' : nivelEspera(createdAt),
  }));

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
      setTick({ elapsed: formatoDuracion(diff), nivel: stopped ? 'normal' : nivelEspera(createdAt) });
    };
    calc();
    if (stopped) return;
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [createdAt, stopped]);

  return tick;
};

const OrderTimer: React.FC<{ elapsed: string; nivel: 'normal' | 'atencion' | 'urgente' }> = ({ elapsed, nivel }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border tabular-nums shrink-0 ${
        nivel === 'urgente'
          ? 'bg-red-50 border-red-300 text-red-700'
          : nivel === 'atencion'
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : 'bg-neutral-100 border-neutral-200 text-neutral-700'
      }`}
    >
      <Clock className="w-3 h-3" />
      {elapsed}
    </span>
  );
};

export const KitchenView: React.FC = () => {
  const {
    cocinaLogueada,
    recargarEstadoMesa,
    actualizarEstadoMinicomanda,
    devolverAMesero,
    recargarContadorPendientes,
    logoutCocina,
  } = useAccount();
  const { setCurrentRole, orders, updateOrderStatus, deleteOrder } = useOrders();
  const { productos } = useProductos();

  const productosMap = useMemo(() => {
    const m = new Map<string, string>();
    productos.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [productos]);

  const menuProductosMap = useMemo(() => {
    const m = new Map<string, string>();
    PRODUCTS.forEach((p) => m.set(p.id, p.name));
    return m;
  }, []);

  const getNombreProducto = (productoId: string) =>
    productosMap.get(productoId) || menuProductosMap.get(productoId) || productoId;

  const [viewHistory, setViewHistory] = useState(false); // controla colapso de LISTOS (pendientes siempre visibles)
  const [allMinicomandas, setAllMinicomandas] = useState<Minicomanda[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<number, ItemMinicomanda[]>>({});
  const [mesasMap, setMesasMap] = useState<Record<number, { numero: string }>>({});
  const [opcionesMap, setOpcionesMap] = useState<Record<number, ItemOpcion[]>>({});
  const [extrasMap, setExtrasMap] = useState<Record<number, ItemExtra[]>>({});
  const [deletingIds, setDeletingIds] = useState<Set<number | string>>(new Set());

  // Realtime KDS: debounce 200ms, generación anti-race y espejo de deletingIds.
  // Solo infraestructura de recarga; el render/JSX queda intacto.
  const generationRef = useRef(0);
  const deletingIdsRef = useRef(deletingIds);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  useEffect(() => {
    // [KDS-TRACE] Instrumentación temporal de diagnóstico — solo observa, no altera lógica.
    console.log(`[KDS-TRACE] KITCHEN_EFFECT_START cocinaLogueada=${String(cocinaLogueada)} timestamp=${new Date().toISOString()}`);
    if (!cocinaLogueada) return;

    // Fallback IndexedDB/local: sin Supabase no hay Realtime → polling 3s.
    if (!isSupabaseConfigured()) {
      const interval = setInterval(() => {
        if (deletingIdsRef.current.size === 0) cargarTodasLasMinicomandas();
      }, 3000);
      cargarTodasLasMinicomandas();
      return () => {
        console.log(`[KDS-TRACE] KITCHEN_EFFECT_CLEANUP timestamp=${new Date().toISOString()}`);
        clearInterval(interval);
      };
    }

    // Supabase configurado: Realtime + debounce, sin polling.
    const programarRecarga = () => {
      console.log(`[KDS-TRACE] REFRESH_SCHEDULED timestamp=${new Date().toISOString()}`);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        console.log(`[KDS-TRACE] REFRESH_START timestamp=${new Date().toISOString()}`);
        if (deletingIdsRef.current.size === 0) cargarTodasLasMinicomandas();
      }, 200);
    };

    // [KDS-TRACE] Observa el evento Realtime sin modificar payload, sin filtrar, sin impedir que continúe.
    const unsubMinis = suscribirACambios('minicomandas', (payload: any) => {
      console.log(`[KDS-TRACE] REALTIME_MINICOMANDA event=${String(payload?.eventType ?? payload?.event)} id=${String(payload?.new?.id ?? payload?.old?.id)} oldEstado=${String(payload?.old?.estado)} newEstado=${String(payload?.new?.estado)} timestamp=${new Date().toISOString()}`);
      programarRecarga();
    });
    const unsubItems = suscribirACambios('items_minicomanda', programarRecarga);
    const unsubOpciones = suscribirACambios('items_opciones', programarRecarga);
    const unsubExtras = suscribirACambios('item_extras', programarRecarga);

    // Carga inicial inmediata, sin esperar al primer evento.
    cargarTodasLasMinicomandas();

    return () => {
      console.log(`[KDS-TRACE] KITCHEN_EFFECT_CLEANUP timestamp=${new Date().toISOString()}`);
      generationRef.current += 1; // invalida cargas en vuelo
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubMinis();
      unsubItems();
      unsubOpciones();
      unsubExtras();
    };
  }, [cocinaLogueada]);

  const cargarTodasLasMinicomandas = async () => {
    const gen = generationRef.current;
    const vigente = () => generationRef.current === gen;
    // [KDS-TRACE] Instrumentación temporal de diagnóstico — solo observa, no altera lógica.
    console.log(`[KDS-TRACE] LOAD_START generation=${String(gen)} timestamp=${new Date().toISOString()}`);
    try {
      const minis = await obtenerTodasLasMinicomandas();
      console.log(`[KDS-TRACE] LOAD_RESULT cantidad=${String(minis.length)} idsEstados=${minis.map((m) => `${m.id}:${m.estado}`).join(',')} timestamp=${new Date().toISOString()}`);
      if (!vigente()) return;
      console.log(`[KDS-TRACE] SET_ALL_MINIS cantidad=${String(minis.length)} idsEstadosRelevantes=${minis.map((m) => `${m.id}:${m.estado}`).join(',')} timestamp=${new Date().toISOString()}`);
      setAllMinicomandas(minis);

      const minicomandaIds = minis.map((m) => m.id);
      const items = minicomandaIds.length > 0 ? await obtenerItemsPorMinicomandas(minicomandaIds) : [];

      // Agrupación en memoria: itemsMap
      const newItemsMap: Record<number, ItemMinicomanda[]> = {};
      for (const m of minis) newItemsMap[m.id] = [];
      for (const it of items) {
        if (!newItemsMap[it.minicomanda_id]) newItemsMap[it.minicomanda_id] = [];
        newItemsMap[it.minicomanda_id].push(it);
      }
      if (!vigente()) return;
      setItemsMap(newItemsMap);

      // Mesas deduplicadas
      const mesaIds = [...new Set(minis.map((m) => m.mesa_id).filter((v) => v != null))] as number[];
      const mesas = mesaIds.length > 0 ? await obtenerMesasPorIds(mesaIds) : [];
      const newMesasMap: Record<number, { numero: string }> = {};
      for (const mesa of mesas) {
        newMesasMap[mesa.id] = { numero: mesa.numero };
      }
      if (!vigente()) return;
      setMesasMap(newMesasMap);

      // Opciones y extras en batch por itemIds
      const itemIds = items.map((it) => it.id);
      if (itemIds.length > 0) {
        let opciones: ItemOpcion[] = [];
        let extras: ItemExtra[] = [];
        try {
          const [opcionesRes, extrasRes] = await Promise.all([
            obtenerOpcionesPorItems(itemIds).catch(() => [] as ItemOpcion[]),
            obtenerExtrasPorItems(itemIds).catch(() => [] as ItemExtra[]),
          ]);
          opciones = opcionesRes || [];
          extras = extrasRes || [];
        } catch (e) {
          console.warn('Error batch opciones/extras:', e);
        }
        const newOpcionesMap: Record<number, ItemOpcion[]> = {};
        const newExtrasMap: Record<number, ItemExtra[]> = {};
        for (const id of itemIds) {
          newOpcionesMap[id] = [];
          newExtrasMap[id] = [];
        }
        for (const op of opciones) {
          if (!newOpcionesMap[op.item_id]) newOpcionesMap[op.item_id] = [];
          newOpcionesMap[op.item_id].push(op);
        }
        for (const ex of extras) {
          if (!newExtrasMap[ex.item_id]) newExtrasMap[ex.item_id] = [];
          newExtrasMap[ex.item_id].push(ex);
        }
        if (!vigente()) return;
        setOpcionesMap(newOpcionesMap);
        setExtrasMap(newExtrasMap);
      } else {
        if (!vigente()) return;
        setOpcionesMap({});
        setExtrasMap({});
      }
    } catch (error) {
      console.error('Error al cargar minicomandas:', error);
    } finally {
      // [KDS-TRACE] Solo observa el fin de la carga, no altera lógica.
      console.log(`[KDS-TRACE] LOAD_END generation=${String(gen)} timestamp=${new Date().toISOString()}`);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Estás seguro de eliminar TODAS las minicomandas? Esto no se puede deshacer.')) {
      try {
        for (const mini of allMinicomandas) {
          const { error } = await supabase.from('minicomandas').delete().eq('id', mini.id);
          if (error) console.error('Error al eliminar minicomanda:', error);
        }
        setAllMinicomandas([]);
        setItemsMap({});
        await recargarContadorPendientes();
        alert('Todas las minicomandas han sido eliminadas');
      } catch (error) {
        console.error('Error al limpiar:', error);
        alert('Error al limpiar minicomandas');
      }
    }
  };

  // Filtros: pendientes siempre visibles, listos en sección colapsable; DEVUELTA nunca en KDS
  const pendingMinis = allMinicomandas.filter((m) => m.estado === 'PENDIENTE').sort((a, b) => a.id - b.id);
  const listoMinis = allMinicomandas
    .filter((m) => m.estado === 'LISTO')
    .sort((a, b) => b.id - a.id);

  const pendingClient = orders.filter((o: any) => o.status === 'pendiente').sort((a: any, b: any) => a.id - b.id);
  const listoClient = orders.filter((o: any) => o.status !== 'pendiente').sort((a: any, b: any) => b.id - a.id);

  const pendingCount = pendingMinis.length + pendingClient.length;
  const listoCount = listoMinis.length + listoClient.length;

  // [KDS-TRACE] Efecto exclusivamente observacional: registra cambios de conteos visibles. No modifica ningún estado.
  useEffect(() => {
    console.log(`[KDS-TRACE] COUNTS pendingCount=${String(pendingCount)} listoCount=${String(listoCount)} pendingMinis=${String(pendingMinis.length)} pendingClient=${String(pendingClient.length)} listoMinis=${String(listoMinis.length)} listoClient=${String(listoClient.length)} timestamp=${new Date().toISOString()}`);
  }, [pendingCount, listoCount]);

  const handleMarkAsReady = async (minicomanda: Minicomanda) => {
    try {
      await actualizarEstadoMinicomanda(minicomanda.id, 'LISTO');
      setAllMinicomandas((prev) => prev.map((m) => (m.id === minicomanda.id ? { ...m, estado: 'LISTO' } : m)));
    } catch (error) {
      console.error('Error al marcar como listo:', error);
    }
  };

  const handleRestoreOrder = async (minicomandaId: number) => {
    // [KDS-TRACE] Instrumentación temporal de diagnóstico — solo observa, no altera lógica.
    console.log(`[KDS-TRACE] RESTORE_START id=${String(minicomandaId)} timestamp=${new Date().toISOString()}`);
    try {
      await actualizarEstadoMinicomanda(minicomandaId, 'PENDIENTE');
      setAllMinicomandas((prev) => prev.map((m) => (m.id === minicomandaId ? { ...m, estado: 'PENDIENTE' } : m)));
      console.log(`[KDS-TRACE] RESTORE_RESULT id=${String(minicomandaId)} resultado=ok timestamp=${new Date().toISOString()}`);
    } catch (error) {
      console.log(`[KDS-TRACE] RESTORE_RESULT id=${String(minicomandaId)} resultado=${String(error)} timestamp=${new Date().toISOString()}`);
      console.error('Error al restaurar orden:', error);
    }
  };

  const handleReturnToWaiter = async (minicomandaId: number) => {
    if (!window.confirm('¿Regresar esta comanda al mesero para modificacion?')) return;
    try {
      await devolverAMesero(minicomandaId);
      setAllMinicomandas((prev) => prev.map((m) => (m.id === minicomandaId ? { ...m, estado: 'DEVUELTA' } : m)));
    } catch (error) {
      console.error('Error al devolver comanda a mesero:', error);
    }
  };

  const handleDeleteSingle = async (type: 'minicomanda' | 'clientOrder', id: number | string) => {
    const label = type === 'minicomanda' ? `COM #${id}` : `Orden #${id}`;
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      if (type === 'minicomanda') {
        await supabase.from('historial_acciones').delete().eq('minicomanda_id', id);
        await supabase.from('items_minicomanda').delete().eq('minicomanda_id', id);
        const { error } = await supabase.from('minicomandas').delete().eq('id', id);
        if (error) throw error;
        setAllMinicomandas((prev) => prev.filter((m) => m.id !== id));
        setItemsMap((prev) => {
          const next = { ...prev };
          delete next[id as number];
          return next;
        });
      } else {
        await deleteOrder(id as string);
      }
      await recargarContadorPendientes();
    } catch (error: any) {
      console.error(`Error al eliminar ${label}:`, error);
      alert(`Error al eliminar ${label}: ${error?.message || JSON.stringify(error)}`);
      await cargarTodasLasMinicomandas();
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (!cocinaLogueada) {
    return (
      <div
        id="kitchen-view"
        className="min-h-screen bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-crema-light w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 text-center">
            <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
              <ChefHat className="w-10 h-10 text-orange-700" />
            </div>
            <h2 className="text-2xl font-bold text-white">Acceso Restringido</h2>
            <p className="text-xs mt-1 text-white/80">Debes iniciar sesión para acceder a la cocina</p>
          </div>
          <div className="p-6 space-y-4">
            <button
              onClick={() => setCurrentRole('login')}
              className="w-full bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" />
              <span>Ir al Login Administrativo</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="kitchen-view" className="min-h-[calc(100vh-4rem)] bg-[#f4f4f0] flex flex-col text-neutral-900 select-none">
      {/* Header KDS — sobrio, solo conteos, sin cromado excesivo */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-black tracking-widest uppercase">Cocina</span>
          <span className="hidden sm:inline-flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-white font-bold">Pendientes {pendingCount}</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 font-bold">
              Listos {listoCount}
            </span>
          </span>
          <span className="sm:hidden text-xs font-bold text-neutral-600">
            {pendingCount} pendientes · {listoCount} listos
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              logoutCocina();
              window.dispatchEvent(new Event('open_role_modal'));
            }}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:bg-neutral-50"
          >
            Salir
          </button>
          {/* Limpiar TODO: acción destructiva, solo con ?limpiar en la URL */}
          {allMinicomandas.length > 0 && /[?&]limpiar\b/.test(window.location.search) && (
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
              title="Limpiar todas las minicomandas (solo desarrollo)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contenido — un solo scroll vertical, grid denso */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto w-full p-3 sm:p-4">
          {/* PENDIENTES */}
          {pendingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 text-center gap-3">
              <div className="bg-white border border-neutral-200 p-5 rounded-full">
                <Inbox className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Sin pendientes — cocina al día</p>
              <p className="text-xs text-neutral-500">Las comandas aparecerán aquí al enviarse desde el mesero.</p>
            </div>
          ) : (
            <div
              className="grid gap-3 items-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              <AnimatePresence initial={false}>
                {pendingMinis.map((mini) => {
                  const items = itemsMap[mini.id] || [];
                  const seatNumber = items.length > 0 ? items[0].seat_number : null;
                  const mesaLabel = mesasMap[mini.mesa_id]?.numero;
                  return (
                    <KitchenCard
                      key={`mini-${mini.id}`}
                      variant="pending"
                      mesaLabel={mesaLabel}
                      seatNumber={seatNumber}
                      comId={mini.id}
                      fechaEnvio={mini.fecha_envio}
                      estado={mini.estado}
                      deleting={deletingIds.has(mini.id)}
                      onDelete={() => handleDeleteSingle('minicomanda', mini.id)}
                      onReady={() => handleMarkAsReady(mini)}
                      onReturn={() => handleReturnToWaiter(mini.id)}
                      getNombreProducto={getNombreProducto}
                      items={items}
                      opcionesMap={opcionesMap}
                      extrasMap={extrasMap}
                    />
                  );
                })}
                {pendingClient.map((order: any) => (
                  <ClientCard
                    key={`client-${order.id}`}
                    order={order}
                    deleting={deletingIds.has(order.id)}
                    onDelete={() => handleDeleteSingle('clientOrder', order.id)}
                    onReady={async () => {
                      try {
                        await updateOrderStatus(order.id, 'listo');
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* LISTOS — colapsable, secundario */}
          {listoCount > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setViewHistory((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${viewHistory ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                  Enviados / Listos ({listoCount})
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${viewHistory ? 'rotate-180' : ''}`} />
              </button>

              {viewHistory && (
                <div
                  className="grid gap-3 mt-3 items-start"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
                >
                  <AnimatePresence initial={false}>
                    {listoMinis.map((mini) => {
                      const items = itemsMap[mini.id] || [];
                      const seatNumber = items.length > 0 ? items[0].seat_number : null;
                      const mesaLabel = mesasMap[mini.mesa_id]?.numero;
                      return (
                        <KitchenCard
                          key={`listo-${mini.id}`}
                          variant="listo"
                          mesaLabel={mesaLabel}
                          seatNumber={seatNumber}
                          comId={mini.id}
                          fechaEnvio={mini.fecha_envio}
                          estado={mini.estado}
                          deleting={deletingIds.has(mini.id)}
                          onDelete={() => handleDeleteSingle('minicomanda', mini.id)}
                          onRestore={() => handleRestoreOrder(mini.id)}
                          onReturn={() => handleReturnToWaiter(mini.id)}
                          getNombreProducto={getNombreProducto}
                          items={items}
                          opcionesMap={opcionesMap}
                          extrasMap={extrasMap}
                        />
                      );
                    })}
                    {listoClient.map((order: any) => (
                      <ClientCard
                        key={`client-listo-${order.id}`}
                        order={order}
                        variant="listo"
                        deleting={deletingIds.has(order.id)}
                        onDelete={() => handleDeleteSingle('clientOrder', order.id)}
                        onRestore={async () => {
                          try {
                            await updateOrderStatus(order.id, 'pendiente');
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Tarjeta minicomanda — pendiente (densa) y listo (compacta)
const KitchenCard: React.FC<{
  variant: 'pending' | 'listo';
  mesaLabel?: string;
  seatNumber: number | null;
  comId: number;
  fechaEnvio: string;
  estado: MinicomandaEstado;
  deleting: boolean;
  onDelete: () => void;
  onReady?: () => void;
  onRestore?: () => void;
  onReturn: () => void;
  getNombreProducto: (id: string) => string;
  items: ItemMinicomanda[];
  opcionesMap: Record<number, ItemOpcion[]>;
  extrasMap: Record<number, ItemExtra[]>;
}> = ({ variant, mesaLabel, seatNumber, comId, fechaEnvio, estado, deleting, onDelete, onReady, onRestore, onReturn, getNombreProducto, items, opcionesMap, extrasMap }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPending = variant === 'pending';
  const { elapsed: elapsedTimer, nivel: nivelTimer } = useTickComanda(fechaEnvio, estado !== 'PENDIENTE');
  const nivel = isPending ? nivelTimer : 'normal';
  const isShared = items.some((it) => it.seat_number === null);

  return (
    <motion.div
      layout={false}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.15 }}
      className={`bg-white rounded-xl border overflow-hidden flex flex-col self-start shadow-sm ${
        isPending
          ? nivel === 'urgente'
            ? 'border-red-300 border-t-4 border-t-red-500'
            : nivel === 'atencion'
              ? 'border-amber-300 border-t-4 border-t-amber-400'
              : 'border-neutral-200'
          : 'border-neutral-200 opacity-90'
      }`}
    >
      {/* NIVEL 1 — Identificación */}
      <div className={`px-4 ${isPending ? 'py-3' : 'py-2.5'} flex items-start justify-between gap-3 border-b ${isPending ? 'border-neutral-100' : 'border-neutral-100 bg-neutral-50/50'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`font-black tracking-tight ${isPending ? 'text-lg' : 'text-sm'}`}>
              {mesaLabel ? `MESA ${mesaLabel}` : 'MESA —'}
            </span>
            {!isPending && items.length > 0 && (
              <span className="text-sm font-bold text-neutral-500">· {items.length} {items.length === 1 ? 'ÍTEM' : 'ÍTEMS'}</span>
            )}
            {isShared ? (
              <span className="text-sm font-bold text-neutral-500">· Compartida</span>
            ) : seatNumber != null ? (
              <span className="text-sm font-bold text-neutral-500">· C.{seatNumber}</span>
            ) : null}
          </div>
        </div>
        <OrderTimer elapsed={elapsedTimer} nivel={isPending ? nivelTimer : 'normal'} />
      </div>

      {/* NIVEL 2-4 — Productos + Notas (pendiente denso / listo compacto) */}
      {!isPending ? (
        <div className="px-4 py-2">
          {items.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Sin productos</p>
          ) : (
            <p className="text-xs text-neutral-600 leading-snug line-clamp-2">
              {items.map((it) => `${it.cantidad}× ${getNombreProducto(it.producto_id)}`).join(' · ')}
            </p>
          )}
        </div>
      ) : (
      <div className="px-4 py-3 space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Sin productos</p>
        ) : (
          items.map((item) => {
            const nombre = getNombreProducto(item.producto_id);
            const ops = opcionesMap[item.id] || [];
            const exs = extrasMap[item.id] || [];
            const notaLimpia = getNotaLimpia(item.notas, exs.length > 0);
            return (
              <div
                key={item.id}
                className="pb-3 border-b border-neutral-100 last:border-0 last:pb-0"
              >
                <div className="flex gap-3 items-start">
                  <span className="font-black tabular-nums leading-none shrink-0 text-xl min-w-[2ch]">{item.cantidad}×</span>
                  <div className="min-w-0 flex-1">
                    {/* NIVEL 2 — Producto dominante */}
                    <div className="font-bold text-[15px] leading-snug tracking-tight break-words">{nombre}</div>
                    {/* NIVEL 3 — Notas directamente bajo el producto */}
                    {notaLimpia && (
                      <div className="mt-1 text-sm text-neutral-600 leading-snug">{notaLimpia}</div>
                    )}
                    {/* Opciones — subordinadas */}
                    {ops.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ops.map((op) => (
                          <span
                            key={`${op.id}-${op.opcion_nombre}`}
                            className="inline-flex text-[10px] font-medium bg-neutral-50 border border-neutral-100 rounded-full px-2 py-0.5"
                          >
                            {op.choice_nombre}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Extras — subordinados */}
                    {exs.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {exs.map((ex) => (
                          <div key={ex.id} className="text-xs text-neutral-500 flex gap-1">
                            <span className="text-amber-500 shrink-0">+</span>
                            <span>{ex.nombre}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      {/* NIVEL 5 — Acción principal */}
      <div className="border-t border-neutral-100 bg-white p-2 space-y-1">
        {isPending ? (
          <>
            <button
              onClick={onReady}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-5 h-5" />
              LISTO
            </button>
            <button
              onClick={onReturn}
              className="w-full h-8 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 font-bold text-[11px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 transition-colors"
              title="Devolver al mesero"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Devolver
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onRestore}
              className="flex-1 h-11 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              A pendientes
            </button>
            <button
              onClick={onReturn}
              className="h-11 px-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-500 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
              title="Devolver al mesero"
            >
              <Undo2 className="w-3.5 h-3.5" />
              DEVOLVER
            </button>
          </div>
        )}
      </div>

      {/* Menú contextual (eliminar) */}
      <div className="relative shrink-0 px-4 pb-2 flex justify-end">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400"
          aria-label="Más acciones"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <>
            <button className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />
            <div className="absolute right-4 -top-1 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[160px]">
              <button
                disabled={deleting}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

const ClientCard: React.FC<{
  order: any;
  variant?: 'pending' | 'listo';
  deleting: boolean;
  onDelete: () => void;
  onReady?: () => void;
  onRestore?: () => void;
}> = ({ order, variant = 'pending', deleting, onDelete, onReady, onRestore }) => {
  const isPending = variant === 'pending';
  const [menuOpen, setMenuOpen] = useState(false);
  const { elapsed: elapsedCliente, nivel: nivelClienteTick } = useTickComanda(order.createdAt || order.created_at, order.status !== 'pendiente');
  const nivelCliente = isPending ? nivelClienteTick : 'normal';
  return (
    <motion.div
      layout={false}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.15 }}
      className={`bg-white rounded-xl border overflow-hidden flex flex-col self-start shadow-sm ${
        isPending
          ? nivelCliente === 'urgente'
            ? 'border-red-300 border-t-4 border-t-red-500'
            : nivelCliente === 'atencion'
              ? 'border-amber-300 border-t-4 border-t-amber-400'
              : 'border-neutral-200'
          : 'border-neutral-200 opacity-90'
      }`}
    >
      <div className={`px-3 ${isPending ? 'py-2.5' : 'py-2'} flex items-start justify-between gap-2 border-b border-neutral-100 ${!isPending ? 'bg-neutral-50/50' : ''}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black truncate ${isPending ? 'text-[13px]' : 'text-xs'}`}>
              🛒 {order.customerName || order.customer_name || 'Cliente'}
            </span>
            <OrderTimer elapsed={elapsedCliente} nivel={isPending ? nivelClienteTick : 'normal'} />
          </div>
          <div className="text-[11px] font-bold text-neutral-500">#{order.orderNumber || order.order_number}</div>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-label="Cerrar" />
              <div className="absolute right-0 top-8 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                <button
                  disabled={deleting}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`${isPending ? 'px-3 py-3 space-y-3' : 'px-3 py-2.5 space-y-2'}`}>
        {(order.items || []).map((item: any, idx: number) => (
          <div key={idx} className={`${isPending ? 'pb-3' : 'pb-2.5'} border-b border-neutral-200 last:border-0 last:pb-0`}>
            <div className="flex gap-2.5">
              <span className={`font-black tabular-nums leading-none shrink-0 ${isPending ? 'text-xl min-w-[2ch] text-right' : 'text-base min-w-[2ch] text-right'}`}>
                {item.quantity}x
              </span>
              <div className="min-w-0 flex-1">
                <div className={`font-bold leading-tight ${isPending ? 'text-[15px]' : 'text-sm'} break-words`}>
                  {item.product?.name || 'Producto'}
                </div>
                {item.notes && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-bold text-amber-900 break-words">⚠ {item.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {order.address && (
          <div className="text-xs text-neutral-500 border-t border-neutral-100 pt-2">
            🏠 {order.address} · 📞 {order.customer_phone || '—'}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-100 bg-white p-2">
        {isPending ? (
          <button
            onClick={onReady}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> Marcar listo
          </button>
        ) : (
          <button
            onClick={onRestore}
            className="w-full h-9 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> A pendientes
          </button>
        )}
      </div>
    </motion.div>
  );
};
