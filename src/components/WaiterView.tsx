// src/components/WaiterView.tsx - Vista del mesero con IndexedDB (Fase 1)
// Implementa: abrir cuenta → agregar productos → enviar a cocina → cobrar → liberar mesa

import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, PRODUCTS, CATEGORY_ACCENTS } from '../data/menu';
import { Product, CategoryId, CartItemOption, CarroItem, Extra } from '../types';
import { useDeviceType } from '../hooks/useDeviceType';
import {
  Plus,
  Minus,
  Trash2,
  Send,
  User,
  Layers,
  MessageSquare,
  Sparkles,
  ClipboardList,
  CheckCircle,
  DoorOpen,
  History,
  Receipt,
  X,
  RotateCcw,
  DollarSign,
  Banknote,
   Search,
   Star,
   Users,
   Check,
   Eye,
   EyeOff,
   ChevronDown,
   ChevronUp,
   AlertTriangle,
   ChefHat,
   ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAccount } from '../context/AccountContext';
import type { CobroResultado } from '../context/AccountContext';
import { Mesa, Minicomanda, EstadoMesa, ItemMinicomanda } from '../types';
import { imprimirTicket } from '../utils/printer';
import { obtenerItemsPorMinicomanda, actualizarSeatConfig, obtenerCuentaPorId, obtenerTodosLosExtras } from '../db/SupabaseQueries';
import { supabase } from '../db/supabaseClient';
import { ModalWrapper } from './ModalWrapper';

// Formato de moneda mexicana: miles con coma, 2 decimales (ej. 1,565.00)
const formatoMXN = (valor: number): string =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

