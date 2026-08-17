// src/components/KitchenView.tsx - Vista de cocina con IndexedDB (Fase 1)
// Muestra minicomandas en tiempo real desde IndexedDB

import React, { useState, useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { useOrders } from '../context/OrderContext';
import { Minicomanda, MinicomandaEstado, ItemMinicomanda } from '../types';
import { Clock, Check, Inbox, RotateCcw, Trash2, ChefHat, Settings, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { obtenerTodasLasMinicomandas, obtenerItemsPorMinicomanda, obtenerMesaPorId } from '../db/SupabaseQueries';
import { supabase } from '../db/supabaseClient';

// Subcomponent to handle the real-time elapsed clock for each KDS card
const OrderTimer: React.FC<{ createdAt: string; stopped?: boolean }> = ({ createdAt, stopped }) => {
  const [elapsed, setElapsed] = useState('00:00');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const createdTime = new Date(createdAt).getTime();
      const differenceMs = Date.now() - createdTime;
      const totalSeconds = Math.max(0, Math.floor(differenceMs / 1000));

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      // Mark as urgent if older than 10 minutes (600 seconds)
      if (minutes >= 10) {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }

      setElapsed(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} min`);
    };

    calculateTime();
    if (stopped) return; // Freeze timer when order is completed
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [createdAt, stopped]);

  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-black border tracking-wider transition-colors ${isUrgent
      ? 'bg-red-950 border-red-500 text-red-400 animate-pulse'
      : 'bg-neutral-900 border-neutral-700 text-brand-crema'
      }`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{elapsed}</span>
    </div>
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
    loginCocina
  } = useAccount();
  const { setCurrentRole, orders, updateOrderStatus, deleteOrder } = useOrders();

  const [viewHistory, setViewHistory] = useState(false);
  const [allMinicomandas, setAllMinicomandas] = useState<Minicomanda[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<number, ItemMinicomanda[]>>({});
  const [mesasMap, setMesasMap] = useState<Record<number, { numero: string }>>({});
  const [deletingIds, setDeletingIds] = useState<Set<number | string>>(new Set());
  // Cargar TODAS las minicomandas
  useEffect(() => {
    if (cocinaLogueada) {
      cargarTodasLasMinicomandas();
    }
  }, [cocinaLogueada]);

  // Recargar cada 3 segundos, salvo cuando hay un delete en progreso
  useEffect(() => {
    if (!cocinaLogueada) return;

    const interval = setInterval(() => {
      if (deletingIds.size === 0) {
        cargarTodasLasMinicomandas();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [cocinaLogueada, deletingIds]);

  const cargarTodasLasMinicomandas = async () => {
    try {
      const minis = await obtenerTodasLasMinicomandas();
      setAllMinicomandas(minis);

      // Cargar items para cada minicomanda
      const itemsPromises = minis.map(m => obtenerItemsPorMinicomanda(m.id));
      const itemsArrays = await Promise.all(itemsPromises);
      const newItemsMap: Record<number, ItemMinicomanda[]> = {};
      minis.forEach((m, i) => {
        newItemsMap[m.id] = itemsArrays[i];
      });
      setItemsMap(newItemsMap);

      // Cargar info de mesas
      const mesasPromises = minis.map(m => obtenerMesaPorId(m.mesa_id));
      const mesasData = await Promise.all(mesasPromises);
      const newMesasMap: Record<number, { numero: string }> = {};
      minis.forEach((m, i) => {
        if (mesasData[i]) {
          newMesasMap[m.mesa_id] = { numero: mesasData[i]!.numero };
        }
      });
      setMesasMap(newMesasMap);
    } catch (error) {
      console.error('Error al cargar minicomandas:', error);
    }
  };

  // Limpiar todas las minicomandas (solo para desarrollo)
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

  // Filtrar minicomandas + órdenes de cliente
  const activeMinicomandas = (viewHistory
    ? allMinicomandas.filter(m => m.estado !== 'PENDIENTE' && m.estado !== 'DEVUELTA')
    : allMinicomandas.filter(m => m.estado === 'PENDIENTE'))
    .sort((a, b) => a.id - b.id);

  const activeClientOrders = (viewHistory
    ? orders.filter(o => o.status !== 'pendiente')
    : orders.filter(o => o.status === 'pendiente'))
    .sort((a, b) => a.id - b.id);

  const totalActive = activeMinicomandas.length + activeClientOrders.length;

  // Manejar marcar como listo
  const handleMarkAsReady = async (minicomanda: Minicomanda) => {
    try {
      await actualizarEstadoMinicomanda(minicomanda.id, 'LISTO');
      setAllMinicomandas(prev =>
        prev.map(m => m.id === minicomanda.id ? { ...m, estado: 'LISTO' } : m)
      );
    } catch (error) {
      console.error('Error al marcar como listo:', error);
    }
  };

  // Manejar restaurar orden
  const handleRestoreOrder = async (minicomandaId: number) => {
    try {
      await actualizarEstadoMinicomanda(minicomandaId, 'PENDIENTE');
      setAllMinicomandas(prev =>
        prev.map(m => m.id === minicomandaId ? { ...m, estado: 'PENDIENTE' } : m)
      );
    } catch (error) {
      console.error('Error al restaurar orden:', error);
    }
  };

  // Manejar devolver a mesero
  const handleReturnToWaiter = async (minicomandaId: number) => {
    if (!window.confirm('¿Regresar esta comanda al mesero para modificacion?')) return;
    try {
      await devolverAMesero(minicomandaId);
      setAllMinicomandas(prev =>
        prev.map(m => m.id === minicomandaId ? { ...m, estado: 'DEVUELTA' } : m)
      );
    } catch (error) {
      console.error('Error al devolver comanda a mesero:', error);
    }
  };

  // Manejar eliminar una comanda individual
  const handleDeleteSingle = async (type: 'minicomanda' | 'clientOrder', id: number | string) => {
    const label = type === 'minicomanda' ? `COM #${id}` : `Orden #${id}`;
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;

    setDeletingIds(prev => new Set(prev).add(id));
    try {
      if (type === 'minicomanda') {
        await supabase.from('historial_acciones').delete().eq('minicomanda_id', id);
        await supabase.from('items_minicomanda').delete().eq('minicomanda_id', id);
        const { error } = await supabase.from('minicomandas').delete().eq('id', id);
        if (error) throw error;
        setAllMinicomandas(prev => prev.filter(m => m.id !== id));
        setItemsMap(prev => {
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
      // Recargar para mantener UI sincronizada con DB
      await cargarTodasLasMinicomandas();
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Si no está logueado, redirigir al login
  if (!cocinaLogueada) {
    return (
      <div id="kitchen-view" className="min-h-screen bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark flex items-center justify-center p-4">
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
    <div id="kitchen-view" className="min-h-[calc(100vh-4rem)] bg-neutral-950 p-4 flex flex-col text-white select-none">

      {/* Kitchen Screen Control Bar */}
      <div className="bg-neutral-900 rounded-t-xl px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping" />
          <h2 className="text-base font-bold tracking-widest uppercase font-mono text-brand-crema">
            PANTALLA DE COCINA (KDS)
          </h2>
        </div>

        {/* Live Count and Filters */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <button
            onClick={() => setViewHistory(!viewHistory)}
            className={`px-3 py-1.5 rounded-md border font-bold transition-colors ${viewHistory
              ? 'bg-brand-crema text-brand-green border-brand-crema'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
          >
            {viewHistory ? '🗂️ Ver Pendientes' : '🗃️ Ver Completados'}
          </button>

          <div className="bg-neutral-950 border border-neutral-800 px-3.5 py-1.5 rounded-md">
            PEDIDOS ACTIVOS: <span className="text-brand-crema font-bold">{totalActive}</span>
          </div>

          {/* Logout button */}
          <button
            onClick={() => { logoutCocina(); window.dispatchEvent(new Event('open_role_modal')); }}
            className="px-3 py-1.5 rounded-md border font-bold text-xs text-red-400 border-red-500 hover:bg-red-500 hover:text-white transition-colors"
          >
            Salir
          </button>

          {/* Botón de limpieza para desarrollo */}
          {allMinicomandas.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2 py-1.5 rounded-md border font-bold text-xs text-red-400 border-red-500 hover:bg-red-500 hover:text-white transition-colors"
              title="Limpiar todas las minicomandas (solo desarrollo)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid container of orders - Horizontal or Responsive flex */}
      <div className="flex-1 overflow-x-auto py-4 flex gap-4 items-start min-h-0 select-none">
        {totalActive === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-neutral-500 text-center space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-full text-neutral-600">
              <Inbox className="w-12 h-12 stroke-1" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-widest font-mono text-neutral-400">
                {viewHistory
                  ? 'Todo al día, Cocina limpia'
                  : 'No hay comandas pendientes de preparar en este momento. ¡Excelente trabajo de equipo!'}
              </h3>
              <p className="text-xs max-w-xs text-neutral-600">
                {viewHistory
                  ? 'No hay comandas completadas recientemente.'
                  : 'Las comandas aparecerán aquí cuando el mesero las envíe a cocina.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 items-start min-h-full">
            <AnimatePresence mode="popLayout">
              {activeMinicomandas.map((minicomanda) => {
                const itemsMinicomanda = itemsMap[minicomanda.id] || [];
                const seatNumber = itemsMinicomanda.length > 0 ? itemsMinicomanda[0].seat_number : null;
                return (
                <motion.div
                  key={minicomanda.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.25 } }}
                  className="w-80 bg-neutral-900 border-2 border-neutral-800 rounded-xl overflow-hidden flex flex-col shadow-2xl shrink-0"
                >

                  {/* Card Header */}
                  <div className={`p-4 flex items-center justify-between border-b ${minicomanda.estado === 'PENDIENTE'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : minicomanda.estado === 'LISTO'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-amber-400 text-neutral-950 border-amber-500'
                    }`}>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest font-mono font-black leading-none opacity-80">
                        {minicomanda.estado === 'PENDIENTE' ? 'PENDIENTE' : minicomanda.estado}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-mono font-black tracking-tight">
                          COM #{minicomanda.id}
                        </span>
                        {mesasMap[minicomanda.mesa_id] && (
                          <span className="text-sm font-bold text-brand-crema bg-neutral-950/50 px-2 py-0.5 rounded border border-neutral-700">
                            MESA {mesasMap[minicomanda.mesa_id].numero}
                          </span>
                        )}
                        {seatNumber && (
                          <span className="text-sm font-bold bg-white/15 px-2 py-0.5 rounded border border-white/30">
                            C.{seatNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Live Ticking Clock */}
                    <OrderTimer createdAt={minicomanda.fecha_envio} stopped={minicomanda.estado !== 'PENDIENTE'} />
                    <button
                      disabled={deletingIds.has(minicomanda.id)}
                      onClick={() => handleDeleteSingle('minicomanda', minicomanda.id)}
                      className="text-white/40 hover:text-red-400 transition-colors p-1"
                      title="Eliminar comanda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body (Lista de platillos en fuente gigante) */}
                  <div className="flex-1 p-4 space-y-4 max-h-[48vh] overflow-y-auto no-scrollbar bg-neutral-900/60">
                    {(itemsMap[minicomanda.id] || []).map((item) => (
                      <div key={item.id} className="border-b border-neutral-800/80 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-start gap-2.5">
                          {/* Giant quantity prefix */}
                          <span className="text-2xl font-black font-mono text-emerald-400 select-none bg-neutral-950/70 border border-neutral-800 rounded px-2.5 py-0.5 mt-0.5 leading-none shrink-0">
                            {item.cantidad}x
                          </span>

                          <div className="flex-1 min-w-0">
                            {/* Giant dish name */}
                            <h4 className="text-lg font-black tracking-tight text-white leading-tight">
                              {item.producto_id}
                            </h4>

                            {/* Sub modifiers */}
                            {item.notas && (
                              <div className="mt-1.5 bg-red-950/40 border-l-2 border-red-500 py-1 px-2 rounded-r">
                                <span className="text-xs font-black text-red-400 tracking-wide uppercase">
                                  ⚠️ {item.notas}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total de la minicomanda */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex justify-between items-center">
                      <span className="text-xs text-neutral-400 uppercase font-bold">Total:</span>
                      <span className="text-xl font-black text-brand-crema">
                        ${minicomanda.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Footer (Giant full-width action button) */}
                  <div className="border-t border-neutral-800 bg-neutral-950 p-2 select-none">
                    {minicomanda.estado === 'PENDIENTE' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkAsReady(minicomanda)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-4.5 rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest transition-colors"
                        >
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>Marcar como Listo</span>
                        </button>
                        <button
                          onClick={() => handleReturnToWaiter(minicomanda.id)}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-black text-xs py-4.5 px-4 rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest transition-colors"
                          title="Regresar al mesero para modificar"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreOrder(minicomanda.id)}
                          className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Regresar a Pendientes</span>
                        </button>
                        <button
                          onClick={() => handleReturnToWaiter(minicomanda.id)}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-black text-xs py-3 px-4 rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest transition-colors"
                          title="Regresar al mesero para modificar"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                </motion.div>
                );
              })}
              {/* Órdenes de Cliente (desde ClientView) */}
              {activeClientOrders.map((order: any) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.25 } }}
                  className="w-80 bg-neutral-900 border-2 border-orange-800 rounded-xl overflow-hidden flex flex-col shadow-2xl shrink-0"
                >
                  {/* Card Header */}
                  <div className={`p-4 flex items-center justify-between border-b ${order.status === 'pendiente'
                    ? 'bg-orange-600 text-white border-orange-700'
                    : order.status === 'listo'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-amber-400 text-neutral-950 border-amber-500'
                    }`}>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest font-mono font-black leading-none opacity-80">
                        🛒 CLIENTE - {order.status === 'pendiente' ? 'PENDIENTE' : order.status.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-mono font-black tracking-tight">
                          #{order.orderNumber || order.order_number}
                        </span>
                        <span className="text-sm font-bold bg-black/30 px-2 py-0.5 rounded">
                          {order.customerName || order.customer_name || 'Cliente'}
                        </span>
                      </div>
                    </div>
                    <OrderTimer createdAt={order.createdAt || order.created_at} stopped={order.status !== 'pendiente'} />
                    <button
                      disabled={deletingIds.has(order.id)}
                      onClick={() => handleDeleteSingle('clientOrder', order.id)}
                      className="text-white/40 hover:text-red-400 transition-colors p-1"
                      title="Eliminar orden"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-4 space-y-4 max-h-[48vh] overflow-y-auto no-scrollbar bg-neutral-900/60">
                    {(order.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="border-b border-neutral-800/80 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-start gap-2.5">
                          <span className="text-2xl font-black font-mono text-orange-400 select-none bg-neutral-950/70 border border-neutral-800 rounded px-2.5 py-0.5 mt-0.5 leading-none shrink-0">
                            {item.quantity}x
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-black tracking-tight text-white leading-tight">
                              {item.product?.name || 'Producto'}
                            </h4>
                            {item.notes && (
                              <div className="mt-1.5 bg-red-950/40 border-l-2 border-red-500 py-1 px-2 rounded-r">
                                <span className="text-xs font-black text-red-400 tracking-wide uppercase">
                                  ⚠️ {item.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex justify-between items-center">
                      <span className="text-xs text-neutral-400 uppercase font-bold">Total:</span>
                      <span className="text-xl font-black text-brand-crema">
                        ${order.total?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    {order.address && (
                      <div className="text-xs text-neutral-500 mt-1">
                        🏠 {order.address} | 📞 {order.customer_phone || 'N/A'}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-neutral-800 bg-neutral-950 p-2 select-none">
                    {order.status === 'pendiente' ? (
                      <button
                        onClick={async () => {
                          try {
                            await updateOrderStatus(order.id, 'listo');
                          } catch (err) { console.error('Error:', err); }
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-4 rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-widest transition-colors"
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>Marcar como Listo</span>
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await updateOrderStatus(order.id, 'pendiente');
                          } catch (err) { console.error('Error:', err); }
                        }}
                        className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Regresar a Pendientes</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