// Paleta de colores pastel para diferenciar comensales (máx 15)
const SEAT_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', active: 'bg-blue-500 text-white border-blue-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', active: 'bg-emerald-500 text-white border-emerald-500' },
  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', active: 'bg-amber-500 text-white border-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', active: 'bg-rose-500 text-white border-rose-500' },
  { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', active: 'bg-violet-500 text-white border-violet-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', active: 'bg-cyan-500 text-white border-cyan-500' },
  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', active: 'bg-orange-500 text-white border-orange-500' },
  { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700', active: 'bg-teal-500 text-white border-teal-500' },
  { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700', active: 'bg-pink-500 text-white border-pink-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', active: 'bg-indigo-500 text-white border-indigo-500' },
  { bg: 'bg-lime-50', border: 'border-lime-300', text: 'text-lime-700', badge: 'bg-lime-100 text-lime-700', active: 'bg-lime-500 text-white border-lime-500' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', text: 'text-fuchsia-700', badge: 'bg-fuchsia-100 text-fuchsia-700', active: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700', active: 'bg-sky-500 text-white border-sky-500' },
  { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-100 text-red-700', active: 'bg-red-500 text-white border-red-500' },
  { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100 text-green-700', active: 'bg-green-500 text-white border-green-500' },
];

export const WaiterView: React.FC = () => {
  const {
    meseroLogueado,
    mesas,
    mesaSeleccionada,
    setMesaSeleccionada,
    estadoMesa,
    carroLocal,
    comensalActivo,
    setComensalActivo,
    cuentaActual,
    setCuentaActual,
    minicomandas,
    cuentasAbiertas,
    cuentaActivaIndex,
    loginMesero,
    logoutMesero,
    seleccionarMesa,
    liberarMesa,
    cambiarMesa,
    agregarAlCarro,
    removeFromCarro,
    updateCarroQuantity,
    clearCarro,
    setCarroLocal,
    enviarACocina,
    enviandoACocina,
    cobrarCuenta,
    cobrarAsientos,
    verHistorial,
    seleccionarCuentaAbierta,
    moverItem,
    dividirPorAsiento,
    combinarCuentas,
    obtenerCuentasAbiertasPorMesa,
    recargarEstadoMesa,
    calcularTotalCarro,
    resolverSalidaComensal,
    actualizarRepartoItem,
    obtenerSharesPorItem,
    itemsDeCocina,
    cargarItemsDeCocina,
    asientosActivos: asientosDeCocina,
    setAsientosActivos: setAsientosDeCocina,
    solicitudReemplazo,
    confirmarReemplazo,
    cancelarReemplazo,
    obtenerNombreMesero
  } = useAccount();

  const [activeTab, setActiveTab] = useState<CategoryId>('bebidas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'efectivo' | 'electronico'>('efectivo');
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialData, setHistorialData] = useState<{ mesa: Mesa; minicomandas: Minicomanda[]; items: any[] } | null>(null);
  const [expandedSeatHistorial, setExpandedSeatHistorial] = useState<Record<number, boolean>>({});
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [showSeatSplitModal, setShowSeatSplitModal] = useState(false);
  const [numComensalesSplit, setNumComensalesSplit] = useState(2);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showLiberarModal, setShowLiberarModal] = useState(false);
  const [showLiberarSuccessModal, setShowLiberarSuccessModal] = useState(false);
  const [numeroMesaLiberada, setNumeroMesaLiberada] = useState<string | null>(null);
  // Resultado del cobro para mostrar modal profesional de confirmación
  const [cobroSuccess, setCobroSuccess] = useState<CobroResultado | null>(null);
  // Nombres de meseros atendiendo cada mesa (para mostrar en selector)
  const [mesesConNombres, setMesesConNombres] = useState<Record<number, string>>({});
  // Comensales (asientos) seleccionados para cobrar. Vacío = todos.
  const [comensalesSeleccionados, setComensalesSeleccionados] = useState<number[]>([]);
  // Modal para compartir un ítem del carro
  const [shareItem, setShareItem] = useState<CarroItem | null>(null);
  // Cola de resolución de porciones compartidas al cobrar (un diálogo por ítem)
  const [colaResolucion, setColaResolucion] = useState<{
    item: any;
    asiento: number;
    monto: number;
  }[]>([]);
  // Referencia del cobro en espera mientras se resuelven porciones compartidas
  const cobroPendienteRef = React.useRef<{
    seats: number[];
    pago: number;
    cambio: number;
    metodo: 'efectivo' | 'electronico';
    referencia?: string;
    } | null>(null);

  // Edición de nombre de comensal (Fase 2)
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  // Nombre del mesero actual para el modal de reemplazo
  const [nombreMeseroActual, setNombreMeseroActual] = useState<string>('');

  // Diálogo de confirmación al enviar a cocina
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [envioData, setEnvioData] = useState<{ items: CarroItem[]; total: number } | null>(null);

  // Detección de dispositivo (solo para móvil)
  const deviceType = useDeviceType();
  const isMobile = deviceType === 'mobile';
  // Sheet de comanda en móvil (abre desde bottom bar)
  const [showMobileSheet, setShowMobileSheet] = useState(false);

  // Cargar items de cocina al montar el componente y al cambiar de mesa
  useEffect(() => {
    cargarItemsDeCocina();
  }, [cargarItemsDeCocina]);

  // Cargar nombre del mesero actual cuando hay solicitud de reemplazo
  useEffect(() => {
    if (solicitudReemplazo) {
      obtenerNombreMesero(solicitudReemplazo.meseroActualId)
        .then(setNombreMeseroActual);
    }
  }, [solicitudReemplazo]);

  // Cargar nombres de meseros atendiendo mesas ocupadas
  useEffect(() => {
    mesas.forEach(async (mesa) => {
      if (mesa.mesero_activo_id) {
        const nombre = await obtenerNombreMesero(mesa.mesero_activo_id);
        setMesesConNombres(prev => ({ ...prev, [mesa.id]: nombre }));
      }
    });
  }, [mesas]);

  useEffect(() => {
    const asientosEnCuenta = cuentaActual?.seat_config
      ? Object.keys(cuentaActual.seat_config).map(Number)
      : [];
    const asientosEnCarro = carroLocal.map(it => it.seatNumber || 1);
    const asientosEnCocina = itemsDeCocina.map(it => it.seat_number || 1);
    const todos = new Set<number>([1, ...asientosEnCuenta, ...asientosEnCarro, ...asientosEnCocina]);
    setAsientosDeCocina(Array.from(todos).sort((a, b) => a - b));
  }, [mesaSeleccionada?.id, cuentaActual, carroLocal, itemsDeCocina]);

  // Si el admin accedió directamente, mostrar la vista de selección de mesa
  const isAdminAccess = meseroLogueado && meseroLogueado.id === 0;

  // Filtrar productos por categoría y búsqueda
  const filteredProducts = PRODUCTS.filter(product => {
    const matchesCategory = product.category === activeTab;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchQuery !== '') return matchesSearch;
    return matchesCategory;
  });

  // Handle mesa selection
  const handleSeleccionarMesa = async (mesa: Mesa) => {
    try {
      setHistorialData(null);
      await seleccionarMesa(mesa);
    } catch (error) {
      alert('Error al seleccionar mesa: ' + (error as Error).message);
    }
  };

  // Handle product tap → abrir modal de detalle
  const handleProductTap = (product: Product) => {
    setSelectedProductDetail(product);
  };

  // Handle checkout
  const handleCheckout = async () => {
    const totalACobrar = obtenerTotalCuenta();

    if (totalACobrar <= 0) {
      alert('No hay productos ni consumos registrados para cobrar en esta mesa.');
      return;
    }

    setMontoRecibido(totalACobrar.toFixed(2));
    setReferenciaPago('');
    setShowCheckoutModal(true);
  };

  const handleImprimirTicket = () => {
    if (!mesaSeleccionada) return;
    const total = obtenerTotalCuenta();
    const pago = parseFloat(montoRecibido) || total;
    const cambio = pago - total;

    // Obtener items del carro y minicomandas
    const mesaNum = mesaSeleccionada.numero;
    const meseroNombre = meseroLogueado?.nombre || '';

    // Items de minicomandas (ya enviadas a cocina) + carro local (pendientes)
    const itemsMinicomandas = (historialData?.items || []).map((item: any) => ({
      name: item.producto_id,
      quantity: item.cantidad,
      price: item.precio_unitario,
      notes: item.notas,
      seatNumber: item.seat_number
    }));

    const itemsCarro = carroLocal.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price + (item.selectedOptions || []).reduce((s: number, o: any) => s + o.extraPrice, 0) + (item.selectedExtras || []).reduce((s: number, e: any) => s + e.precio, 0),
      notes: item.notes
    }));

    imprimirTicket({
      restaurantName: 'EL BUEN CAFÉ',
      mesa: mesaNum,
      mesero: meseroNombre,
      items: [...itemsMinicomandas, ...itemsCarro],
      total,
      metodoPago: checkoutPaymentMethod,
      referencia: referenciaPago,
      montoRecibido: pago,
      cambio,
      fecha: new Date().toLocaleString('es-MX'),
      cuentaNumero: cuentaActivaIndex + 1,
      cuentasTotales: cuentasAbiertas.length
    });
  };

  const handleConfirmarCobro = async () => {
    const totalACobrar = obtenerTotalSeleccionado();

    const pago = parseFloat(montoRecibido);
    if (isNaN(pago) || pago < totalACobrar) {
      alert('El pago debe ser mayor o igual al total');
      return;
    }

    const cambio = pago - totalACobrar;
    const seats = comensalesSeleccionados.length > 0 ? comensalesSeleccionados : asientosUnicos();

    // Detectar ítems compartidos con porciones pendientes de los asientos a cobrar.
    // Cada uno requiere resolución manual (un diálogo por ítem) antes de cobrar.
    const pendientes: { item: any; asiento: number; monto: number }[] = [];
    if (historialData) {
      for (const it of historialData.items) {
        if (it.seat_number !== null) continue; // solo compartidos
        const shares = await obtenerSharesPorItem(it.id);
        for (const share of shares) {
          if (seats.includes(share.seat_number) && !share.pagado) {
            pendientes.push({ item: it, asiento: share.seat_number, monto: share.monto });
          }
        }
      }
    }

    if (pendientes.length > 0) {
      // Guardar el cobro pendiente y mostrar la cola de resolución.
      cobroPendienteRef.current = { seats, pago, cambio, metodo: checkoutPaymentMethod, referencia: referenciaPago || undefined };
      setColaResolucion(pendientes);
      return;
    }

    await ejecutarCobro(seats, pago, cambio, checkoutPaymentMethod, referenciaPago || undefined);
  };

  // Ejecuta el cobro tras resolver porciones compartidas (si las hubo)
  const ejecutarCobro = async (
    seats: number[],
    pago: number,
    cambio: number,
    metodo: 'efectivo' | 'electronico',
    referencia?: string
  ) => {
    const resultado = await cobrarAsientos(seats, pago, cambio, metodo, referencia);
    setShowCheckoutModal(false);
    setShowHistorial(false);
    setHistorialData(null);
    setComensalesSeleccionados([]);
    cobroPendienteRef.current = null;
    if (resultado) setCobroSuccess(resultado);
  };

  // Ver historial
  const verHistorialCompleto = async () => {
    if (mesaSeleccionada) {
      try {
        // Recargar estado y usar datos frescos directamente (evita stale closure)
        const estado = await recargarEstadoMesa();

        if (estado) {
          // Consultar cuentas abiertas directamente de la BD (evita estado desactualizado)
          const cuentasDeLaMesa = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
          const hayVariasCuentas = cuentasDeLaMesa.length > 1;

          // Si hay varias cuentas abiertas (división por comensal), cargar TODAS
          // las minicomandas e items para poder seleccionar cualquier cuenta en el cobro
          const minicomandasFiltradas = hayVariasCuentas
            ? estado.minicomandas
            : (cuentaActual?.id
              ? estado.minicomandas.filter((m: Minicomanda) => m.cuenta_id === cuentaActual.id)
              : estado.minicomandas);
          const itemsFiltrados = hayVariasCuentas
            ? estado.items
            : (cuentaActual?.id
              ? estado.items.filter((it: any) => minicomandasFiltradas.some((m: Minicomanda) => m.id === it.minicomanda_id))
              : estado.items);

          setHistorialData({
            mesa: estado.mesa,
            minicomandas: minicomandasFiltradas,
            items: itemsFiltrados
          });
          // Por defecto, todos los comensales seleccionados para cobrar
          const seats = Array.from(new Set(itemsFiltrados.map((it: any) => it.seat_number || 1))) as number[];
          seats.sort((a: number, b: number) => a - b);
          setComensalesSeleccionados(seats);
          setShowHistorial(true);
        }
      } catch (error) {
        console.error('Error al obtener historial:', error);
      }
    }
  };

  // Recargar datos del historial sin abrir el modal (usado tras dividir/combinar)
  const recargarCheckoutData = async () => {
    if (mesaSeleccionada) {
      try {
        const estado = await recargarEstadoMesa();
        if (estado) {
          const cuentaId = cuentaActual?.id;
          const minicomandasFiltradas = cuentaId
            ? estado.minicomandas.filter((m: Minicomanda) => m.cuenta_id === cuentaId)
            : estado.minicomandas;
          const itemsFiltrados = cuentaId
            ? estado.items.filter((it: any) => minicomandasFiltradas.some((m: Minicomanda) => m.id === it.minicomanda_id))
            : estado.items;

          setHistorialData({
            mesa: estado.mesa,
            minicomandas: minicomandasFiltradas,
            items: itemsFiltrados
          });
        }
      } catch (error) {
        console.error('Error al recargar datos de cobro:', error);
      }
    }
  };

  // Calcular subtotal de la cuenta
  const calcularSubtotalCuenta = () => {
    return carroLocal.reduce((sum, item) => {
      const optExtra = (item.selectedOptions || []).reduce((oSum: number, o: any) => oSum + o.extraPrice, 0);
      const extrasTotal = (item.selectedExtras || []).reduce((eSum: number, e: any) => eSum + e.precio, 0);
      return sum + (item.product.price + optExtra + extrasTotal) * item.quantity;
    }, 0);
  };

  // Total real de la cuenta: minicomandas en BD (de la cuenta activa) + carro local pendiente
  const obtenerTotalCuenta = (): number => {
    if (historialData && historialData.minicomandas.length > 0 && cuentaActual) {
      const totalCuenta = historialData.minicomandas
        .filter(m => m.cuenta_id === cuentaActual.id)
        .reduce((sum, m) => sum + m.total, 0);
      return totalCuenta;
    }
    if (minicomandas.length > 0 && cuentaActual) {
      const totalCuenta = minicomandas
        .filter(m => m.cuenta_id === cuentaActual.id)
        .reduce((sum, m) => sum + m.total, 0);
      return totalCuenta;
    }
    return cuentaActual ? cuentaActual.total_acumulado : calcularTotalCarro();
  };

  // Asientos (comensales) únicos presentes en la cuenta actual
  const asientosUnicos = (): number[] => {
    if (!historialData) return [];
    const seats = Array.from(new Set(historialData.items.map((it: any) => it.seat_number || 1))) as number[];
    return seats.sort((a: number, b: number) => a - b);
  };

  // Subtotal de un asiento específico
  const calcularSubtotalAsiento = (seat: number): number => {
    if (!historialData) return 0;
    return historialData.items
      .filter((it: any) => (it.seat_number || 1) === seat)
      .reduce((s: number, it: any) => s + it.total_item, 0);
  };

  // Total de los asientos seleccionados (o todos si no hay selección)
  const obtenerTotalSeleccionado = (): number => {
    const seleccion = comensalesSeleccionados.length > 0 ? comensalesSeleccionados : asientosUnicos();
    return seleccion.reduce((s, seat) => s + calcularSubtotalAsiento(seat), 0);
  };

  // ---- Fase 1: Tabs por comensal ----
  // Items del carro local agrupados por seatNumber
  const itemsPorAsiento = useMemo(() => {
    const mapa: Record<number, CarroItem[]> = {};
    carroLocal.forEach(item => {
      const seat = item.seatNumber || 1;
      if (!mapa[seat]) mapa[seat] = [];
      mapa[seat].push(item);
    });
    return mapa;
  }, [carroLocal]);

  // Asientos activos: base = comensales creados explicitamente,
  // mas los que tienen items (carro o BD) y el activo.
  const asientosActivos = useMemo(() => {
    const seats = new Set<number>(asientosDeCocina);
    // Items del carro local
    carroLocal.forEach(item => seats.add(item.seatNumber || 1));
    // Siempre incluir el comensal activo
    seats.add(comensalActivo);
    return Array.from(seats).sort((a, b) => a - b);
  }, [asientosDeCocina, carroLocal, comensalActivo]);

  // Subtotal por asiento (carro local + items de BD)
  const subtotalPorAsiento = useMemo(() => {
    const mapa: Record<number, number> = {};
    // Items del carro local
    Object.entries(itemsPorAsiento).forEach(([seat, items]) => {
      const lista = items as CarroItem[];
      mapa[Number(seat)] = lista.reduce((sum, item) => {
        const optExtra = (item.selectedOptions || []).reduce((s: number, o: any) => s + o.extraPrice, 0);
        const extrasTotal = (item.selectedExtras || []).reduce((eSum: number, e: any) => eSum + e.precio, 0);
        return sum + (item.product.price + optExtra + extrasTotal) * item.quantity;
      }, 0);
    });
    // Sumar items de BD (enviados a cocina)
    itemsDeCocina.forEach(item => {
      const seat = item.seat_number || 1;
      mapa[seat] = (mapa[seat] || 0) + item.total_item;
    });
    return mapa;
  }, [itemsPorAsiento, itemsDeCocina]);

  // Nombre personalizado de un comensal (Fase 2)
  const obtenerNombreAsiento = (seat: number): string => {
    const config = cuentaActual?.seat_config;
    const nombre = config?.[String(seat)]?.nombre?.trim();
    console.log(`[DEBUG obtenerNombreAsiento] seat=${seat} cuentaId=${cuentaActual?.id} config=`, JSON.parse(JSON.stringify(config || {})), `-> nombre=`, nombre);
    return nombre || `C.${seat}`;
  };

  // Guardar nombre de comensal en seat_config (Fase 2)
  // 1) Actualización OPTIMISTA: cambia el nombre en pantalla YA (sin esperar a la BD)
  // 2) Luego persiste en Supabase y recarga para sincronizar
  const guardarNombreAsiento = async (seat: number, nombre: string) => {
    if (!cuentaActual) return;
    const cuentaId = cuentaActual.id;
    try {
      console.log(`[DEBUG guardarNombreAsiento] INICIO seat=${seat} nombre="${nombre}" cuentaId=${cuentaId}`);

      // --- 1) Optimista: actualizar cuentaActual localmente de inmediato ---
      const actualLocal = cuentaActual.seat_config || {};
      let nuevoLocal: Record<string, { nombre: string }>;
      if (nombre.trim() === '') {
        nuevoLocal = { ...actualLocal };
        delete nuevoLocal[String(seat)];
      } else {
        nuevoLocal = { ...actualLocal, [String(seat)]: { nombre: nombre.trim() } };
      }
      setCuentaActual({ ...cuentaActual, seat_config: nuevoLocal });
      console.log(`[DEBUG guardarNombreAsiento] optimista aplicado=`, JSON.parse(JSON.stringify(nuevoLocal)));

      // --- 2) Persistir en BD leyendo el seat_config FRESCO para no pisar otros asientos ---
      const cuentaFresca = await obtenerCuentaPorId(cuentaId);
      if (!cuentaFresca) {
        alert('Error al leer la cuenta');
        return;
      }
      const actual = cuentaFresca.seat_config || {};
      let nuevo: Record<string, { nombre: string }>;
      if (nombre.trim() === '') {
        nuevo = { ...actual };
        delete nuevo[String(seat)];
      } else {
        nuevo = { ...actual, [String(seat)]: { nombre: nombre.trim() } };
      }
      console.log(`[DEBUG guardarNombreAsiento] guardando en BD=`, JSON.parse(JSON.stringify(nuevo)));
      const result = await actualizarSeatConfig(cuentaId, nuevo);
      console.log(`[DEBUG guardarNombreAsiento] resultado actualizarSeatConfig=`, result);
      if (!result.success) {
        alert('No se pudo guardar el nombre: ' + (result.error || ''));
        return;
      }
      // Recargar estado para reflejar el nuevo seat_config en cuentaActual
      try {
        await recargarEstadoMesa();
        console.log(`[DEBUG guardarNombreAsiento] despues de recargarEstadoMesa -> cuentaActual.seat_config=`, JSON.parse(JSON.stringify(cuentaActual?.seat_config || {})));
      } catch (e) {
        console.error('[DEBUG guardarNombreAsiento] error en recargarEstadoMesa:', e);
      }
    } catch (error) {
      console.error('Error al guardar nombre:', error);
      alert('Error al guardar el nombre');
    }
  };

  // Eliminar comensal vacío (sin items en carro ni en BD).
  // Quita el seat de asientosDeCocina para que el tab desaparezca.
  const eliminarComensalVacio = (seat: number) => {
    setAsientosDeCocina(prev => prev.filter(s => s !== seat));
    if (comensalActivo === seat) {
      const idx = asientosActivos.indexOf(seat);
      const siguiente = asientosActivos[idx + 1] || asientosActivos[idx - 1] || 1;
      setComensalActivo(siguiente);
    }
  };

  // Manejar minicomanda devuelta por cocina: mover items al carro para que el mesero modifique y reenvie
  const handleModificarDevuelta = async (mini: Minicomanda) => {
    try {
      const itemsDevueltos = await obtenerItemsPorMinicomanda(mini.id);
      const nuevosItems: CarroItem[] = [];
      for (const it of itemsDevueltos) {
        const producto = PRODUCTS.find(p => p.id === it.producto_id);
        if (!producto) continue;
        const seatNumber = it.seat_number || 1;
        const localId = `devuelta-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${seatNumber}`;
        const carroItem: CarroItem = {
          id: localId,
          product: producto,
          quantity: it.cantidad,
          notes: it.notas || '',
          selectedOptions: [],
          seatNumber,
          selectedExtras: []
        };
        nuevosItems.push(carroItem);
      }
      if (nuevosItems.length > 0) {
        setCarroLocal(prev => [...prev, ...nuevosItems]);
      }
      // Eliminar la minicomanda devuelta
      await supabase.from('historial_acciones').delete().eq('minicomanda_id', mini.id);
      await supabase.from('items_minicomanda').delete().eq('minicomanda_id', mini.id);
      await supabase.from('minicomandas').delete().eq('id', mini.id);
      await recargarEstadoMesa();
    } catch (error) {
      console.error('Error al modificar comanda devuelta:', error);
      alert('Error al procesar la comanda devuelta. Intenta de nuevo.');
    }
  };

  // Eliminar minicomanda devuelta sin modificar (el mesero la cancela)
  const handleEliminarDevuelta = async (miniId: number) => {
    if (!window.confirm('¿Eliminar esta comanda devuelta? Los items se perderan.')) return;
    try {
      await supabase.from('historial_acciones').delete().eq('minicomanda_id', miniId);
      await supabase.from('items_minicomanda').delete().eq('minicomanda_id', miniId);
      await supabase.from('minicomandas').delete().eq('id', miniId);
      await recargarEstadoMesa();
    } catch (error) {
      console.error('Error al eliminar comanda devuelta:', error);
      alert('Error al eliminar la comanda devuelta.');
    }
  };

  // Cuando se terminan de resolver todas las porciones compartidas, ejecutar el cobro.
  useEffect(() => {
    if (colaResolucion.length === 0 && cobroPendienteRef.current) {
      const pend = cobroPendienteRef.current;
      ejecutarCobro(pend.seats, pend.pago, pend.cambio, pend.metodo, pend.referencia);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaResolucion]);

  // JSX del modal de éxito de cobro — se renderiza en ambas vistas (selección y
  // detalle) porque al liberar la mesa (mesaSeleccionada = null) la vista cambia
  // a "selección de mesas", que de otro modo omitiría el modal.
  const cobroExitosoModal = (
    <AnimatePresence>
      {cobroSuccess && (
        <div id="cobro-exitoso-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, type: 'spring', stiffness: 320, damping: 26 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-emerald-500/30 text-slate-800"
          >
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 px-6 py-6 text-center relative text-white">
              <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-md backdrop-blur-md">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide">Cobro Exitoso</h3>
              <p className="text-white/90 text-xs mt-1 font-medium">Mesa {cobroSuccess.mesaNumero}</p>
            </div>

            <div className="p-6 space-y-4 bg-emerald-50/50 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              {cobroSuccess.mesaLiberada ? (
                <p className="text-slate-800 font-medium text-sm leading-relaxed">
                  El pago de <strong>${formatoMXN(cobroSuccess.totalPagado)}</strong> se registró correctamente.
                  La mesa <strong>{cobroSuccess.mesaNumero}</strong> ha quedado <strong>LIBRE</strong> y se encuentra disponible para atender a nuevos clientes.
                </p>
              ) : (
                <p className="text-slate-800 font-medium text-sm leading-relaxed">
                  Cobro registrado por <strong>${formatoMXN(cobroSuccess.totalPagado)}</strong>. Quedan <strong>{cobroSuccess.pendientesRestantes} comensal(es)</strong> por pagar en esta mesa.
                </p>
              )}
            </div>

            <div className="px-6 pb-6 space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Resumen del cobro</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total cobrado</span>
                  <span className="font-black text-slate-900">${formatoMXN(cobroSuccess.totalPagado)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Cambio</span>
                  <span className="font-black text-slate-900">${formatoMXN(cobroSuccess.cambio)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Método</span>
                  <span className="font-black text-slate-900">{cobroSuccess.metodoPago === 'efectivo' ? 'Efectivo' : '💳 Electrónico'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Atendido por</span>
                  <span className="font-black text-slate-900">{meseroLogueado?.nombre || '—'}</span>
                </div>
                {cobroSuccess.referencia && (
                  <div className="flex justify-between py-2 border-b border-slate-100 col-span-2">
                    <span className="text-slate-600">Referencia</span>
                    <span className="font-black text-slate-900">{cobroSuccess.referencia}</span>
                  </div>
                )}
                {cobroSuccess.tipo === 'asientos' && cobroSuccess.asientosCobrados && (
                  <div className="flex justify-between py-2 border-b border-slate-100 col-span-2">
                    <span className="text-slate-600">Comensales cobrados</span>
                    <span className="font-black text-slate-900">{cobroSuccess.asientosCobrados.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
              <button
                onClick={() => setCobroSuccess(null)}
                className="py-2.5 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition-all"
              >
                Aceptar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Renderizar selección de mesa
  if (!mesaSeleccionada) {
    return (
      <div id="waiter-view" className="min-h-screen bg-brand-green-dark p-4 flex flex-col">
        {cobroExitosoModal}
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-4 text-brand-green-dark rounded-xl shadow-lg mb-4">
          <h2 className="text-2xl font-bold text-center">Seleccionar Mesa</h2>
          <p className="text-center text-xs mt-1 opacity-80">Hola, {meseroLogueado?.nombre}</p>
        </div>

        {/* Mesa Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
            {mesas.map(mesa => (
              <motion.button
                key={mesa.id}
                onClick={() => handleSeleccionarMesa(mesa)}
                className="p-4 bg-brand-crema/10 hover:bg-brand-crema/20 rounded-xl border border-brand-gold/20 hover:border-brand-gold/40 transition-all duration-300 flex flex-col items-center justify-center min-h-[140px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-5xl mb-2">{mesa.numero === 'Barra' ? '🥤' : '🪑'}</div>
                <div className="text-2xl font-black text-brand-gold mb-1 tracking-wide">
                  {mesa.numero === 'Barra' ? 'Barra' : `Mesa ${mesa.numero}`}
                </div>
                <div className="text-xs text-brand-crema/60 mb-2 font-medium uppercase tracking-wider">
                  {mesa.ubicacion || 'Sin ubicación'}
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                  ${mesa.estado === 'LIBRE'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : mesa.estado === 'OCUPADA'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                   {mesa.estado === 'LIBRE' ? 'Disponible' : mesa.estado === 'OCUPADA' ? 'Ocupada' : 'Cobrada'}
                </div>
                {mesa.estado === 'OCUPADA' && mesa.mesero_activo_id && (
                  <div className="mt-1.5 flex items-center justify-center gap-1">
                    <span className="text-[10px] text-brand-crema/80 font-bold truncate max-w-[90px]">
                      👤 {mesesConNombres[mesa.id] || '...'}
                    </span>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

       </div>
      );
  }

  // Render helper: comanda completa (título, alertas, pestañas de comensales, items, total).
  // Reutilizado en panel tableta/desktop y en el bottom sheet móvil.
  const renderComanda = () => (
    <>
      {/* Active Comanda Title */}
      <div className="border-b border-brand-gold/15 pb-3 flex justify-between items-center gap-2">
        <span className="text-xs uppercase font-extrabold tracking-[0.15em] text-brand-warm-gray">
          Comanda Actual
        </span>
        <div className="bg-brand-green-dark text-brand-gold px-3 py-1.5 rounded-xl text-xs font-bold">
          {carroLocal.length} conceptos
        </div>
      </div>

      {/* Alertas de comandas devueltas por cocina */}
      {cuentaActual && cuentaActual.estado === 'ABIERTA' && minicomandas.some(m => m.estado === 'DEVUELTA') && (
        <div className="mt-2 p-3 bg-amber-50 border-2 border-amber-400 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-black text-amber-800 uppercase tracking-wider">
              Devuelta por cocina
            </span>
          </div>
          {minicomandas.filter(m => m.estado === 'DEVUELTA').map(mini => {
            const itemsMini = itemsDeCocina.filter(it => it.minicomanda_id === mini.id);
            const seat = itemsMini.length > 0 ? itemsMini[0].seat_number : null;
            return (
              <div key={mini.id} className="bg-white rounded-lg p-2 border border-amber-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-900">
                    COM #{mini.id}{seat ? ` - Comensal ${seat}` : ''}
                  </span>
                  <span className="text-xs text-amber-700 font-mono font-bold">${mini.total.toFixed(2)}</span>
                </div>
                <div className="text-xs text-amber-700 space-y-0.5 mb-2">
                  {itemsMini.map(it => (
                    <div key={it.id} className="flex justify-between gap-2">
                      <span>{it.cantidad}x {it.producto_id}</span>
                      {it.notas && <span className="text-red-500 italic text-[10px] truncate max-w-[120px]">{it.notas}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModificarDevuelta(mini)}
                    className="flex-1 py-1.5 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 transition-colors"
                  >
                    Modificar y reenviar
                  </button>
                  <button
                    onClick={() => handleEliminarDevuelta(mini.id)}
                    className="py-1.5 px-3 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                    title="Eliminar sin modificar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Bar — un tab por comensal (etiquetas de comensales) */}
      <div className="border-b border-brand-gold/15 pb-2 pt-2 min-w-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-visible scroll-smooth">
          {asientosActivos.map(seat => {
            const color = SEAT_COLORS[(seat - 1) % SEAT_COLORS.length];
            const isActive = comensalActivo === seat;
            const sub = subtotalPorAsiento[seat] || 0;
            const tieneItems = (itemsPorAsiento[seat]?.length || 0) + (itemsDeCocina.filter(it => (it.seat_number || 1) === seat).length) > 0;
            const editando = editingSeat === seat;
            return (
              <button
                key={seat}
                onClick={() => { if (!editando) setComensalActivo(seat); }}
                className={`relative flex-shrink-0 min-w-[60px] px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isActive
                  ? `${color.active} shadow-md`
                  : `bg-white ${color.text} ${color.border} hover:${color.bg}`
                  }`}
              >
                {editando ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => { guardarNombreAsiento(seat, editingName); setEditingSeat(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { guardarNombreAsiento(seat, editingName); setEditingSeat(null); }
                      if (e.key === 'Escape') { setEditingSeat(null); }
                    }}
                    className="w-14 text-center bg-transparent outline-hidden text-[10px] font-black"
                    placeholder="Nombre"
                    maxLength={20}
                  />
                ) : (
                  <>
                    <div className="font-black max-w-[72px] truncate">{obtenerNombreAsiento(seat)}</div>
                    <div className="text-[10px] opacity-80 font-mono">${formatoMXN(sub)}</div>
                  </>
                )}
                {/* Botón ✏️ (solo tab activo, touch-friendly) */}
                {isActive && !editando && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSeat(seat);
                      setEditingName(cuentaActual?.seat_config?.[String(seat)]?.nombre || '');
                    }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 p-1 bg-white rounded-full shadow flex items-center justify-center text-[10px] hover:scale-110 transition-transform"
                    title="Renombrar comensal"
                  >
                    ✏️
                  </button>
                )}
                {/* Botón × para eliminar tab vacío (sin items) */}
                {!tieneItems && !isActive && !editando && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarComensalVacio(seat);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all z-10 cursor-pointer"
                    title="Eliminar comensal vacío"
                  >×</span>
                )}
              </button>
            );
          })}
          {/* Botón + para agregar comensal (máx 15) */}
          <button
            onClick={() => {
              const maxSeat = asientosActivos.length > 0 ? Math.max(...asientosActivos) : 0;
              if (maxSeat >= 15) {
                alert('Máximo 15 comensales por mesa');
                return;
              }
              const nuevo = maxSeat + 1;
              setAsientosDeCocina(prev => {
                const base = prev.includes(comensalActivo) ? prev : [...prev, comensalActivo];
                return [...base, nuevo];
              });
              setComensalActivo(nuevo);
            }}
            className="flex-shrink-0 w-10 h-10 rounded-xl border-2 border-dashed border-brand-gold/30 flex items-center justify-center text-brand-gold/50 hover:border-brand-gold hover:text-brand-gold transition-colors"
            title="Agregar comensal"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items del comensal activo: carro local + enviados a cocina */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {(() => {
          const itemsCarroDelAsiento = itemsPorAsiento[comensalActivo] || [];
          const itemsBDDelAsiento = itemsDeCocina.filter(it => (it.seat_number || 1) === comensalActivo);
          const totalItems = itemsCarroDelAsiento.length + itemsBDDelAsiento.length;

          if (totalItems === 0) {
            return (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-brand-warm-gray/60 space-y-2">
                <ClipboardList className="w-10 h-10 stroke-1 text-brand-warm-gray/40" />
                <p className="text-xs font-bold uppercase tracking-wider">C.{comensalActivo} sin items</p>
                <p className="text-[10px] text-brand-warm-gray/50">Selecciona productos y asígnalos a este comensal.</p>
              </div>
            );
          }

          return (
            <>
              {/* Items del carro local (pendientes de enviar a cocina) */}
              {itemsCarroDelAsiento.map(item => {
                const optExtra = (item.selectedOptions || []).reduce((sum: number, o: any) => sum + o.extraPrice, 0);
                const extrasTotal = (item.selectedExtras || []).reduce((eSum: number, e: any) => eSum + e.precio, 0);
                const itemSinglePrice = item.product.price + optExtra + extrasTotal;

                return (
                  <div key={`carro-${item.id}`} className="bg-white/80 rounded-xl p-3 border border-brand-crema-dark/20 space-y-2.5 text-slate-800 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.sharedWith && item.sharedWith.length > 0 && (
                            <span className="bg-purple-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">⇄</span>
                          )}
                          <span className="text-xs font-black text-brand-green-dark">{item.product.name}</span>
                        </div>
                        {(item.selectedOptions || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(item.selectedOptions || []).map((opt: any) => (
                              <span key={opt.choiceName} className="text-[9px] font-bold text-brand-green-dark bg-brand-gold/15 px-1.5 py-0.5 rounded">
                                {opt.choiceName}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.sharedWith && item.sharedWith.length > 0 && (
                          <div className="mt-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded inline-block">
                            Compartido: {item.sharedWith.map(s => `C.${s.seat} ${s.porcentaje}%`).join(' + ')}
                          </div>
                        )}
                      </div>

                      <span className="text-xs font-mono font-bold text-brand-green-dark shrink-0">
                        ${formatoMXN(itemSinglePrice * item.quantity)}
                      </span>
                    </div>

                    {item.notes && item.notes.trim() !== '' && (
                      <div className="flex items-start gap-1.5 mt-2 bg-brand-crema/50 p-2 rounded-lg border-l-2 border-brand-gold/30">
                        <MessageSquare className="w-3 h-3 text-brand-warm-gray/60 mt-0.5 shrink-0" />
                        <p className="text-[10px] italic text-brand-warm-gray">{item.notes}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-brand-crema-dark/10 pt-2 mt-2">
                      <button
                        onClick={() => removeFromCarro(item.id)}
                        className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setShareItem(item)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" />
                        {item.sharedWith && item.sharedWith.length > 0 ? 'Editar' : 'Compartir'}
                      </button>

                      <div className="flex items-center gap-2.5 bg-brand-crema-light border border-brand-crema-dark/20 rounded-md p-0.5">
                        <button
                          onClick={() => updateCarroQuantity(item.id, -1)}
                          className="p-1 hover:bg-white rounded text-brand-warm-gray transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-sm text-brand-green-dark">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCarroQuantity(item.id, 1)}
                          className="p-1 hover:bg-white rounded text-brand-warm-gray transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Items enviados a cocina (BD) — solo lectura con indicador de estado */}
              {itemsBDDelAsiento.map(itemBD => {
                const nombreProd = PRODUCTS.find(p => p.id === itemBD.producto_id)?.name || itemBD.producto_id;
                const estado = itemBD.estado_minicomanda || 'PENDIENTE';
                const esListo = estado === 'LISTO';
                const esDevuelto = estado === 'DEVUELTA';

                let estadoBadge = null;
                let borderClass = 'border-brand-crema-dark/20';
                let bgClass = 'bg-brand-crema-light/50';

                if (esListo) {
                  estadoBadge = (
                    <span className="inline-flex items-center gap-0.5 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                      <CheckCircle className="w-2.5 h-2.5" /> Listo
                    </span>
                  );
                  borderClass = 'border-emerald-300';
                  bgClass = 'bg-emerald-50/50';
                } else if (esDevuelto) {
                  estadoBadge = (
                    <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                      <AlertTriangle className="w-2.5 h-2.5" /> Devuelta
                    </span>
                  );
                  borderClass = 'border-amber-300';
                  bgClass = 'bg-amber-50/50';
                } else {
                  estadoBadge = (
                    <span className="inline-flex items-center gap-0.5 bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                      En cocina
                    </span>
                  );
                }

                return (
                  <div key={`bd-${itemBD.id}`} className={`${bgClass} rounded-xl p-3 border ${borderClass} space-y-2 text-slate-800 shadow-sm`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-brand-warm-gray/70">#{itemBD.cantidad}</span>
                          <span className="text-xs font-black text-brand-green-dark">{nombreProd}</span>
                          {estadoBadge}
                        </div>
                        {itemBD.notas && itemBD.notas.trim() !== '' && (
                          <div className="flex items-start gap-1 mt-1">
                            <MessageSquare className="w-3 h-3 text-brand-warm-gray/50 mt-0.5 shrink-0" />
                            <p className="text-[10px] italic text-brand-warm-gray">{itemBD.notas}</p>
                          </div>
                        )}
                      </div>

                      <span className="text-xs font-mono font-bold text-brand-green-dark shrink-0">
                        ${formatoMXN(itemBD.total_item)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>

      {/* Pricing Summary & Send CTA */}
      <div className="border-t border-brand-gold/15 pt-4 mt-3 space-y-4 shrink-0">
        <div className="flex justify-between items-baseline font-mono">
          <span className="text-xs uppercase font-extrabold tracking-[0.15em] text-brand-warm-gray font-sans">Total:</span>
          <span className="text-2xl font-black text-brand-green-dark">
             ${formatoMXN(calcularSubtotalCuenta())}
          </span>
        </div>

        <button
          onClick={async () => {
            const result = await enviarACocina();
            if (result.ok && result.items) {
              setEnvioData({ items: result.items, total: result.total || 0 });
              setShowEnvioModal(true);
            } else if (!result.ok && result.error) {
              alert(result.error);
            }
          }}
          disabled={carroLocal.length === 0 || enviandoACocina}
          className={`w-full py-4 rounded-2xl font-bold flex flex-col items-center justify-center shadow-lg transition-all active:scale-[0.99] ${carroLocal.length === 0 || enviandoACocina
            ? 'bg-brand-crema-dark/50 border border-brand-crema-dark text-brand-warm-gray/50 cursor-not-allowed'
            : 'bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark shadow-brand-gold/20 btn-glow cursor-pointer'
            }`}
        >
          <span className="text-xl font-black uppercase tracking-tighter font-display">
            {enviandoACocina ? 'Enviando...' : 'Enviar a Cocina'}
          </span>
          <span className="text-[10px] opacity-70 uppercase font-bold tracking-widest">
            {enviandoACocina ? 'Procesando comanda' : 'Imprimir Comanda'}
          </span>
        </button>

        {/* Botón Cuenta — Acción de cobro (reubicado desde header) */}
        <button
          onClick={verHistorialCompleto}
          className="w-full py-4 rounded-2xl font-bold flex flex-col items-center justify-center shadow-lg transition-all active:scale-[0.99] bg-white text-brand-green-dark border-2 border-brand-gold hover:bg-brand-crema hover:shadow-brand-gold/20 cursor-pointer"
          title="Ver consumos de la mesa y cobrar"
        >
          <span className="text-xl font-black uppercase tracking-tighter font-display">
            Cuenta
          </span>
          <span className="text-[10px] opacity-70 uppercase font-bold tracking-widest">
            Cobrar y liberar
          </span>
        </button>
      </div>
    </>
  );

  // Renderizar vista principal con mesa seleccionada
  return (
    <div id="waiter-view" className="h-[calc(100dvh-4rem)] bg-brand-green-dark p-4 flex flex-col overflow-hidden">
       {/* Header con info de mesa */}
      <div className="bg-gradient-to-r from-brand-green to-brand-green-dark px-5 py-4 flex flex-wrap gap-4 items-center justify-between border-b border-brand-gold/15 shadow-lg">
        <div className="flex items-center gap-3">
          
          <ClipboardList className="w-5 h-5 text-brand-gold" />
          <div>
            <h2 className="text-base font-display font-bold tracking-tight text-white">Toma de Orden</h2>
            <p className="text-xs text-white/70">
              Mesa {mesaSeleccionada.numero} • {mesaSeleccionada.ubicacion}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={cambiarMesa}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all border border-white/10"
          >
            <DoorOpen className="w-5 h-5" />
            <span className="hidden sm:inline">Cambiar Mesa</span>
          </button>

          {/* Liberar Mesa - visible cuando hay cuenta abierta (mesa ocupada) */}
          {(cuentaActual && cuentaActual.estado === 'ABIERTA') && (
            <button
              onClick={() => setShowLiberarModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25 text-sm font-bold transition-all"
              title="Liberar mesa (cancelar cuenta sin cobro)"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="hidden md:inline">Liberar</span>
            </button>
          )}

          <div className="h-8 w-px bg-white/15"></div>

          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs font-bold uppercase hidden md:inline">Mesero:</span>
            <span className="text-white font-bold text-sm">{meseroLogueado?.nombre}</span>
          </div>

          <button
            onClick={async () => { await logoutMesero(); window.dispatchEvent(new Event('open_role_modal')); }}
            className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/20 text-xs font-bold transition-all"
          >
            <User className="w-5 h-5" />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Main split-view tablet layout */}
      <div className="flex-1 grid grid-cols-1 grid-rows-1 md:grid-rows-1 md:grid-cols-10 gap-3 mt-3 overflow-hidden min-h-0">
        {/* Left Side (60%): Categories & Fast Product Grid */}
        <div className="md:col-span-6 bg-brand-green/40 backdrop-blur-md rounded-b-xl md:rounded-b-none md:rounded-bl-xl p-4 flex flex-col min-h-0 border border-brand-gold/10 overflow-hidden md:pb-4 pb-[calc(4rem+16px)]">
          {/* Categories Pills */}
          <div className="relative">
            {/* Scroll indicator left */}
            <div className="absolute left-0 top-0 bottom-3 w-8 bg-gradient-to-r from-brand-green/40 to-transparent pointer-events-none z-10" />
            {/* Scroll indicator right */}
            <div className="absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-brand-green/40 to-transparent pointer-events-none z-10" />

            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-visible scroll-smooth border-b border-brand-gold/10 select-none">
              {CATEGORIES.filter(c => c.id !== 'especiales').map((cat) => {
                const accent = CATEGORY_ACCENTS[cat.id];
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`relative text-sm font-bold py-2.5 px-5 rounded-xl shrink-0 transition-all duration-300 whitespace-nowrap border-2 ${
                      isActive
                        ? `${accent.dot} text-brand-green-dark border-transparent shadow-lg scale-105`
                        : `bg-brand-green/30 ${accent.text} ${accent.border} hover:bg-brand-green/60`
                    }`}
                  >
                    <span
                      className={`absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full ${
                        isActive ? accent.dot : accent.dot + '/40'
                      } ring-2 ring-brand-green-dark`}
                    />
                    <span className="flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-brand-gold/10 text-brand-crema placeholder-brand-crema/40 rounded-xl text-sm border-2 border-brand-gold/50 ring-1 ring-brand-gold/20 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40 outline-hidden transition-all"
            />
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-brand-gold" />
          </div>

          {/* Product grid with images */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <motion.button
                  key={product.id}
                  onClick={() => handleProductTap(product)}
                  whileTap={{ scale: 0.97 }}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col text-left card-gold-border group cursor-pointer"
                >
                  {/* Product image — solo tableta/desktop */}
                  <div className={`overflow-hidden relative ${product.image ? 'hidden md:block' : 'hidden'}`}>
                    <div className="h-32 sm:h-36 bg-brand-green-dark/5">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    {product.popular && (
                      <span className="absolute top-2 left-2 bg-brand-gold text-brand-green-dark font-bold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Popular
                      </span>
                    )}
                  </div>

                  {/* En móvil: icono/placeholder sutil */}
                  {!product.image && (
                    <div className="md:hidden h-16 bg-gradient-to-br from-brand-crema to-brand-crema-dark/30 flex items-center justify-center text-2xl">
                      ☕
                    </div>
                  )}

                  {/* Product info */}
                  <div className="p-3 flex flex-col justify-between flex-1">
                    <span className={`font-bold leading-snug text-brand-green-dark line-clamp-2 min-h-[2.5rem] ${product.image ? 'text-xs' : 'text-sm'}`}>
                      {product.name}
                    </span>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono font-bold text-brand-green-dark">
                        ${formatoMXN(product.price)}
                      </span>
                      <span className="bg-brand-gold/20 text-brand-green-dark text-[10px] font-bold py-1 px-2 rounded-lg">
                        Agregar
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-brand-crema/40">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">Sin resultados</p>
                <p className="text-xs mt-1">Prueba con otra búsqueda</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side (40%): Live Comanda System — visible solo en tablet/desktop */}
        <div className="md:col-span-4 bg-brand-crema rounded-xl p-4 flex flex-col min-h-0 border border-brand-crema-dark/30 overflow-hidden text-brand-green-dark hidden md:flex">
          {renderComanda()}
        </div>
      </div>

      {/* ── Móvil: bottom bar (solo ícono) + sheet de comanda ── */}
      {isMobile && (
        <>
          {/* Bottom bar móvil: solo ícono de carrito + badge */}
          <motion.div
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4"
            initial={{ y: 100 }} animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <motion.button
              onClick={() => setShowMobileSheet(true)}
              whileTap={{ scale: 0.93 }}
              className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark shadow-xl shadow-brand-gold/40 hover:from-brand-gold-light hover:to-brand-gold transition-all active:scale-95"
              title="Ver comanda"
            >
              <ShoppingCart className="w-7 h-7" />
              {(carroLocal.length + itemsDeCocina.length) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {carroLocal.length + itemsDeCocina.length}
                </span>
              )}
            </motion.button>
          </motion.div>

          {/* Bottom sheet móvil — reutiliza comanda completa con pestañas de comensales */}
          <AnimatePresence>
            {showMobileSheet && (
              <>
                <motion.div
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowMobileSheet(false)}
                />
                <motion.div
                  className="fixed bottom-0 left-0 right-0 z-50 bg-brand-crema rounded-t-3xl shadow-2xl overflow-hidden border-t border-brand-crema-dark/30"
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.35 }}
                  dragSnapToOrigin
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 120 || info.velocity.y > 600) {
                      setShowMobileSheet(false);
                    }
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Muesca: barra de arrastre + flecha indicando dirección */}
                  <div className="pt-3 pb-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing touch-none select-none">
                    <div className="w-12 h-1.5 bg-brand-green-dark/30 rounded-full" />
                    <ChevronDown className="w-4 h-4 text-brand-green-dark/40" />
                  </div>
                  {/* Contenido scrolleable (dragListener=false evita conflicto con el scroll) */}
                  <motion.div
                    dragListener={false}
                    className="p-3 pb-[env(safe-area-inset-bottom)] max-h-[calc(100dvh-4rem-64px)] overflow-y-auto"
                  >
                    {renderComanda()}
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Modal de confirmación de reemplazo de mesero */}
      <AnimatePresence>
      {solicitudReemplazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-brand-green-dark mb-2">Mesa Ocupada</h3>
              <p className="text-sm text-brand-warm-gray mb-6">
                La mesa <span className="font-bold">{solicitudReemplazo.mesa.numero}</span> está siendo atendida por <span className="font-bold">{nombreMeseroActual}</span>.
                <br /><br />
                ¿Deseas tomar esta mesa y reemplazar al mesero actual?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelarReemplazo}
                  className="flex-1 py-3 rounded-xl border border-brand-gold/30 text-brand-green-dark font-bold text-sm hover:bg-brand-crema transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarReemplazo}
                  className="flex-1 py-3 rounded-xl bg-brand-gold text-brand-green-dark font-black text-sm hover:bg-brand-gold-light transition-colors"
                >
                  Tomar Mesa
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Diálogo: Comanda enviada a cocina */}
      <AnimatePresence>
      {showEnvioModal && envioData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-brand-green-dark mb-2">¡Comanda enviada!</h3>
              <p className="text-sm text-brand-warm-gray mb-6">
                Los platillos han sido enviados a cocina y aparecerán en esta sección<br />
                como solo lectura con el estado de preparación.
              </p>

              {/* Lista resumida de items enviados */}
              <div className="max-h-48 overflow-y-auto mb-4 space-y-2 text-left">
                {envioData.items.map((item, idx) => {
                  const optExtra = (item.selectedOptions || []).reduce((s: number, o: any) => s + o.extraPrice, 0);
                  const extrasTotal = (item.selectedExtras || []).reduce((s: number, e: any) => s + e.precio, 0);
                  const precio = (item.product.price + optExtra + extrasTotal) * item.quantity;
                  const seat = item.seatNumber || 1;
                  return (
                    <div key={`envio-${idx}`} className="flex items-center justify-between p-2 bg-brand-crema/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-black text-brand-green-dark">{item.product.name}</span>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEAT_COLORS[(seat - 1) % SEAT_COLORS.length].badge}`}>
                            C.{seat}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-[9px] font-bold text-brand-warm-gray/60">x{item.quantity}</span>
                          )}
                        </div>
                        {item.notes && item.notes.trim() && (
                          <p className="text-[9px] italic text-brand-warm-gray/50 truncate">{item.notes}</p>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-brand-green-dark shrink-0 ml-2">
                        ${formatoMXN(precio)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="border-t border-brand-gold/15 pt-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-extrabold tracking-[0.15em] text-brand-warm-gray">Total enviado:</span>
                  <span className="text-xl font-black text-brand-green-dark font-mono">
                    ${formatoMXN(envioData.total)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowEnvioModal(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark font-black text-base hover:from-brand-gold-light hover:to-brand-gold transition-all shadow-md"
              >
                Aceptar
              </button>
            </div>
            </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <ProductDetailModalWaiter
        product={selectedProductDetail}
        isOpen={!!selectedProductDetail}
        onClose={() => setSelectedProductDetail(null)}
        onAdd={(product, quantity, notes, options, extras) => {
          agregarAlCarro(product, quantity, notes, options, extras, comensalActivo);
          setSelectedProductDetail(null);
        }}
      />

      {/* Historial Modal - Diseño profesional tipo cuenta de restaurante */}
      <AnimatePresence>
        {showHistorial && historialData && (
          <div id="historial-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-brand-gold/20"
            >
              {/* Header estilo factura */}
              <div className="bg-gradient-to-r from-brand-green-dark via-brand-green to-brand-green-dark px-6 pt-8 pb-6 text-center relative">
                <button
                  onClick={() => setShowHistorial(false)}
                  className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 mx-auto bg-brand-gold rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-black/20">
                  <Receipt className="w-8 h-8 text-brand-green-dark" />
                </div>
                <h2 className="text-xl font-black text-brand-gold uppercase tracking-wide">El Buen Café</h2>
                <p className="text-white/60 text-xs mt-1 font-medium">Cuenta de Mesa</p>
              </div>

              {/* Info de mesa y mesero */}
              <div className="bg-brand-crema-dark/10 px-6 py-4 flex items-center justify-between border-b border-brand-gold/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-green-dark/10 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-brand-green-dark" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-brand-warm-gray/50">Mesa</p>
                    <p className="text-lg font-black text-brand-green-dark">
                      {historialData.mesa.numero}
                      <span className="text-xs font-normal text-brand-warm-gray/50 ml-2">{historialData.mesa.ubicacion}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-brand-warm-gray/50">Mesero</p>
                  <p className="text-sm font-bold text-brand-green-dark">{meseroLogueado?.nombre || '—'}</p>
                </div>
              </div>

              {/* Totales y botón de cobro */}
              {asientosUnicos().length > 0 && (
                <div className="px-6 pb-6 pt-4 bg-brand-crema-dark/5 space-y-3 overflow-y-auto flex-1">
                      <p className="text-sm font-bold text-brand-green-dark text-center">
                        Divide la cuenta por comensal y selecciona quién paga
                      </p>
                      {/* Selector de comensales a cobrar */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase text-brand-warm-gray/60 tracking-wider">Selecciona quién paga:</span>
                        {asientosUnicos().map((seat) => {
                          const sub = calcularSubtotalAsiento(seat);
                          const activo = comensalesSeleccionados.length === 0 || comensalesSeleccionados.includes(seat);
                          const estaExpandido = !!expandedSeatHistorial[seat];
                          const itemsDelComensal = (historialData?.items || []).filter((it: any) => (it.seat_number || 1) === seat);

                          return (
                            <div key={seat} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setComensalesSeleccionados(prev => {
                                      if (prev.length === 0) {
                                        // todos menos este
                                        return asientosUnicos().filter(s => s !== seat);
                                      }
                                      if (prev.includes(seat)) {
                                        return prev.filter(s => s !== seat);
                                      }
                                      return [...prev, seat];
                                    });
                                  }}
                                  className={`flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border text-left transition-all ${activo
                                    ? 'bg-brand-gold/15 border-brand-gold text-brand-green-dark'
                                    : 'bg-white border-brand-gold/20 text-brand-warm-gray'
                                    }`}
                                >
                                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${activo ? 'bg-brand-gold border-brand-gold' : 'border-brand-warm-gray/30'}`}>
                                    {activo && <CheckCircle className="w-4 h-4 text-brand-green-dark" />}
                                  </span>
                                  <span className="flex-1 font-bold text-sm">{obtenerNombreAsiento(seat)}</span>
                                  <span className="font-black text-sm font-mono">${formatoMXN(sub)}</span>
                                </button>

                                {/* Botón para ver/ocultar detalle de lo pedido */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSeatHistorial(prev => ({ ...prev, [seat]: !prev[seat] }));
                                  }}
                                  className={`p-3 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all ${
                                    estaExpandido
                                      ? 'bg-brand-gold text-brand-green-dark border-brand-gold shadow-sm'
                                      : 'bg-white border-brand-gold/20 text-brand-green-dark hover:bg-brand-crema'
                                  }`}
                                  title="Ver detalle de platillos pedidos"
                                >
                                  {estaExpandido ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4 text-brand-green-dark" />}
                                  <span className="hidden sm:inline">{estaExpandido ? 'Ocultar' : 'Detalle'}</span>
                                </button>

                                {/* Cobro rápido de este comensal */}
                                <button
                                  onClick={() => {
                                    setComensalesSeleccionados([seat]);
                                    setShowHistorial(false);
                                    setMontoRecibido(sub.toFixed(2));
                                    setReferenciaPago('');
                                    setShowCheckoutModal(true);
                                  }}
                                  className="px-3 py-3 rounded-xl bg-gradient-to-r from-brand-green to-brand-green-dark text-white font-black text-xs shadow hover:from-brand-green-light hover:to-brand-green transition-all whitespace-nowrap"
                                >
                                  Cobrar
                                </button>
                              </div>

                              {/* Detalle desplegable de platillos pedidos por este comensal */}
                              {estaExpandido && (
                                <div className="bg-white/90 rounded-2xl p-3 border border-brand-gold/20 shadow-inner space-y-2 text-slate-800">
                                  <div className="flex items-center justify-between pb-1 border-b border-brand-gold/10">
                                    <span className="text-[11px] font-black uppercase text-brand-green-dark tracking-wider">
                                      Historial de pedidos: {obtenerNombreAsiento(seat)}
                                    </span>
                                    <span className="text-[10px] font-bold text-brand-warm-gray/70">
                                      {itemsDelComensal.length} ítem(s)
                                    </span>
                                  </div>
                                  {itemsDelComensal.length === 0 ? (
                                    <p className="text-xs text-brand-warm-gray/60 italic text-center py-2">
                                      No hay ítems registrados para este comensal
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {itemsDelComensal.map((it: any, idx: number) => {
                                        const nombreProd = PRODUCTS.find(p => p.id === it.producto_id)?.name || it.producto_id;
                                        return (
                                          <div
                                            key={it.id || idx}
                                            className="flex items-start justify-between gap-2 p-2 rounded-xl bg-brand-crema/40 border border-brand-gold/10 text-xs"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-brand-green-dark">
                                                <span className="text-brand-gold-dark font-black mr-1">{it.cantidad}x</span>
                                                {nombreProd}
                                              </div>
                                              {it.notas && it.notas.trim() !== '' && (
                                                <div className="text-[10px] italic text-brand-warm-gray mt-0.5 flex items-center gap-1">
                                                  <MessageSquare className="w-3 h-3 text-brand-warm-gray/50 shrink-0" />
                                                  <span>{it.notas}</span>
                                                </div>
                                              )}
                                            </div>
                                            <span className="font-mono font-bold text-brand-green-dark shrink-0 pt-0.5">
                                              ${formatoMXN(it.total_item)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Total de lo seleccionado */}
                      <div className="flex justify-between items-center pt-2 border-t border-brand-gold/10">
                        <span className="text-base font-black text-brand-green-dark uppercase">Total a cobrar</span>
                        <span className="text-2xl font-black text-brand-green-dark">${formatoMXN(obtenerTotalSeleccionado())}</span>
                      </div>

                      {/* Botón principal: cobrar lo seleccionado */}
                      <button
                        onClick={() => {
                          setShowHistorial(false);
                          setMontoRecibido(obtenerTotalSeleccionado().toFixed(2));
                          setReferenciaPago('');
                          setShowCheckoutModal(true);
                        }}
                        disabled={obtenerTotalSeleccionado() <= 0}
                        className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-white font-black py-5 rounded-2xl shadow-lg shadow-brand-green/25 flex items-center justify-center gap-3 text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <DollarSign className="w-6 h-6" />
                        <span>Cobrar ${formatoMXN(obtenerTotalSeleccionado())}</span>
                      </button>
                  </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div id="checkout-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="bg-brand-crema-light w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-gradient-to-r from-brand-green to-brand-green-dark p-6 text-brand-crema text-center">
                <div className="w-16 h-16 mx-auto bg-brand-crema rounded-full flex items-center justify-center mb-3 shadow-lg">
                  <DollarSign className="w-8 h-8 text-brand-green-dark" />
                </div>
                <h2 className="text-xl font-bold">Cobrar Cuenta</h2>
                <p className="text-sm text-brand-crema/80 mt-1">
                  Mesa {mesaSeleccionada?.numero}
                  {(() => {
                    const seatActivo = (() => {
                      const minisCuenta = (historialData?.minicomandas || [])
                        .filter((m: any) => m.cuenta_id === cuentaActual?.id);
                      const itemsCuenta = (historialData?.items || [])
                        .filter((it: any) => minisCuenta.some((m: any) => m.id === it.minicomanda_id));
                      const seats = Array.from(new Set(itemsCuenta.map((it: any) => it.seat_number || 1)));
                      return seats.length === 1 ? (seats[0] as number) : null;
                    })();
                    if (cuentasAbiertas.length > 1) {
                      return seatActivo !== null
                        ? <> · {obtenerNombreAsiento(seatActivo)}</>
                        : <> · Cuenta {cuentaActivaIndex + 1} de {cuentasAbiertas.length}</>;
                    }
                    return null;
                  })()}
                </p>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Resumen de comensales a cobrar en este pago */}
                <div className="bg-brand-crema-dark/10 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1">Cobrando a:</p>
                  <div className="flex flex-wrap gap-2">
                    {asientosUnicos()
                      .filter(seat => (comensalesSeleccionados.length === 0 ? true : comensalesSeleccionados.includes(seat)))
                      .map(seat => (
                        <span key={seat} className="px-3 py-1.5 rounded-full bg-brand-gold/20 text-brand-green-dark font-bold text-xs border border-brand-gold/30">
                          {obtenerNombreAsiento(seat)} · ${formatoMXN(calcularSubtotalAsiento(seat))}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Total a cobrar */}
                <div className="bg-brand-crema-dark/10 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1">Total a Cobrar</p>
                  <p className="text-4xl font-black text-brand-green-dark">
                    ${formatoMXN(obtenerTotalSeleccionado())}
                  </p>
                </div>

                {/* Detalle de la cuenta */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {minicomandas.length > 0 && (
                    <p className="text-xs font-bold text-brand-warm-gray/60 uppercase">
                      {minicomandas.length} comanda(s) enviada(s)
                    </p>
                  )}
                  {carroLocal.length > 0 && (
                    <p className={`text-xs font-bold uppercase ${minicomandas.length > 0 ? 'text-brand-gold' : 'text-brand-warm-gray/60'}`}>
                      {carroLocal.length} producto(s) pendiente(s)
                    </p>
                  )}
                </div>

                {/* Monto recibido */}
                <div>
                  <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-2 block">
                    ¿Cuánto pagó el cliente?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-brand-warm-gray/40">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      className="w-full bg-white border-2 border-brand-gold/30 rounded-xl py-4 pl-8 pr-4 text-2xl font-black text-brand-green-dark text-center focus:outline-none focus:border-brand-gold"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Cambio */}
                {(() => {
                  const total = obtenerTotalSeleccionado();
                  const pago = parseFloat(montoRecibido) || 0;
                  const cambio = pago - total;
                  return pago >= total ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-700">Cambio:</span>
                      <span className="text-2xl font-black text-emerald-700">${formatoMXN(cambio)}</span>
                    </div>
                  ) : pago > 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-sm font-bold text-red-600">Faltan:</span>
                      <span className="text-2xl font-black text-red-600">${formatoMXN(total - pago)}</span>
                    </div>
                  ) : null;
                })()}

                {/* Referencia / Folio (visible para electrónico) */}
                {checkoutPaymentMethod === 'electronico' && (
                  <div>
                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-2 block">
                      Folio / Referencia de la terminal
                    </label>
                    <input
                      type="text"
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      placeholder="Ej: T-12345 o ref del banco"
                      className="w-full bg-white border-2 border-brand-gold/30 rounded-xl py-3 px-4 text-sm font-bold text-brand-green-dark focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                )}

                {/* Método de pago */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setCheckoutPaymentMethod('efectivo');
                      setReferenciaPago('');
                    }}
                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${checkoutPaymentMethod === 'efectivo'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 ring-2 ring-red-300'
                      : 'bg-brand-crema text-brand-warm-gray hover:bg-brand-crema-dark border border-brand-gold/10'
                      }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Efectivo
                  </button>
                  <button
                    onClick={() => setCheckoutPaymentMethod('electronico')}
                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${checkoutPaymentMethod === 'electronico'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-300'
                      : 'bg-brand-crema text-brand-warm-gray hover:bg-brand-crema-dark border border-brand-gold/10'
                      }`}
                  >
                    💳 Electrónico
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCheckoutModal(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-brand-warm-gray bg-brand-crema-dark/20 hover:bg-brand-crema-dark/30 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImprimirTicket}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-brand-green-dark bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/30 transition-colors flex items-center justify-center gap-2"
                  >
                    🖨️ Ticket
                  </button>
                  <button
                    onClick={handleConfirmarCobro}
                    disabled={!montoRecibido || parseFloat(montoRecibido) < obtenerTotalSeleccionado()}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${(!montoRecibido || parseFloat(montoRecibido) < obtenerTotalSeleccionado())
                      ? 'bg-brand-crema-dark/50 text-brand-warm-gray/50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-brand-green to-brand-green-dark text-brand-crema shadow-lg hover:from-brand-green-light hover:to-brand-green'
                      }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Cobrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Item Modal - Compartir ítem entre comensales */}
      <AnimatePresence>
        {shareItem && (
          <ShareItemModal
            item={shareItem}
            unitPrice={shareItem.product.price + (shareItem.selectedOptions || []).reduce((s: number, o: any) => s + o.extraPrice, 0)}
            onClose={() => setShareItem(null)}
            onConfirm={(itemId, sharedWith) => {
              setCarroLocal(prev => prev.map(it =>
                it.id === itemId
                  ? { ...it, sharedWith, seatNumber: sharedWith.length > 1 ? null : sharedWith[0]?.seat ?? it.seatNumber }
                  : it
              ));
              setShareItem(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Diálogo de resolución de porción compartida al cobrar */}
      <AnimatePresence>
        {colaResolucion.length > 0 && (() => {
          const actual = colaResolucion[0];
          const item = actual.item;
          const asiento = actual.asiento;
          const monto = actual.monto;
          const otros = asientosUnicos().filter(s => s !== asiento);
          const avanzar = async () => {
            const resto = colaResolucion.slice(1);
            setColaResolucion(resto);
            await recargarEstadoMesa();
          };
          return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-purple-300"
              >
                <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-5 text-center relative">
                  <div className="w-12 h-12 mx-auto bg-white rounded-2xl flex items-center justify-center mb-2">
                    <Users className="w-6 h-6 text-purple-700" />
                  </div>
                  <h2 className="text-base font-black text-white uppercase tracking-wide">¿Qué hacemos con la porción?</h2>
                  <p className="text-white/80 text-xs mt-1">{item.producto_id} · porción de C.°{asiento}: ${formatoMXN(monto)}</p>
                </div>
                <div className="p-6 space-y-2">
                  <button
                    onClick={async () => {
                      await resolverSalidaComensal(item.id, asiento, 'pasar', otros[0], asientosUnicos());
                      await avanzar();
                    }}
                    className="w-full py-3 rounded-xl bg-brand-crema-dark/10 hover:bg-brand-crema-dark/20 text-brand-green-dark font-bold text-sm transition-colors"
                  >
                    Pasar a C.°{otros[0] || '—'}
                  </button>
                  <button
                    onClick={async () => {
                      await resolverSalidaComensal(item.id, asiento, 'repartir', undefined, asientosUnicos());
                      await avanzar();
                    }}
                    className="w-full py-3 rounded-xl bg-brand-crema-dark/10 hover:bg-brand-crema-dark/20 text-brand-green-dark font-bold text-sm transition-colors"
                  >
                    Repartir entre los demás
                  </button>
                  <button
                    onClick={async () => {
                      await resolverSalidaComensal(item.id, asiento, 'completa', undefined, asientosUnicos());
                      await avanzar();
                    }}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-colors"
                  >
                    Cobrar a C.°{asiento} completa
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Seat Split Modal - Dividir cuenta por comensal (asiento) */}
      <AnimatePresence>
        {showSeatSplitModal && (
          <SeatSplitModal
            isOpen={true}
            cuentaActual={cuentaActual}
            minicomandas={minicomandas}
            historialData={historialData}
            cuentasAbiertas={cuentasAbiertas}
            onClose={() => {
              setShowSeatSplitModal(false);
              recargarCheckoutData();
            }}
            onMoverItem={moverItem}
            onDividirPorAsiento={dividirPorAsiento}
            onSeleccionarCuenta={seleccionarCuentaAbierta}
          />
        )}
      </AnimatePresence>

      {/* Merge Modal - Unir cuentas restantes en una sola */}
      <AnimatePresence>
        {showMergeModal && (
          <div id="merge-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-brand-gold/20"
            >
              <div className="bg-gradient-to-r from-brand-green-dark to-brand-green px-6 py-5 text-center relative">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-brand-gold uppercase tracking-wide">Unir Cuentas</h2>
                <p className="text-white/60 text-xs mt-1">Selecciona las cuentas a unir en un solo pago</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {cuentasAbiertas.map((cuenta, idx) => {
                  const fuenteMinis = (historialData && historialData.minicomandas.length > 0)
                    ? historialData.minicomandas
                    : minicomandas;
                  const totalCuenta = fuenteMinis
                    .filter((m: any) => m.cuenta_id === cuenta.id)
                    .reduce((s: number, m: any) => s + m.total, 0);
                  const seatDeLaCuenta = (cuenta: any): number | null => {
                    const minisCuenta = fuenteMinis.filter((m: any) => m.cuenta_id === cuenta.id);
                    const itemsCuenta = (historialData?.items || [])
                      .filter((it: any) => minisCuenta.some((m: any) => m.id === it.minicomanda_id));
                    const seats = Array.from(new Set(itemsCuenta.map((it: any) => it.seat_number || 1)));
                    return seats.length === 1 ? (seats[0] as number) : null;
};

                  const seat = seatDeLaCuenta(cuenta);
                  return (
                    <label
                      key={cuenta.id}
                      className="flex items-center gap-3 bg-brand-crema-dark/10 rounded-xl p-3 border border-brand-gold/10 cursor-pointer hover:bg-brand-crema-dark/20 transition-colors"
                    >
                      <input
                        type="checkbox"
                        data-cuenta-id={cuenta.id}
                        defaultChecked={idx === 0}
                        className="merge-checkbox w-5 h-5 accent-brand-gold"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-brand-green-dark">
                          {seat !== null ? obtenerNombreAsiento(seat) : `Cuenta ${idx + 1}`} · ${formatoMXN(totalCuenta)}
                        </p>
                        <p className="text-[10px] text-brand-warm-gray/60">
                          {fuenteMinis.filter((m: any) => m.cuenta_id === cuenta.id).length} comanda(s)
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="px-6 py-4 border-t border-brand-gold/10 bg-brand-crema-dark/5">
                <button
                  onClick={async () => {
                    const seleccionados = Array.from(
                      document.querySelectorAll<HTMLInputElement>('#merge-modal .merge-checkbox:checked')
                    ).map(cb => Number(cb.dataset.cuentaId));
                    if (seleccionados.length < 2) {
                      alert('Selecciona al menos 2 cuentas para unir');
                      return;
                    }
                    setShowMergeModal(false);
                    await combinarCuentas(seleccionados);
                    await recargarCheckoutData();
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                >
                  Unir {Array.from(document.querySelectorAll<HTMLInputElement>('#merge-modal .merge-checkbox:checked')).length} cuenta(s)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación para Liberar Mesa */}
      <AnimatePresence>
        {showLiberarModal && (
          <div id="liberar-mesa-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-amber-500/30 text-slate-800"
            >
              {/* Header de Alerta */}
              <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 px-6 py-6 text-center relative text-white">
                <button
                  onClick={() => setShowLiberarModal(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-xl p-2 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-md backdrop-blur-md">
                  <RotateCcw className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide">Liberar Mesa {mesaSeleccionada?.numero}</h3>
                <p className="text-white/90 text-xs mt-1 font-medium">{mesaSeleccionada?.ubicacion}</p>
              </div>

              {/* Contenido / Advertencia */}
              <div className="p-6 space-y-4 bg-amber-50/50">
                <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Estado actual:</span>
                    <span className="text-amber-700 font-black">Cuenta Abierta</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Total acumulado:</span>
                    <span className="font-mono font-black text-slate-900">${formatoMXN(cuentaActual?.total_acumulado || 0)}</span>
                  </div>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-red-900 text-xs space-y-1">
                  <p className="font-black uppercase tracking-wider">Atencion, mesero:</p>
                  <p className="leading-relaxed">
                    Esta accion <strong>cancelara la cuenta actual</strong>, descartara cualquier consumo no cobrado y pondra la mesa en estado <strong>LIBRE</strong>. No se registrara venta y esta accion no se puede deshacer.
                  </p>
                </div>
              </div>

              {/* Footer de Acciones */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowLiberarModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                onClick={async () => {
                    setNumeroMesaLiberada(mesaSeleccionada?.numero ?? null);
                    setShowLiberarModal(false);
                    const ok = await liberarMesa();
                    if (ok) setShowLiberarSuccessModal(true);
                }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-sm shadow-lg shadow-red-600/30 transition-all"
                >
                  Si, Liberar Mesa
                </button>
              </div>
            </motion.div>
          </div>
          )}
      </AnimatePresence>

      {/* Modal de Éxito al Liberar Mesa */}
      <AnimatePresence>
        {showLiberarSuccessModal && (
          <div id="liberar-mesa-success-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, type: 'spring', stiffness: 320, damping: 26 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-emerald-500/30 text-slate-800"
            >
              {/* Header de Éxito */}
              <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 px-6 py-6 text-center relative text-white">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-md backdrop-blur-md">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide">Mesa Liberada</h3>
                <p className="text-white/90 text-xs mt-1 font-medium">Mesa {numeroMesaLiberada ?? '—'}</p>
              </div>

              {/* Contenido de Confirmación */}
              <div className="p-6 space-y-4 bg-emerald-50/50 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-slate-800 font-medium text-sm leading-relaxed">
                  La mesa <strong>{numeroMesaLiberada ?? '—'}</strong> ha quedado en estado <strong>LIBRE</strong> y se encuentra disponible para atender a nuevos clientes.
                </p>
                <p className="text-slate-500 text-xs">
                  No se registró ningún cobro. Los datos de la cuenta y el carro han sido eliminados correctamente.
                </p>
              </div>

              {/* Footer de Acción */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
                <button
                  onClick={() => setShowLiberarSuccessModal(false)}
                  className="py-2.5 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition-all"
                >
                Aceptar
              </button>
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>

        {cobroExitosoModal}
      </div>
    );
  };

// ===== Modal de división por comensal (asiento) =====
interface SeatSplitModalProps {
  isOpen: boolean;
  cuentaActual: any;
  minicomandas: any[];
  historialData: { mesa: any; minicomandas: any[]; items: any[] } | null;
  cuentasAbiertas: any[];
  onClose: () => void;
  onMoverItem: (itemId: number, nuevaCuentaId: number) => Promise<void>;
  onDividirPorAsiento: (numComensales: number) => Promise<void>;
  onSeleccionarCuenta: (index: number) => Promise<void>;
}

const SeatSplitModal: React.FC<SeatSplitModalProps> = ({
  cuentaActual,
  minicomandas,
  historialData,
  cuentasAbiertas,
  onClose,
  onMoverItem,
  onDividirPorAsiento,
  onSeleccionarCuenta
}) => {
  // Agrupar items por asiento
  const itemsDeLaCuenta = (historialData?.items || []).filter((it: any) =>
    minicomandas.some((m: any) => m.id === it.minicomanda_id && m.cuenta_id === cuentaActual?.id)
  );

  const porAsiento = new Map<number, any[]>();
  for (const it of itemsDeLaCuenta) {
    const seat = it.seat_number || 1;
    if (!porAsiento.has(seat)) porAsiento.set(seat, []);
    porAsiento.get(seat)!.push(it);
  }
  const asientos = Array.from(porAsiento.keys()).sort((a, b) => a - b);

  const subtotalAsiento = (seat: number) =>
    (porAsiento.get(seat) || []).reduce((s: number, it: any) => s + it.total_item, 0);

  const [itemSeleccionado, setItemSeleccionado] = useState<number | null>(null);
  const [cuentaDestino, setCuentaDestino] = useState<number | null>(null);

  const handleMover = async () => {
    if (itemSeleccionado == null || cuentaDestino == null) {
      alert('Selecciona un ítem y la cuenta destino');
      return;
    }
    await onMoverItem(itemSeleccionado, cuentaDestino);
    setItemSeleccionado(null);
    setCuentaDestino(null);
  };

  const obtenerNombreAsiento = (seat: number): string =>
    cuentaActual?.seat_config?.[String(seat)]?.nombre?.trim() || `C.${seat}`;

  return (
    <div id="seat-split-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-brand-gold/20"
      >
        <div className="bg-gradient-to-r from-brand-green-dark to-brand-green px-6 py-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black text-brand-gold uppercase tracking-wide">Dividir por Comensal</h2>
          <p className="text-white/70 text-sm mt-1">Asigna cada plato a su comensal y divide la cuenta</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {asientos.length === 0 ? (
            <div className="py-12 text-center text-brand-warm-gray/40">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">No hay platos para dividir</p>
            </div>
          ) : (
            asientos.map(seat => (
              <div key={seat} className="bg-brand-crema-dark/10 rounded-xl p-4 border border-brand-gold/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-brand-gold text-brand-green-dark text-sm font-black px-3 py-1 rounded uppercase tracking-wide">
                    {obtenerNombreAsiento(seat)}
                  </span>
                  <span className="text-base font-black text-brand-green-dark font-mono">
                    ${formatoMXN(subtotalAsiento(seat))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {porAsiento.get(seat)!.map((it: any) => (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${itemSeleccionado === it.id
                        ? 'bg-brand-gold/20 border-brand-gold'
                        : 'bg-white/60 border-brand-crema-dark/15'
                        }`}
                    >
                      <button
                        onClick={() => setItemSeleccionado(it.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="text-sm font-bold text-brand-green-dark">
                          {it.cantidad}x {it.producto_id}
                        </span>
                        {it.notas && (
                          <p className="text-xs italic text-brand-warm-gray/60 truncate">Nota: {it.notas}</p>
                        )}
                      </button>
                      <span className="text-sm font-black text-brand-green-dark font-mono ml-2">
                        ${formatoMXN(it.total_item)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel de mover ítem + dividir por consumo */}
        <div className="px-6 py-4 border-t border-brand-gold/10 bg-brand-crema-dark/5 space-y-3">
          {/* Mover ítem individual */}
          {itemSeleccionado != null && (
            <div className="space-y-2">
              <p className="text-sm font-bold uppercase text-brand-warm-gray/60 tracking-wider">Mover ítem seleccionado a:</p>
              <div className="flex items-center gap-2 flex-wrap">
                {cuentasAbiertas.map((cuenta, idx) => (
                  <button
                    key={cuenta.id}
                    onClick={() => setCuentaDestino(cuenta.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${cuentaDestino === cuenta.id
                      ? 'bg-brand-gold text-brand-green-dark border-brand-gold shadow-lg'
                      : 'bg-white text-brand-green-dark border-brand-gold/20 hover:bg-brand-crema'
                      }`}
                  >
                    {cuenta.id === cuentaActual?.id ? 'Cuenta actual' : `Cuenta ${idx + 1}`}
                  </button>
                ))}
              </div>
              <button
                onClick={handleMover}
                disabled={cuentaDestino == null}
                className={`w-full py-3 rounded-xl text-base font-bold transition-all ${cuentaDestino == null
                  ? 'bg-brand-crema-dark/50 text-brand-warm-gray/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark shadow-lg active:scale-[0.98]'
                  }`}
              >
                Mover Ítem
              </button>
            </div>
          )}

          <div className="border-t border-brand-gold/10 pt-3">
            <button
              onClick={async () => {
                await onDividirPorAsiento(asientos.length);
                onClose();
              }}
              className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-brand-crema font-black py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Layers className="w-5 h-5" />
              Generar Cuenta por Comensal
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface ProductDetailModalWaiterProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, notes: string, options: any[], extras: { nombre: string; precio: number }[]) => void;
}

const ProductDetailModalWaiter: React.FC<ProductDetailModalWaiterProps> = ({ product, isOpen, onClose, onAdd }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [selectedChoices, setSelectedChoices] = useState<{ [optionName: string]: { choiceName: string; extraPrice: number } }>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedExtras, setSelectedSelectedExtras] = useState<{ nombre: string; precio: number }[]>([]);
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraPrice, setCustomExtraPrice] = useState('');

  // Load extras from Supabase
  useEffect(() => {
    const loadExtras = async () => {
      try {
        const data = await obtenerTodosLosExtras();
        setExtras(data || []);
      } catch (error) {
        console.error('Error loading extras:', error);
      }
    };
    loadExtras();
  }, []);

  // Inicializar con opciones requeridas por defecto
  useEffect(() => {
    if (!product) return;
    const defaults: { [optionName: string]: { choiceName: string; extraPrice: number } } = {};
    if (product.options) {
      product.options.forEach(opt => {
        if (opt.required && opt.choices.length > 0) {
          defaults[opt.name] = {
            choiceName: opt.choices[0].name,
            extraPrice: opt.choices[0].extraPrice
          };
        }
      });
    }
    setSelectedChoices(defaults);
    setQuantity(1);
    setNotes('');
    setSelectedSelectedExtras([]);
    setCustomExtraName('');
    setCustomExtraPrice('');
  }, [product]);

  const handleChoiceSelect = (optionName: string, choiceName: string, extraPrice: number) => {
    setSelectedChoices(prev => ({
      ...prev,
      [optionName]: { choiceName, extraPrice }
    }));
  };

  const calculateItemPrice = () => {
    if (!product) return 0;
    let price = product.price;
    Object.values(selectedChoices).forEach((choice: any) => {
      price += choice.extraPrice;
    });
    const extrasTotal = selectedExtras.reduce((sum, extra) => sum + extra.precio, 0);
    price += extrasTotal;
    return price;
  };

  const singlePrice = calculateItemPrice();
  const totalCost = singlePrice * quantity;

  const handleAdd = () => {
    console.log('[DEBUG handleAdd] product:', product.name, '| selectedChoices:', selectedChoices);
    const optionsArray: any[] = Object.entries(selectedChoices).map(([optName, val]: [string, any]) => ({
      optionName: optName,
      choiceName: val.choiceName,
      extraPrice: val.extraPrice
    }));
    const extrasText = selectedExtras.map(e => `${e.nombre} +$${formatoMXN(e.precio)}`).join(', ');
    const notesWithExtras = extrasText ? `${notes}${notes ? ' | ' : ''}Extras: ${extrasText}` : notes;
    console.log('[DEBUG handleAdd] optionsArray:', optionsArray, '| notesWithExtras:', notesWithExtras);
    onAdd(product, quantity, notesWithExtras, optionsArray, selectedExtras);
  };

  // Quick notes for waiters
  const QUICK_NOTES = ['Sin cebolla', 'Bien frito', 'Salsa aparte', 'Sin picante', 'Término medio', 'Bien caliente', 'Para compartir'];

  const appendQuickNote = (chip: string) => {
    const tokens = notes ? notes.split(',').map(t => t.trim()).filter(Boolean) : [];
    const idx = tokens.indexOf(chip);
    if (idx >= 0) {
      tokens.splice(idx, 1);
    } else {
      tokens.push(chip);
    }
    setNotes(tokens.join(', '));
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      variant="slideUp"
      overlayClass="items-end sm:items-center p-0 sm:p-4"
      cardClass="relative bg-brand-crema-light w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto flex flex-col shadow-2xl"
    >
      {() => (
        <>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Image */}
        <div className="relative h-64 sm:h-56 bg-brand-green-dark overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-brand-crema p-6 text-center bg-gradient-to-br from-brand-green-dark to-brand-green">
              <span className="text-5xl mb-2">🍽️</span>
              <span className="font-display italic text-lg">{product.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark/90 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span className="bg-brand-gold text-brand-green-dark text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              {product.category}
            </span>
            <h2 className="text-2xl font-display font-bold tracking-tight mt-2">
              {product.name}
            </h2>
          </div>
        </div>

        {/* Product Details & Modifiers */}
        <div className="p-5 flex-1 space-y-5">
          {product.description && (
            <p className="text-brand-warm-gray text-sm leading-relaxed font-display italic text-base">
              {product.description}
            </p>
          )}

          {/* Price Tag */}
          <div className="flex items-center justify-between border-b border-brand-crema-dark/20 pb-4">
            <span className="text-sm text-brand-warm-gray font-medium">Precio Unitario</span>
            <span className="text-2xl font-bold text-brand-green-dark font-mono">
              ${formatoMXN(singlePrice)}
            </span>
          </div>

          {/* Modifiers */}
          {product.options && product.options.map((option) => (
            <div key={option.name} className="space-y-2.5">
              <div className="flex justify-between items-baseline">
                <h4 className="text-sm font-display font-bold text-brand-green-dark">
                  {option.name}
                </h4>
                {option.required && (
                  <span className="text-[9px] bg-brand-gold/15 text-brand-gold-dark font-bold px-2 py-0.5 rounded-full tracking-wider">
                    REQUERIDO
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {option.choices.map((choice) => {
                  const isSelected = selectedChoices[option.name]?.choiceName === choice.name;
                  return (
                    <button
                      key={choice.name}
                      onClick={() => handleChoiceSelect(option.name, choice.name, choice.extraPrice)}
                      className={`p-3 rounded-lg text-left border-2 transition-all duration-200 flex flex-col ${isSelected
                        ? 'border-brand-gold bg-brand-gold/8 text-brand-green-dark shadow-sm'
                        : 'border-brand-crema-dark/20 hover:border-brand-gold/30 text-brand-warm-gray bg-white'
                        }`}
                    >
                      <span className="text-xs font-semibold">{choice.name}</span>
                      {choice.extraPrice > 0 && (
                        <span className="text-[10px] mt-1 font-mono text-brand-gold-dark">
                          +${formatoMXN(choice.extraPrice)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Notes */}
          <div className="space-y-2">
            <label className="text-sm font-display font-bold text-brand-green-dark block">
              Notas rápidas
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_NOTES.map(chip => {
                const activa = notes.split(',').map(t => t.trim()).includes(chip);
                return (
                  <button
                    key={chip}
                    onClick={() => appendQuickNote(chip)}
                    className={`text-xs sm:text-sm shrink-0 px-3 py-1.5 rounded-full transition-all font-semibold ${
                      activa
                        ? 'bg-brand-gold text-brand-green-dark border border-brand-gold shadow-sm font-bold'
                        : 'bg-brand-crema hover:bg-brand-crema-dark border border-brand-crema-dark/15 hover:border-brand-gold/25 text-brand-warm-gray'
                    }`}
                  >
                    {activa ? '' : '+'}{chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extras */}
          <div className="space-y-3">
            <label className="text-sm font-display font-bold text-brand-green-dark block">
              Extras (+$25 cada uno)
            </label>
            <div className="flex flex-wrap gap-2">
              {extras.map(extra => (
                <button
                  key={extra.id}
                  onClick={() => {
                    const exists = selectedExtras.find(e => e.nombre === extra.nombre);
                    if (exists) {
                      setSelectedSelectedExtras(selectedExtras.filter(e => e.nombre !== extra.nombre));
                    } else {
                      setSelectedSelectedExtras([...selectedExtras, { nombre: extra.nombre, precio: extra.precio }]);
                    }
                  }}
                  className={`text-xs sm:text-sm shrink-0 px-3 py-1.5 rounded-full transition-all font-semibold ${
                    selectedExtras.some(e => e.nombre === extra.nombre)
                      ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                      : 'bg-brand-crema hover:bg-brand-crema-dark border border-brand-crema-dark/15 hover:border-pink-500/25 text-brand-warm-gray'
                  }`}
                >
                  +{extra.nombre} +${formatoMXN(extra.precio)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Extra */}
          <div className="space-y-2">
            <label className="text-sm font-display font-bold text-brand-green-dark block">
              Extra personalizado
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customExtraName}
                onChange={(e) => setCustomExtraName(e.target.value)}
                placeholder="Nombre del extra"
                className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-brand-crema-dark/20 bg-white focus:ring-1 focus:ring-pink-400 focus:border-pink-400 outline-hidden"
              />
              <input
                type="text"
                inputMode="numeric"
                value={customExtraPrice}
                onChange={(e) => setCustomExtraPrice(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="$"
                className="w-16 text-sm px-2 py-2 rounded-lg border border-brand-crema-dark/20 bg-white focus:ring-1 focus:ring-pink-400 focus:border-pink-400 outline-hidden text-center"
              />
              <button
                onClick={() => {
                  const price = Number(customExtraPrice);
                  if (customExtraName && price > 0) {
                    const newExtra = { nombre: customExtraName, precio: price };
                    setSelectedSelectedExtras([...selectedExtras, newExtra]);
                    setCustomExtraName('');
                    setCustomExtraPrice('');
                  }
                }}
                className="shrink-0 px-3 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors"
              >
                +
              </button>
            </div>
            {selectedExtras.filter(e => !extras.some(pe => pe.nombre === e.nombre)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {selectedExtras.filter(e => !extras.some(pe => pe.nombre === e.nombre)).map((extra, idx) => (
                  <span
                    key={`${extra.nombre}-${idx}`}
                    className="text-[10px] bg-pink-500/10 text-pink-600 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    {extra.nombre} +${formatoMXN(extra.precio)}
                    <button
                      onClick={() => setSelectedSelectedExtras(selectedExtras.filter(e => !(e.nombre === extra.nombre && e.precio === extra.precio)))}
                      className="hover:text-pink-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <label className="text-sm font-display font-bold text-brand-green-dark block">
              Instrucciones especiales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Sin cebolla, bien tostado, etc."
              rows={3}
              className="w-full text-sm p-3 rounded-lg border border-brand-crema-dark/20 bg-white focus:ring-1 focus:ring-brand-gold/40 focus:border-brand-gold/40 outline-hidden resize-none transition-colors"
            />
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between border-t border-brand-crema-dark/20 pt-4">
            <span className="text-sm font-display font-bold text-brand-green-dark">Cantidad</span>
            <div className="flex items-center gap-4 bg-white border border-brand-crema-dark/20 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-brand-crema text-brand-warm-gray transition-colors"
                disabled={quantity <= 1}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="w-8 text-center font-mono font-bold text-brand-green-dark text-xl">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-brand-crema text-brand-warm-gray transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="bg-white border-t border-brand-crema-dark/15 p-4 flex gap-4 items-center sm:rounded-b-2xl shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] text-brand-warm-gray font-bold uppercase tracking-wider">Total</span>
            <span className="text-xl font-black text-brand-green-dark font-mono">
              ${formatoMXN(totalCost)}
            </span>
          </div>

          <button
            onClick={handleAdd}
            className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-3.5 px-6 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 btn-glow"
          >
            <Plus className="w-4 h-4" />
            <span className="font-display">Agregar a Comanda</span>
          </button>
        </div>

        </>
      )}
    </ModalWrapper>
  );
};

// ===================== MODAL COMPARTIR ÍTEM =====================
interface ShareItemModalProps {
  item: CarroItem;
  unitPrice: number;
  onClose: () => void;
  onConfirm: (itemId: string, sharedWith: { seat: number; porcentaje: number; monto: number }[]) => void;
}

const ShareItemModal: React.FC<ShareItemModalProps> = ({ item, unitPrice, onClose, onConfirm }) => {
  const asientosDisponibles = Array.from({ length: 15 }, (_, i) => i + 1);

  // Inicializar selección desde sharedWith existente o comensal activo por defecto
  const [seleccionados, setSeleccionados] = useState<number[]>(() => {
    if (item.sharedWith && item.sharedWith.length > 0) {
      return item.sharedWith.map(s => s.seat);
    }
    return item.seatNumber ? [item.seatNumber] : [1];
  });
  const [porcentajes, setPorcentajes] = useState<Record<number, number>>(() => {
    const inicial: Record<number, number> = {};
    if (item.sharedWith && item.sharedWith.length > 0) {
      item.sharedWith.forEach(s => { inicial[s.seat] = s.porcentaje; });
    } else {
      const seat = item.seatNumber || 1;
      inicial[seat] = 100;
    }
    return inicial;
  });

  const toggleSeat = (seat: number) => {
    setSeleccionados(prev => {
      if (prev.includes(seat)) {
        const next = prev.filter(s => s !== seat);
        if (next.length === 0) return prev; // al menos 1
        return next;
      }
      const next = [...prev, seat];
      // Reparto igualitario automático al agregar
      const pct = Number((100 / next.length).toFixed(2));
      const nuevoPct: Record<number, number> = {};
      next.forEach(s => { nuevoPct[s] = pct; });
      setPorcentajes(nuevoPct);
      return next;
    });
  };

  const cambiarPorcentaje = (seat: number, valor: string) => {
    const num = Number(valor);
    if (isNaN(num) || num < 0 || num > 100) return;
    setPorcentajes(prev => ({ ...prev, [seat]: num }));
  };

  const totalPct = seleccionados.reduce((s, seat) => s + (porcentajes[seat] || 0), 0);
  const esValido = seleccionados.length >= 2 && Math.abs(totalPct - 100) < 0.01;
  const montoTotal = unitPrice * item.quantity;

  const confirmar = () => {
    if (!esValido) {
      alert('Selecciona al menos 2 comensales y asegura que la suma de porcentajes sea 100%.');
      return;
    }
    const sharedWith = seleccionados.map(seat => ({
      seat,
      porcentaje: porcentajes[seat],
      monto: Number(((montoTotal * porcentajes[seat]) / 100).toFixed(2))
    }));
    onConfirm(item.id, sharedWith);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-purple-300"
      >
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-5 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-xl p-2">
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 mx-auto bg-white rounded-2xl flex items-center justify-center mb-2">
            <Users className="w-6 h-6 text-purple-700" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-wide">Compartir Ítem</h2>
          <p className="text-white/80 text-xs mt-1">{item.product.name} · ${formatoMXN(montoTotal)} total</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs font-bold uppercase text-brand-warm-gray/60 tracking-wider">Comensales que comparten:</p>
          <div className="grid grid-cols-3 gap-2">
            {asientosDisponibles.map(seat => {
              const activo = seleccionados.includes(seat);
              return (
                <button
                  key={seat}
                  onClick={() => toggleSeat(seat)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${activo
                    ? 'bg-purple-600 text-white border-purple-600 shadow'
                    : 'bg-white text-brand-green-dark border-brand-gold/20 hover:bg-brand-crema'
                    }`}
                >
                  C.°{seat}
                </button>
              );
            })}
          </div>

          {seleccionados.length >= 2 && (
            <div className="space-y-2 pt-2">
              <div className="border-t border-brand-gold/10 pt-3 space-y-2">
                {seleccionados.map(seat => (
                  <div key={seat} className="flex items-center gap-2">
                    <span className="w-12 font-bold text-sm text-brand-green-dark">C.°{seat}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={porcentajes[seat] ?? 0}
                      onChange={(e) => cambiarPorcentaje(seat, e.target.value)}
                      className="w-20 bg-white border-2 border-brand-gold/30 rounded-lg py-1.5 px-2 text-center font-bold text-brand-green-dark focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-sm text-brand-warm-gray">%</span>
                    <span className="flex-1 text-right font-mono font-bold text-brand-green-dark text-sm">
                      ${formatoMXN((montoTotal * (porcentajes[seat] || 0)) / 100)}
                    </span>
                  </div>
                ))}
              </div>
              <div className={`text-center text-xs font-bold ${Math.abs(totalPct - 100) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalPct === 100 ? '✓ Reparto completo (100%)' : `Suma: ${totalPct}% — debe ser 100%`}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 bg-brand-crema-dark/5">
          <button
            onClick={confirmar}
            disabled={!esValido}
            className={`w-full font-black py-4 rounded-2xl shadow-lg transition-all text-lg ${esValido
              ? 'bg-gradient-to-r from-purple-700 to-purple-500 text-white hover:from-purple-600'
              : 'bg-brand-crema-dark/50 text-brand-warm-gray/50 cursor-not-allowed'
              }`}
          >
            Confirmar Reparto
          </button>
        </div>
      </motion.div>
    </div>
  );
};
