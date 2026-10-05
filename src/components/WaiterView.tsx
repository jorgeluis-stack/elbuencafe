// src/components/WaiterView.tsx - Vista del mesero con IndexedDB (Fase 1)
// Implementa: abrir cuenta → agregar productos → enviar a cocina → cobrar → liberar mesa

import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, CATEGORY_ACCENTS } from '../data/menu';
import { Product, CategoryId, CartItemOption, CarroItem, Extra } from '../types';
import { useDeviceType } from '../hooks/useDeviceType';
import { useProductos } from '../hooks/useProductos';
import {
  Plus,
  Minus,
  Trash2,
  Send,
  MoreVertical,
  User,
  Layers,
  MessageSquare,
  Sparkles,
  ClipboardList,
  CheckCircle,
  DoorOpen,
  History,
  Receipt,
  LogOut,
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
   ChevronLeft,
   AlertTriangle,
   ChefHat,
   ShoppingCart,
   Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAccount } from '../context/AccountContext';
import type { CobroResultado } from '../context/AccountContext';
import { Mesa, Minicomanda, EstadoMesa, ItemMinicomanda } from '../types';
import { imprimirTicket } from '../utils/printer';
import { obtenerItemsPorMinicomanda, obtenerMinicomandasPorCuenta, actualizarSeatConfig, obtenerCuentaPorId, obtenerTodosLosExtras, obtenerOpcionesPorItem, obtenerExtrasPorItem, obtenerSharesPorItem } from '../db/SupabaseQueries';
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
    compartirItemIndividual,
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
  // Ítem pendiente en edición (reutiliza ProductDetailModalWaiter en modo edición).
  // null = modo agregar. No se crea un segundo modal.
  const [editingItem, setEditingItem] = useState<CarroItem | null>(null);
  // Estado del menú ⋮ (desktop: píldora mesero del header global; mobile: barra secundaria)
  const [showMenuMesa, setShowMenuMesa] = useState(false);
  const [menuProductoAbierto, setMenuProductoAbierto] = useState<string | null>(null);
  const [envioEstado, setEnvioEstado] = useState<'idle' | 'exito' | 'error'>('idle');
  const [liberandoMesa, setLiberandoMesa] = useState(false);
  // Colapsado visual de la sección "Enviado a cocina" (desktop y mobile comparten estado).
  // Solo UI: no altera carroLocal, itemsDeCocina ni ninguna lógica de negocio.
  const [colapsadoEnviados, setColapsadoEnviados] = useState(true);
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
  // C9.12 Fase 1.5: idempotencia por OPERACION de cobro (no por invocacion).
  // La key se genera UNA vez por operacion del usuario y se reutiliza en
  // reintentos manuales (incluido retry tras timeout). Reset solo en exito
  // terminal (COBRADO/YA_PROCESADO) o cancelacion explicita del modal.
  const cobroKeyRef = React.useRef<string | null>(null);
  // Guard in-flight: evita doble RPC por doble clic. No confundir con
  // enviandoACocina (flujo de envio a cocina, independiente).
  const cobroEnVueloRef = React.useRef(false);
  const [cobrandoAsientos, setCobrandoAsientos] = useState(false);
  // Error del ultimo intento de cobro (null = sin error). Con error, el modal
  // de checkout permanece abierto para permitir reintento con la misma key.
  const [cobroError, setCobroError] = useState<string | null>(null);
  // Modal para compartir un ítem del carro
  const [shareItem, setShareItem] = useState<CarroItem | null>(null);
  // Ítem de BD (historial) a compartir durante el checkout (individual -> compartido)
  const [shareCheckoutItem, setShareCheckoutItem] = useState<any | null>(null);

  // Edición de nombre de comensal (Fase 2)
  // A = identidad seat (number), B = nombre personalizado (seat_config), C = fallback visual C.{seat}
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  // Escape = cancelar sin guardar: evita que el desmontaje dispare onBlur→guardarNombreAsiento
  const cancelandoEdicionRef = React.useRef(false);
  // Nombre del mesero actual para el modal de reemplazo
  const [nombreMeseroActual, setNombreMeseroActual] = useState<string>('');

  // Diálogo de confirmación al enviar a cocina
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [envioData, setEnvioData] = useState<{ items: CarroItem[]; total: number } | null>(null);

  // Detección de dispositivo (solo para móvil)
  const deviceType = useDeviceType();
  const isMobile = deviceType === 'mobile';
  // Píldora mesero+⋮ del header global (App) alterna este menú vía evento. Mismo menú mobile/desktop.
  useEffect(() => {
    const alternar = () => setShowMenuMesa(prev => !prev);
    window.addEventListener('toggle_mesa_menu', alternar);
    // Cerrar menús con Escape (solo UI)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenuMesa(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('toggle_mesa_menu', alternar); window.removeEventListener('keydown', onKey); };
  }, []);
  // Sheet de comanda en móvil (abre desde bottom bar)
  const [showMobileSheet, setShowMobileSheet] = useState(false);

  // Catálogo vivo desde Supabase (fallback localStorage) — se actualiza con Realtime
  const { productos } = useProductos();

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
    const asientosEnCarro = carroLocal.flatMap(it => {
      if (it.seatNumber !== null && it.seatNumber !== undefined) return [it.seatNumber];
      return (it.sharedWith ?? []).map(s => s.seat);
    });
    const asientosEnCocina = itemsDeCocina.map(it => it.seat_number || 1);
    const todos = new Set<number>([1, ...asientosEnCuenta, ...asientosEnCarro, ...asientosEnCocina]);
    setAsientosDeCocina(Array.from(todos).sort((a, b) => a - b));
  }, [mesaSeleccionada?.id, cuentaActual, carroLocal, itemsDeCocina]);

  // Si el admin accedió directamente, mostrar la vista de selección de mesa
  const isAdminAccess = meseroLogueado && meseroLogueado.id === 0;

  // Filtrar productos por categoría y búsqueda
  const filteredProducts = productos.filter(product => {
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

  // Envío a cocina reutilizando la lógica existente; UI-only estados visuales (idle/exito/error)
  const handleEnviarACocina = async () => {
    if (enviandoACocina) return;
    if (envioEstado === 'error') setEnvioEstado('idle');
    const result = await enviarACocina();
    if (result.ok && result.items) { setEnvioEstado('exito'); setEnvioData({ items: result.items, total: result.total || 0 }); setShowEnvioModal(true);
      window.setTimeout(() => setEnvioEstado(prev => (prev === 'exito' ? 'idle' : prev)), 2500);
    } else if (!result.ok && result.error) setEnvioEstado('error');
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
    // Validación UI (no cambia la lógica de negocio): nunca cobrar con
    // información incompleta de compartidos.
    if (sharesEnCarga) {
      alert('Las participaciones de ítems compartidos aún se están cargando. Espera un momento e intenta de nuevo.');
      return;
    }
    if (compartidosHuerfanos.length > 0) {
      alert('Hay ítems compartidos sin participación registrada ("Participación no disponible"). No se puede cobrar.');
      return;
    }
    const totalACobrar = obtenerTotalSeleccionado();

    const pago = parseFloat(montoRecibido);
    if (isNaN(pago) || pago < totalACobrar) {
      alert('El pago debe ser mayor o igual al total');
      return;
    }

    const cambio = pago - totalACobrar;
    const seats = comensalesSeleccionados.length > 0 ? comensalesSeleccionados : asientosUnicos();

    // Cobro directo: cada share impago de los asientos seleccionados lo liquida
    // cobrarAsientos (marca pagado sin borrar el ítem). Sin diálogos intermedios:
    // cobrar mi parte = cobrar mi parte.
    await ejecutarCobro(seats, pago, cambio, checkoutPaymentMethod, referenciaPago || undefined);
  };

  // Ejecuta el cobro directo (sin cola de resolución heredada).
  // C9.12 Fase 1.5: la idempotency_key vive en cobroKeyRef (una por operacion).
  // Solo se resetea en exito terminal o cancelacion explicita; en error/null se
  // PRESERVA para que el reintento manual reuse la misma key (M5).
  const ejecutarCobro = async (
    seats: number[],
    pago: number,
    cambio: number,
    metodo: 'efectivo' | 'electronico',
    referencia?: string
  ) => {
    if (cobroEnVueloRef.current) return;
    if (!cobroKeyRef.current) cobroKeyRef.current = crypto.randomUUID();
    const key = cobroKeyRef.current;
    cobroEnVueloRef.current = true;
    setCobrandoAsientos(true);
    setCobroError(null);
    try {
      const resultado = await cobrarAsientos(seats, pago, cambio, metodo, referencia, key);
      if (resultado) {
        // Exito terminal (COBRADO o YA_PROCESADO): reset de key y cierre.
        cobroKeyRef.current = null;
        setCobroError(null);
        setShowCheckoutModal(false);
        setShowHistorial(false);
        setHistorialData(null);
        setComensalesSeleccionados([]);
        setCobroSuccess(resultado);
      } else {
        // null (error recuperable/timeout/red o SIN_CAMBIOS): modal ABIERTO con
        // mensaje para reintento manual con la MISMA key. No hay falsa senal de exito.
        setCobroError('No se pudo confirmar el cobro. Si el cargo sí se aplicó, reintentar con el botón Cobrar lo confirma sin duplicar el cargo.');
      }
    } finally {
      cobroEnVueloRef.current = false;
      setCobrandoAsientos(false);
    }
  };

  // Cancelacion explicita del checkout: resetea key y error, cierra el modal.
  const cancelarCobro = () => {
    cobroKeyRef.current = null;
    setCobroError(null);
    setShowCheckoutModal(false);
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
          // Por defecto, todos los comensales seleccionados para cobrar.
          // Solo asientos normales: los compartidos (seat_number === null) se
          // resuelven vía shares al cargar; atribuirlos a C.1 reproduciría el
          // bug del total_item completo. Vacío = todos (ver obtenerTotalSeleccionado).
          const seats = Array.from(new Set(itemsFiltrados.flatMap((it: any) => (it.seat_number !== null && it.seat_number !== undefined) ? [it.seat_number || 1] : []))) as number[];
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

  // Shares de ítems compartidos ya enviados (item_comensal_share), por item_id.
  // Solo lectura para representar share.monto en la pantalla de cobro.
  // El cobro real (cobrarAsientos) no se modifica.
  const [sharesPorItem, setSharesPorItem] = useState<Record<number, { seat_number: number; porcentaje: number; monto: number; pagado: boolean }[]>>({});
  // Bandera de carga de shares: mientras sea true (o falte la clave de un
  // compartido en sharesPorItem) la UI de cobro muestra "Cargando..." y
  // bloquea el cobro en lugar de usar total_item como sustituto.
  const [sharesCargando, setSharesCargando] = useState(false);

  // Cargar shares cuando cambia el historial (pantalla de cobro).
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      const items = historialData?.items || [];
      const compartidos = items.filter((it: any) => it.seat_number === null);
      if (compartidos.length === 0) {
        if (!cancelado) { setSharesPorItem({}); setSharesCargando(false); }
        return;
      }
      if (!cancelado) setSharesCargando(true);
      const mapa: Record<number, { seat_number: number; porcentaje: number; monto: number; pagado: boolean }[]> = {};
      await Promise.all(compartidos.map(async (it: any) => {
        try {
          const rows = await obtenerSharesPorItem(it.id);
          mapa[it.id] = (rows || []).map((s: any) => ({
            seat_number: s.seat_number,
            porcentaje: Number(s.porcentaje),
            monto: Number(s.monto),
            pagado: Boolean(s.pagado),
          }));
        } catch {
          // Error de lectura: clave presente pero vacía → el ítem queda como
          // "huérfano" (participación no disponible) y bloquea el cobro.
          // Nunca se usa total_item como sustituto.
          mapa[it.id] = [];
        }
      }));
      if (!cancelado) { setSharesPorItem(mapa); setSharesCargando(false); }
    };
    cargar();
    return () => { cancelado = true; };
  }, [historialData]);

  // Share de un ítem BD para un asiento (solo compartidos seat_number === null).
  const shareDeBD = (it: any, seat: number) =>
    it?.seat_number === null
      ? (sharesPorItem[it.id] || []).find((s: any) => s.seat_number === seat)
      : undefined;

  // ¿Siguen cargándose shares de algún compartido del historial?
  // Clave ausente en sharesPorItem = aún sin resolver para ese ítem.
  const sharesEnCarga = sharesCargando || ((historialData?.items || []).some((it: any) => it.seat_number === null && !(it.id in sharesPorItem)));

  // Compartidos huérfanos: carga terminada pero sin filas de reparto
  // (ningún comensal tiene share). No se puede preciar a nadie con
  // total_item: se muestra "Participación no disponible" y se bloquea el cobro.
  const compartidosHuerfanos: any[] = (historialData?.items || []).filter((it: any) => it.seat_number === null && (it.id in sharesPorItem) && (sharesPorItem[it.id] || []).length === 0);

  // Bloqueo de cobro por información incompleta de compartidos.
  const cobroBloqueadoPorShares = sharesEnCarga || compartidosHuerfanos.length > 0;

  // Ítems BD visibles para un comensal en cobro: normales por igualdad;
  // compartidos EXCLUSIVAMENTE por participación en shares (sin fallback legacy).
  const itemsDeBDDelComensal = (seat: number): any[] => {
    if (!historialData) return [];
    return (historialData.items || []).filter((it: any) => {
      if (it.seat_number !== null && it.seat_number !== undefined) return (it.seat_number || 1) === seat;
      const shares = sharesPorItem[it.id];
      // Sin clave = shares aún cargando: NO atribuir a ningún comensal
      // (el cobro se bloquea mientras sharesEnCarga sea true).
      if (shares === undefined) return false;
      return shares.some((s: any) => s.seat_number === seat);
    });
  };

  // Asientos (comensales) únicos presentes en la cuenta actual.
  // Participantes de compartidos vía shares (sin fallback legacy a C.1).
  // Un asiento liquidado (solo shares pagadas y sin normales) no se lista:
  // su responsabilidad ya no es cobrable.
  const asientosUnicos = (): number[] => {
    if (!historialData) return [];
    const todos = new Set<number>();
    const impagos = new Set<number>();
    (historialData.items || []).forEach((it: any) => {
      if (it.seat_number !== null && it.seat_number !== undefined) {
        todos.add(it.seat_number || 1);
        return;
      }
      const shares = sharesPorItem[it.id];
      if (shares && shares.length > 0) {
        shares.forEach((s: any) => {
          todos.add(s.seat_number);
          if (!s.pagado) impagos.add(s.seat_number);
        });
      }
      // Sin clave (cargando) o sin filas (huérfano): no atribuir a C.1.
    });
    // Conservar asientos con normales (siempre pendientes: se eliminan al cobrar)
    // o con al menos una participación impaga en algún compartido.
    const normales = new Set<number>();
    (historialData.items || []).forEach((it: any) => {
      if (it.seat_number !== null && it.seat_number !== undefined) normales.add(it.seat_number || 1);
    });
    return Array.from(todos).filter(seat => normales.has(seat) || impagos.has(seat)).sort((a: number, b: number) => a - b);
  };

  // Subtotal de un asiento específico.
  // Normal (seat_number !== null): it.total_item (los normales en historial
  // siempre están pendientes: se eliminan al cobrarse).
  // Compartido (seat_number === null): EXCLUSIVAMENTE la suma de share.monto
  // IMPAGOS del asiento, SIN recalcular. Sin share impago: se suma 0 (NUNCA
  // total_item); ese estado se representa como "Cargando...", "Pagado" o
  // "Participación no disponible" y bloquea el cobro mediante
  // cobroBloqueadoPorShares.
  const calcularSubtotalAsiento = (seat: number): number => {
    if (!historialData) return 0;
    return itemsDeBDDelComensal(seat).reduce((s: number, it: any) => {
      if (it.seat_number === null) {
        const impagas = (sharesPorItem[it.id] || []).filter((sh: any) => sh.seat_number === seat && !sh.pagado);
        return s + impagas.reduce((a: number, sh: any) => a + sh.monto, 0);
      }
      return s + it.total_item;
    }, 0);
  };

  // Total de los asientos seleccionados (o todos si no hay selección)
  const obtenerTotalSeleccionado = (): number => {
    const seleccion = comensalesSeleccionados.length > 0 ? comensalesSeleccionados : asientosUnicos();
    return seleccion.reduce((s, seat) => s + calcularSubtotalAsiento(seat), 0);
  };

  // Comensales REALES para repartir en checkout: claves de seat_config más
  // participantes con items (cubre asientos sin items propios, p. ej. C.5).
  // Deduplicados y ordenados; sin suponer consecutividad.
  const asientosRealesCheckout = (): number[] => {
    const base = cuentaActual?.seat_config ? Object.keys(cuentaActual.seat_config).map(Number) : [];
    return Array.from(new Set<number>([...base, ...asientosUnicos()])).sort((a, b) => a - b);
  };

  // ---- Fase 1: Tabs por comensal ----
  // Visibilidad virtual de pendientes compartidos: 1 entidad (carroLocal),
  // N representaciones visuales (itemsPorAsiento). No duplica CarroItem,
  // no toca envío/cobro. Solo pendientes; enviados (itemsDeCocina) quedan igual.
  const isCarroVisibleForSeat = (item: CarroItem, seat: number): boolean => {
    if (item.seatNumber !== null && item.seatNumber !== undefined) {
      return item.seatNumber === seat;
    }
    const shares = item.sharedWith ?? [];
    if (shares.length === 0) {
      return false;
    }
    return shares.some(share => share.seat === seat);
  };

  // Asientos donde un pendiente es visible (1 para normales, N para compartidos).
  const seatsVisiblesDeCarroItem = (item: CarroItem): number[] => {
    if (item.seatNumber !== null && item.seatNumber !== undefined) {
      return [item.seatNumber];
    }
    const shares = item.sharedWith ?? [];
    if (shares.length === 0) {
      return [];
    }
    return Array.from(new Set(shares.map(s => s.seat)));
  };

  // Items del carro local agrupados por visibilidad (misma referencia del item
  // en cada asiento participante; carroLocal sigue siendo la única fuente).
  const itemsPorAsiento = useMemo(() => {
    const mapa: Record<number, CarroItem[]> = {};
    carroLocal.forEach(item => {
      const seats = seatsVisiblesDeCarroItem(item);
      seats.forEach(seat => {
        if (!mapa[seat]) mapa[seat] = [];
        mapa[seat].push(item);
      });
    });
    return mapa;
  }, [carroLocal]);

  // Asientos activos: base = comensales creados explicitamente,
  // mas los que tienen items visibles (carro o BD) y el activo.
  const asientosActivos = useMemo(() => {
    const seats = new Set<number>(asientosDeCocina);
    // Items del carro local (visibilidad virtual: un compartido activa a cada participante)
    carroLocal.forEach(item => {
      seatsVisiblesDeCarroItem(item).forEach(seat => seats.add(seat));
    });
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
      // REGLA: nombre vacío conserva la identidad -> { nombre: "" }, fallback visual C.{seat}
      const actualLocal = cuentaActual.seat_config || {};
      let nuevoLocal: Record<string, { nombre: string }>;
      if (nombre.trim() === '') {
        nuevoLocal = { ...actualLocal, [String(seat)]: { nombre: '' } };
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
        nuevo = { ...actual, [String(seat)]: { nombre: '' } };
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

  // Crear comensal: memoria + identidad persistente en seat_config (merge, sin pisar otros seats).
  // seat_config["N"] = { nombre: "" } -> existe el seat, fallback visual C.N. Máx 15.
  const agregarComensal = async () => {
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
    if (!cuentaActual) return;
    const cuentaId = cuentaActual.id;
    // Optimista: registrar identidad aunque el nombre esté vacío
    const actualLocal = cuentaActual.seat_config || {};
    if (!(String(nuevo) in actualLocal)) {
      setCuentaActual({ ...cuentaActual, seat_config: { ...actualLocal, [String(nuevo)]: { nombre: '' } } });
    }
    try {
      // Merge contra la cuenta fresca para no sobrescribir otros seats (mismo patrón que guardarNombreAsiento)
      const cuentaFresca = await obtenerCuentaPorId(cuentaId);
      if (!cuentaFresca) return;
      const actual = cuentaFresca.seat_config || {};
      if (!(String(nuevo) in actual)) {
        const merged = { ...actual, [String(nuevo)]: { nombre: '' } };
        const result = await actualizarSeatConfig(cuentaId, merged);
        if (!result.success) return;
        try {
          await recargarEstadoMesa();
        } catch (e) {
          console.error('[DEBUG agregarComensal] error en recargarEstadoMesa:', e);
        }
      }
    } catch (error) {
      console.error('Error al persistir nuevo comensal:', error);
    }
  };

  // Eliminar comensal vacío (sin items en carro ni en BD).
  // Quita el seat de asientosDeCocina y su identidad en seat_config (borrado explícito con ×).
  // No toca seatNumber/seat_number ni lógica de cobro: el llamador ya verifica !tieneItems.
  const eliminarComensalVacio = async (seat: number) => {
    setAsientosDeCocina(prev => prev.filter(s => s !== seat));
    if (comensalActivo === seat) {
      const idx = asientosActivos.indexOf(seat);
      const siguiente = asientosActivos[idx + 1] || asientosActivos[idx - 1] || 1;
      setComensalActivo(siguiente);
    }
    if (!cuentaActual) return;
    const cuentaId = cuentaActual.id;
    const actualLocal = cuentaActual.seat_config || {};
    if (String(seat) in actualLocal) {
      const nuevoLocal = { ...actualLocal };
      delete nuevoLocal[String(seat)];
      setCuentaActual({ ...cuentaActual, seat_config: nuevoLocal });
    }
    try {
      const cuentaFresca = await obtenerCuentaPorId(cuentaId);
      const actual = cuentaFresca?.seat_config || {};
      if (String(seat) in actual) {
        const nuevo = { ...actual };
        delete nuevo[String(seat)];
        await actualizarSeatConfig(cuentaId, nuevo);
      }
    } catch (error) {
      console.error('Error al eliminar comensal vacío:', error);
    }
  };

  // Manejar minicomanda devuelta por cocina: mover items al carro para que el mesero modifique y reenvie
  // Orden obligatorio: 1) leer items + hijas, 2) reconstruir carro, 3) SOLO DESPUÉS borrar
  // el original (items_opciones / item_extras / item_comensal_share tienen ON DELETE CASCADE).
  const handleModificarDevuelta = async (mini: Minicomanda) => {
    // FASE 1 — solo lecturas, sin mutar nada todavía.
    let itemsDevueltos;
    try {
      itemsDevueltos = await obtenerItemsPorMinicomanda(mini.id);
    } catch (error) {
      console.error('Error al leer items devueltos:', error);
      alert('Error al procesar la comanda devuelta. Intenta de nuevo.');
      return;
    }
    const nuevosItems: CarroItem[] = [];
    try {
      for (const it of itemsDevueltos) {
        const [opciones, extrasRows, shares] = await Promise.all([
          obtenerOpcionesPorItem(it.id).catch(() => []),
          obtenerExtrasPorItem(it.id).catch(() => []),
          it.seat_number === null ? obtenerSharesPorItem(it.id).catch(() => []) : Promise.resolve([] as any[]),
        ]);
        const optExtraTotal = opciones.reduce((s: number, o: any) => s + (Number(o.precio_extra) || 0), 0);
        const extrasPrecioTotal = extrasRows.reduce((s: number, e: any) => s + (Number(e.precio) || 0), 0);

        // Producto con fallback seguro (REGLA 12): nunca descartar el item en silencio.
        // Si ya no existe en catálogo, se conserva todo (cantidad, notas, opciones,
        // extras) con un Product placeholder cuyo precio se deriva del snapshot
        // guardado. LIMITACIÓN: el placeholder no tiene imagen/descripción/opciones
        // de catálogo, así que el modal no podrá re-elegir variantes nuevas.
        let producto = productos.find(p => p.id === it.producto_id);
        if (!producto) {
          console.warn(`[devuelta] producto ${it.producto_id} no está en catálogo; se usa placeholder`);
          const base = Math.max(0, Number(it.precio_unitario || 0) - optExtraTotal - extrasPrecioTotal);
          producto = { id: it.producto_id, name: it.producto_id, price: base, category: 'especiales' } as Product;
        }

        // Notas (REGLA 10): el sufijo legacy " | Extras: ..." solo se retira cuando
        // existen extras estructurados (al reenviar, handleAdd los vuelve a agregar;
        // sin esto el texto se duplicaría). Sin filas hijas se conserva íntegro
        // para no perder información de comandas anteriores a esta etapa.
        let notes = it.notas || '';
        if (extrasRows.length > 0) {
          notes = notes.replace(/\s*\|\s*Extras:.*$/i, '').replace(/^\s*Extras:.*$/i, '').trim();
        }

        // Compartidos (REGLA 11): reconstruir sharedWith desde item_comensal_share.
        // seat_number = null NUNCA se convierte silenciosamente en comensal 1.
        let seatNumber: number | null;
        let sharedWith: CarroItem['sharedWith'] = undefined;
        if (it.seat_number === null) {
          if (shares.length > 1) {
            seatNumber = null;
            sharedWith = shares.map((s: any) => ({
              seat: s.seat_number,
              porcentaje: Number(s.porcentaje),
              monto: Number(s.monto),
            }));
          } else if (shares.length === 1) {
            seatNumber = shares[0].seat_number;
          } else {
            console.warn(`[devuelta] item ${it.id} compartido sin shares; se asigna comensal 1`);
            seatNumber = 1;
          }
        } else {
          seatNumber = it.seat_number || 1;
        }

        const localId = `devuelta-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${seatNumber ?? 'shared'}`;
        const carroItem: CarroItem = {
          id: localId,
          product: producto,
          quantity: it.cantidad,
          notes,
          selectedOptions: opciones.map((o: any) => ({
            optionName: o.opcion_nombre,
            choiceName: o.choice_nombre,
            extraPrice: Number(o.precio_extra) || 0,
          })),
          seatNumber,
          selectedExtras: extrasRows.map((e: any) => ({ nombre: e.nombre, precio: Number(e.precio) || 0 })),
        };
        if (sharedWith) carroItem.sharedWith = sharedWith;
        nuevosItems.push(carroItem);
      }
    } catch (error) {
      console.error('Error al reconstruir items devueltos:', error);
      alert('Error al procesar la comanda devuelta. Intenta de nuevo.');
      return;
    }
    if (nuevosItems.length === 0) {
      alert('No se pudo recuperar ningún item de la comanda devuelta. No se eliminó nada.');
      return;
    }
    // FASE 2 — agregar al carro y después borrar el original. Si el borrado falla,
    // se revierten los items agregados para no duplicar la orden (REGLA 13).
    // LIMITACIÓN: no es atomicidad transaccional real (dos sistemas distintos:
    // estado React + Supabase); solo reduce la ventana de duplicado.
    const nuevosIds = nuevosItems.map(i => i.id);
    setCarroLocal(prev => [...prev, ...nuevosItems]);
    try {
      // Eliminar la minicomanda devuelta (las hijas caen por ON DELETE CASCADE)
      await supabase.from('historial_acciones').delete().eq('minicomanda_id', mini.id);
      await supabase.from('items_minicomanda').delete().eq('minicomanda_id', mini.id);
      await supabase.from('minicomandas').delete().eq('id', mini.id);
      await recargarEstadoMesa();
    } catch (error) {
      console.error('Error al eliminar comanda devuelta tras reconstruir:', error);
      setCarroLocal(prev => prev.filter(i => !nuevosIds.includes(i.id)));
      alert('Se recuperaron los items pero no se pudo eliminar la comanda original. Se revirtió el carro para evitar duplicados. Intenta de nuevo.');
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

  // Guardar edición de un producto PENDIENTE (modo edición del modal de detalle).
  // NO usa agregarAlCarro (evita nuevo id / fusión por fingerprint): reemplaza el
  // MISMO CarroItem por id, conservando id, product, seatNumber y sharedWith.
  // Si el item es compartido y cambió quantity o precio, recalcula solo `monto`
  // con la misma fórmula de ShareItemModal (total × porcentaje, 2 decimales).
  // El producto sigue pendiente; la persistencia a BD ocurre en enviarACocina().
  const handleSaveEdit = (
    itemId: string,
    quantity: number,
    notes: string,
    options: CartItemOption[],
    extras: { nombre: string; precio: number }[]
  ) => {
    setCarroLocal(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const optExtra = (options || []).reduce((s: number, o: CartItemOption) => s + (o.extraPrice || 0), 0);
      const extrasTotal = (extras || []).reduce((s: number, e: { precio: number }) => s + (e.precio || 0), 0);
      const nuevoTotalItem = (item.product.price + optExtra + extrasTotal) * quantity;
      let sharedWith = item.sharedWith;
      if (sharedWith && sharedWith.length > 0) {
        // Misma distribución exacta del modal: centavos enteros, el último
        // absorbe el residuo. Σ share.monto === nuevoTotalItem siempre.
        const partes = montosExactos(
          Math.round(nuevoTotalItem * 100),
          sharedWith.map(s => Math.round(s.porcentaje * 100))
        );
        sharedWith = sharedWith.map((s, idx) => ({
          ...s,
          monto: partes[idx] / 100
        }));
      }
      return {
        ...item,
        quantity,
        notes,
        selectedOptions: options,
        selectedExtras: extras,
        sharedWith
      };
    }));
    setEditingItem(null);
  };

  // Recalcula los comensales con saldo pendiente para el modal de cobro exitoso.
  // `cobroSuccess.pendientesRestantes` cuenta filas abiertas de `cuentas` (1 por
  // mesa), no comensales: tras cobrar al primero decía "Quedan 1" con 2 deudas
  // todavía vivas. Tras el cobro, historialData/sharesPorItem ya se limpian y los
  // ítems en memoria quedan desactualizados, así que el conteo se hace con una
  // lectura fresca de SOLO LECTURA (mismo recorrido que cobrarAsientos). No
  // modifica cobro, shares, reparto ni liberación de mesa.
  const [comensalesPendientes, setComensalesPendientes] = useState<number | null>(null);

  useEffect(() => {
    if (!cobroSuccess || cobroSuccess.mesaLiberada || !mesaSeleccionada) return;
    let cancelado = false;
    setComensalesPendientes(null);
    (async () => {
      try {
        const cuentas = await obtenerCuentasAbiertasPorMesa(mesaSeleccionada.id);
        const conSaldo = new Set<number>();
        for (const c of cuentas) {
          const minis = await obtenerMinicomandasPorCuenta(c.id);
          for (const m of minis) {
            if (m.estado === 'DEVUELTA') continue;
            const items = await obtenerItemsPorMinicomanda(m.id);
            for (const it of items) {
              if (it.seat_number !== null && it.seat_number !== undefined) {
                conSaldo.add(it.seat_number || 1);
              } else {
                const shares = await obtenerSharesPorItem(it.id);
                for (const s of shares) {
                  if (!s.pagado) conSaldo.add(s.seat_number);
                }
              }
            }
          }
        }
        if (!cancelado) setComensalesPendientes(conSaldo.size);
      } catch (error) {
        console.error('Error al contar comensales con saldo pendiente:', error);
        // Degradación: conserva el conteo anterior (filas de cuenta) si falla la lectura
        if (!cancelado) setComensalesPendientes(cobroSuccess.pendientesRestantes);
      }
    })();
    return () => { cancelado = true; };
  }, [cobroSuccess, mesaSeleccionada]);

  // Conteo a mostrar: fresco si ya llegó; si no, el valor anterior de respaldo
  const pendientesMsg = comensalesPendientes ?? cobroSuccess?.pendientesRestantes ?? 0;

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
                  Cobro registrado por <strong>${formatoMXN(cobroSuccess.totalPagado)}</strong>.{' '}
                  {pendientesMsg === 1
                    ? <strong>Queda 1 comensal por pagar</strong>
                    : <strong>Quedan {pendientesMsg} comensales por pagar</strong>} en esta mesa.
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

  // JSX del modal de confirmación de reemplazo de mesero. Se renderiza en ambas
  // vistas (selección y detalle): al tocar una mesa ocupada por otro mesero no se
  // selecciona la mesa (mesaSeleccionada = null), así que la vista se queda en la
  // grilla; si el modal solo existiera en la vista de detalle, no aparecería hasta
  // tocar otra mesa, como ocurría antes.
  const reemplazoModal = (
    <AnimatePresence>
      {solicitudReemplazo && (
        <div id="reemplazo-mesero-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
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
  );

  // Renderizar selección de mesa
  if (!mesaSeleccionada) {
    return (
      <div id="waiter-view" className="min-h-screen bg-brand-green-dark p-4 flex flex-col">
        {cobroExitosoModal}
        {reemplazoModal}
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

  // Representación EXCLUSIVA desktop/tablet horizontal — densidad tipo ticket POS.
  // Reutiliza estados/handlers de renderComanda(); mobile usa renderComanda() intacto.
  const renderComandaDesktop = () => {
    const itemsCarro = itemsPorAsiento[comensalActivo] || [];
    const itemsBD = itemsDeCocina.filter(it => (it.seat_number || 1) === comensalActivo);
    const total = calcularSubtotalCuenta();
    const totalArticulos = itemsCarro.length + itemsBD.length;
    return (
      <>
        {/* HEADER comanda: título · total · ENVIAR · CUENTA (una línea compacta) */}
        <div className="flex items-center gap-2 pb-2 shrink-0" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
          <div className="min-w-0">
            <h3 className="font-black uppercase tracking-widest text-xs" style={{ color: 'var(--waiter-text)' }}>Comanda</h3>
          </div>
          <span className="ml-auto font-black text-lg font-mono shrink-0" style={{ color: 'var(--waiter-text)' }}>${formatoMXN(total)}</span>
          <button
            onClick={handleEnviarACocina}
            disabled={carroLocal.length === 0 || enviandoACocina}
            title={enviandoACocina ? 'Enviando…' : envioEstado === 'exito' ? 'Orden enviada' : envioEstado === 'error' ? 'Reintentar envío' : `Enviar todos los ${carroLocal.length} pendientes de la mesa a cocina`}
            className="font-sans font-bold flex items-center justify-center gap-1 shadow transition-all active:scale-[0.99] disabled:cursor-not-allowed shrink-0"
            style={{
              minHeight: '40px', borderRadius: '10px', paddingLeft: '12px', paddingRight: '12px',
              backgroundColor: (carroLocal.length === 0 || enviandoACocina)
                ? 'var(--waiter-panel-secondary)'
                : envioEstado === 'error' ? 'var(--waiter-danger)'
                : envioEstado === 'exito' ? 'var(--waiter-success)'
                : 'var(--waiter-primary)',
              color: (carroLocal.length === 0 || enviandoACocina)
                ? 'var(--waiter-text-secondary)'
                : envioEstado === 'error' || envioEstado === 'exito' ? '#FFFFFF' : '#0B190C'
            }}
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-black uppercase tracking-tight font-sans">
              {enviandoACocina ? '…' : envioEstado === 'exito' ? '✓' : envioEstado === 'error' ? 'Reintentar' : `Enviar todo·${carroLocal.length}`}
            </span>
          </button>
          <button
            onClick={verHistorialCompleto}
            title="Ver consumos de la mesa y cobrar"
            className="font-sans font-bold flex items-center justify-center gap-1 border transition-all active:scale-[0.99] shrink-0"
            style={{ minHeight: '40px', borderRadius: '10px', paddingLeft: '12px', paddingRight: '12px', borderColor: 'var(--waiter-border)', color: 'var(--waiter-text)' }}
          >
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-black uppercase tracking-tight font-sans">Cuenta</span>
          </button>
        </div>

        {/* Tabs comensales compactos (inline, scroll discreto) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 min-w-0" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
          {asientosActivos.map(seat => {
            const isActive = comensalActivo === seat;
            const editando = editingSeat === seat;
            const tieneItems = (itemsPorAsiento[seat]?.length || 0) + (itemsDeCocina.filter(it => (it.seat_number || 1) === seat).length) > 0;
            // Nombre completo siempre visible: sin truncate para que el mesero distinga cada comensal
            const nombreTab = obtenerNombreAsiento(seat);
            return (
              <button
                key={seat}
                onClick={() => { if (!editando) setComensalActivo(seat); }}
                aria-pressed={isActive}
                title={nombreTab}
                className="relative min-w-[40px] min-h-[40px] px-3 rounded-full text-xs font-black transition-all border shrink-0"
                style={isActive
                  ? { backgroundColor: '#D6A928', color: '#0B190C', borderColor: 'transparent' }
                  : { backgroundColor: 'transparent', color: '#F3F0E8', borderColor: '#284228' }
                }
              >
                {editando ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => {
                      if (cancelandoEdicionRef.current) { cancelandoEdicionRef.current = false; setEditingSeat(null); return; }
                      guardarNombreAsiento(seat, editingName); setEditingSeat(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { guardarNombreAsiento(seat, editingName); setEditingSeat(null); }
                      if (e.key === 'Escape') { cancelandoEdicionRef.current = true; setEditingSeat(null); }
                    }}
                    className="w-14 text-center bg-transparent outline-hidden text-xs font-black"
                    maxLength={20}
                  />
                ) : (
                  <span className="whitespace-nowrap block">{nombreTab}</span>
                )}
                {isActive && !editando && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelandoEdicionRef.current = false;
                      setEditingSeat(seat);
                      setEditingName(cuentaActual?.seat_config?.[String(seat)]?.nombre || '');
                    }}
                    className="ml-0.5 text-[10px] leading-none opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                    title="Renombrar comensal"
                  >✏️</span>
                )}
              </button>
            );
          })}
          <button
            onClick={agregarComensal}
            aria-label="Agregar comensal"
            className="min-w-[40px] min-h-[40px] rounded-full border border-dashed border-brand-gold/30 flex items-center justify-center text-brand-gold/50 hover:border-brand-gold hover:text-brand-gold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Lista: PENDIENTES (área flexible con scroll) + ENVIADO (barra fija) */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden py-2">
          {totalArticulos === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-6 space-y-1">
              <span className="text-3xl" aria-hidden="true">🧾</span>
              <p className="text-xs font-bold" style={{ color: 'var(--waiter-text)' }}>Sin productos</p>
              <p className="text-[11px]" style={{ color: 'var(--waiter-text-secondary)' }}>Agrega productos y crea la orden.</p>
            </div>
          ) : (
            <>
              {/* PENDIENTE — contexto comensal visible vs total global que envía el botón */}
              <div className="flex items-center gap-2 mb-1 shrink-0">
                <span className="text-xs shrink-0" aria-hidden="true" style={{ color: 'var(--waiter-primary)' }}>●</span>
                <h4 className="text-[10px] font-black uppercase truncate min-w-0" style={{ color: 'var(--waiter-text)' }}>{obtenerNombreAsiento(comensalActivo)} · {itemsCarro.length} de {carroLocal.length} pendientes</h4>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {itemsCarro.map(item => {
                  const optExtra = (item.selectedOptions || []).reduce((sum: number, o: any) => sum + o.extraPrice, 0);
                  const extrasTotal = (item.selectedExtras || []).reduce((eSum: number, e: any) => eSum + e.precio, 0);
                  const itemSinglePrice = item.product.price + optExtra + extrasTotal;
                  const menuAbierto = menuProductoAbierto === item.id;
                  const modo = (item.selectedOptions || []).map((o: any) => o.choiceName);
                  const nota = item.notes || (item.selectedExtras?.length ? 'Extras: ' + item.selectedExtras.map(e => `${e.nombre} +$${formatoMXN(e.precio)}`).join(', ') : '');
                  // Parte del comensal activo: monto exacto del share (sin recalcular).
                  const parteComensal = item.sharedWith && item.sharedWith.length > 0
                    ? item.sharedWith.find(s => s.seat === comensalActivo)
                    : undefined;
                  return (
                    <div key={`desk-carro-${item.id}`} className="py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-black text-sm truncate flex-1 min-w-0" style={{ color: 'var(--waiter-text)' }}>{item.product.name}</span>
                        <span className="font-mono font-bold text-sm shrink-0" style={{ color: 'var(--waiter-text)' }}>${formatoMXN(itemSinglePrice * item.quantity)}</span>
                      </div>
                      {item.sharedWith && item.sharedWith.length > 0 && (
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--waiter-text-secondary)' }}>
                          ⇄ Compartido · {item.sharedWith.map(s => `C.${s.seat} ${s.porcentaje}%`).join(' + ')}
                        </p>
                      )}
                      {parteComensal && (
                        <p className="text-[10px] truncate mt-0.5 pl-3 font-semibold" style={{ color: 'var(--waiter-text-secondary)' }}>
                          {obtenerNombreAsiento(comensalActivo)}: ${formatoMXN(parteComensal.monto)}
                        </p>
                      )}
                      {(modo.length > 0 || (nota && nota.trim() !== '')) && (
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--waiter-text-secondary)' }}>
                          {[modo.join(' · '), (nota && nota.trim() !== '' ? nota : '')].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateCarroQuantity(item.id, item.quantity - 1)} aria-label="Disminuir cantidad"
                            className="w-9 h-9 flex items-center justify-center rounded-[8px] border text-sm font-black"
                            style={{ borderColor: 'var(--waiter-border)', color: 'var(--waiter-text-secondary)' }}>−</button>
                          <span className="w-7 text-center font-black text-sm" style={{ color: 'var(--waiter-text)' }}>{item.quantity}</span>
                          <button onClick={() => updateCarroQuantity(item.id, item.quantity + 1)} aria-label="Aumentar cantidad"
                            className="w-9 h-9 flex items-center justify-center rounded-[8px] border text-sm font-black"
                            style={{ borderColor: 'var(--waiter-border)', color: 'var(--waiter-text-secondary)' }}>+</button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <button onClick={() => setMenuProductoAbierto(menuAbierto ? null : item.id)} aria-label="Opciones del producto" aria-expanded={menuAbierto}
                              className="w-9 h-9 flex items-center justify-center rounded-[8px] border"
                              style={{ borderColor: 'var(--waiter-border)', color: 'var(--waiter-text-secondary)' }}>
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {menuAbierto && (
                              <>
                                <button aria-hidden="true" tabIndex={-1} onClick={() => setMenuProductoAbierto(null)} className="fixed inset-0 z-40 cursor-default bg-transparent border-0 p-0" />
                                <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-44 rounded-[10px] border p-1.5 shadow-2xl"
                                  style={{ backgroundColor: 'var(--waiter-bg)', borderColor: 'var(--waiter-border)' }}>
                                  <button role="menuitem" onClick={() => { setMenuProductoAbierto(null); setEditingItem(item); }}
                                    className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-xs font-semibold text-left" style={{ color: 'var(--waiter-text)' }}>
                                    <Pencil className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
                                    Editar
                                  </button>
                                  <button role="menuitem" onClick={() => { setMenuProductoAbierto(null); setShareItem(item); }}
                                    className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-xs font-semibold text-left" style={{ color: 'var(--waiter-text)' }}>
                                    <Users className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
                                    {item.sharedWith && item.sharedWith.length > 0 ? 'Editar reparto' : 'Compartir'}
                                  </button>
                                  <button role="menuitem" onClick={() => { setMenuProductoAbierto(null); removeFromCarro(item.id); }}
                                    className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-xs font-bold text-left" style={{ color: 'var(--waiter-danger)' }}>
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    Eliminar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ENVIADO A COCINA — barra colapsable fija (colapsado por defecto) */}
              <button
                onClick={() => setColapsadoEnviados(v => !v)}
                aria-expanded={!colapsadoEnviados}
                className="w-full flex items-center gap-2 py-2 min-h-[40px] shrink-0 mt-1"
                style={{ borderTop: '1px solid var(--waiter-border)' }}
              >
                <span className="text-xs" aria-hidden="true" style={{ color: 'var(--waiter-success)' }}>●</span>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--waiter-text)' }}>
                  Enviado a cocina · {itemsBD.length} art.
                </span>
                <span className="ml-auto" style={{ color: 'var(--waiter-text-secondary)' }} aria-hidden="true">
                  {colapsadoEnviados ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </span>
              </button>
              {!colapsadoEnviados && itemsBD.length > 0 && (
                <div className="overflow-y-auto shrink-0 min-h-0" style={{ maxHeight: '30%' }}>
                  <div className="space-y-0.5 pb-1">
                    {itemsBD.map((itemBD, idxBD) => {
                      const nombreProd = productos.find(p => p.id === itemBD.producto_id)?.name || itemBD.producto_id;
                      const estado = itemBD.estado_minicomanda || 'PENDIENTE';
                      const textoEstado = estado === 'LISTO' ? '✓ Listo' : estado === 'DEVUELTA' ? '◌ Devuelta' : '✓ En cocina';
                      // Acciones DEVUELTA (solo desktop/tablet): operan sobre la minicomanda
                      // completa, no por item. Se muestran una sola vez (en la primera
                      // fila de cada minicomanda) y reutilizan los handlers existentes.
                      const esDevuelta = estado === 'DEVUELTA';
                      const miniDevuelta = esDevuelta ? minicomandas.find(m => m.id === itemBD.minicomanda_id) : undefined;
                      const esPrimeraDeMini = esDevuelta && miniDevuelta
                        && itemsBD.findIndex(it => it.minicomanda_id === miniDevuelta.id && (it.estado_minicomanda || 'PENDIENTE') === 'DEVUELTA') === idxBD;
                      return (
                        <div key={`desk-bd-${itemBD.id}`}>
                          <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <div className="min-w-0">
                              <p className="font-sans font-semibold text-sm truncate" style={{ color: 'var(--waiter-text)' }}>
                                <span style={{ color: 'var(--waiter-text-secondary)' }}>{itemBD.cantidad}x </span>{nombreProd}
                              </p>
                              <p className="text-[11px] truncate" style={{ color: 'var(--waiter-text-secondary)' }}>
                                {textoEstado}{itemBD.notas && itemBD.notas.trim() !== '' ? ` · ${itemBD.notas}` : ''}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-sm shrink-0" style={{ color: 'var(--waiter-text)' }}>${formatoMXN(itemBD.total_item)}</span>
                          </div>
                          {esPrimeraDeMini && miniDevuelta && (
                            <div className="flex gap-1.5 pb-1.5">
                              <button
                                onClick={() => handleModificarDevuelta(miniDevuelta)}
                                className="flex-none inline-flex items-center justify-center min-h-[34px] px-3.5 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 active:scale-[0.99] transition-all"
                              >
                                Editar y reenviar
                              </button>
                              <button
                                onClick={() => handleEliminarDevuelta(miniDevuelta.id)}
                                title="Eliminar sin modificar"
                                aria-label="Eliminar comanda devuelta"
                                className="flex-none inline-flex items-center justify-center min-h-[34px] min-w-[34px] px-2 rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--waiter-border)', color: 'var(--waiter-danger)' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  };

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
            // Nombre completo siempre visible: sin truncate para que el mesero distinga cada comensal
            const nombreTab = obtenerNombreAsiento(seat);
            return (
              <button
                key={seat}
                onClick={() => { if (!editando) setComensalActivo(seat); }}
                title={nombreTab}
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
                    onBlur={() => {
                      if (cancelandoEdicionRef.current) { cancelandoEdicionRef.current = false; setEditingSeat(null); return; }
                      guardarNombreAsiento(seat, editingName); setEditingSeat(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { guardarNombreAsiento(seat, editingName); setEditingSeat(null); }
                      if (e.key === 'Escape') { cancelandoEdicionRef.current = true; setEditingSeat(null); }
                    }}
                    className="w-14 text-center bg-transparent outline-hidden text-[10px] font-black"
                    placeholder="Nombre"
                    maxLength={20}
                  />
                ) : (
                  <>
                    <div className="font-black whitespace-nowrap">{nombreTab}</div>
                    <div className="text-[10px] opacity-80 font-mono">${formatoMXN(sub)}</div>
                  </>
                )}
                {/* Botón ✏️ (solo tab activo, touch-friendly) */}
                {isActive && !editando && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelandoEdicionRef.current = false;
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
            onClick={agregarComensal}
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
                          onClick={() => updateCarroQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-white rounded text-brand-warm-gray transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-sm text-brand-green-dark">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCarroQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-white rounded text-brand-warm-gray transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Enviado a cocina colapsable (mobile) — misma lógica, sin scroll anidado */}
              <button
                onClick={() => setColapsadoEnviados(v => !v)}
                aria-expanded={!colapsadoEnviados}
                className="w-full flex items-center gap-2 py-2.5 min-h-[44px] mt-1 border-t border-brand-crema-dark/20"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-black uppercase tracking-widest text-brand-green-dark">
                  Enviado a cocina · {itemsBDDelAsiento.length} art.
                </span>
                <span className="ml-auto text-brand-green-dark" aria-hidden="true">
                  {colapsadoEnviados ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </span>
              </button>
              {!colapsadoEnviados && (
              <>
              {itemsBDDelAsiento.map(itemBD => {
                const nombreProd = productos.find(p => p.id === itemBD.producto_id)?.name || itemBD.producto_id;
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
              )}
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

  // Contenido del menú de mesa — presentacional, mismos handlers existentes.
  // Se ancla en la barra móvil (absolute) y en el menú fijo desktop (fixed bajo el header
  // global, abierto desde la píldora mesero+⋮ de App vía 'toggle_mesa_menu').
  const renderMenuMesaContenido = () => (
    <>
      <button role="menuitem" onClick={() => { setShowMenuMesa(false); cambiarMesa(); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <DoorOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Cambiar mesa
      </button>
      <button role="menuitem" onClick={() => { setShowMenuMesa(false); verHistorialCompleto(); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <History className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Ver historial / Cuenta
      </button>
      <button role="menuitem" onClick={async () => { setShowMenuMesa(false); await recargarCheckoutData(); setShowSeatSplitModal(true); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <Layers className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Mover / Dividir por comensal
      </button>
      <button role="menuitem" onClick={() => { setShowMenuMesa(false); setShowMergeModal(true); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Combinar cuentas
      </button>
      <button role="menuitem" onClick={() => { setShowMenuMesa(false); handleImprimirTicket(); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <Receipt className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Imprimir ticket
      </button>
      <button role="menuitem" onClick={() => { setShowMenuMesa(false); window.dispatchEvent(new Event('open_role_modal')); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text)' }}>
        <User className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
        Configuración
      </button>
      {(cuentaActual && cuentaActual.estado === 'ABIERTA') && (
        <button role="menuitem" onClick={() => { setShowMenuMesa(false); setShowLiberarModal(true); }}
          className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-bold text-left transition-all hover:brightness-125"
          style={{ color: 'var(--waiter-danger)' }}>
          <RotateCcw className="w-4 h-4 shrink-0" />
          Liberar mesa
        </button>
      )}
      <div className="my-1 h-px" style={{ backgroundColor: 'var(--waiter-border)' }} />
      <button role="menuitem" onClick={async () => { setShowMenuMesa(false); await logoutMesero(); window.dispatchEvent(new Event('open_role_modal')); }}
        className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-left transition-all hover:brightness-125"
        style={{ color: 'var(--waiter-text-secondary)' }}>
        <LogOut className="w-4 h-4 shrink-0" />
        Cerrar sesión
      </button>
    </>
  );

  // Renderizar vista principal con mesa seleccionada
  return (
    <div id="waiter-view" className="h-[calc(100dvh-4rem)] p-4 flex flex-col overflow-hidden">
       {/* Header móvil: Mesa + mesero + ⋮ (solo <md). Desktop usa header global de App. */}
      <div className="waiter-header px-4 flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm font-sans font-semibold truncate min-w-0" style={{ color: 'var(--waiter-text)' }}>
          Mesa {mesaSeleccionada.numero} · {mesaSeleccionada.ubicacion}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-h-[44px]">
            <User className="w-4 h-4 shrink-0" style={{ color: 'var(--waiter-text-secondary)' }} />
            <span className="font-sans font-semibold text-sm truncate max-w-[120px]" style={{ color: 'var(--waiter-text)' }}>{meseroLogueado?.nombre}</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenuMesa(prev => !prev)} aria-label="Opciones de mesa" aria-expanded={showMenuMesa}
              className="w-11 h-11 flex items-center justify-center rounded-[10px] font-sans transition-all border"
              style={{ color: 'var(--waiter-text)', borderColor: 'var(--waiter-border)' }}>
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenuMesa && (
              <>
                <button aria-hidden="true" tabIndex={-1} onClick={() => setShowMenuMesa(false)} className="fixed inset-0 z-40 bg-transparent border-0 p-0 cursor-default" />
                <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-60 rounded-[14px] border p-2 shadow-2xl font-sans"
                  style={{ backgroundColor: 'var(--waiter-panel-secondary)', borderColor: 'var(--waiter-border)' }}>
                  {renderMenuMesaContenido()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Menú fijo desktop — anclado bajo el header global, se abre desde la píldora
          mesero+⋮ de App vía 'toggle_mesa_menu'. Mismo contenido/handlers que el menú móvil.
          Solo desktop (hidden md:block); móvil usa el menú absolute de la barra secundaria. */}
      {showMenuMesa && (
        <div className="hidden md:block">
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setShowMenuMesa(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent border-0 p-0"
          />
          <div
            role="menu"
            className="fixed right-4 top-[68px] z-50 w-60 rounded-[14px] border p-2 shadow-2xl font-sans"
            style={{ backgroundColor: 'var(--waiter-panel-secondary)', borderColor: 'var(--waiter-border)' }}
          >
            {renderMenuMesaContenido()}
          </div>
        </div>
      )}

      {/* Layout: grid 2 columnas desktop, stack móvil */}
      <div className="flex-1 waiter-grid md:mt-0 overflow-hidden min-h-0">
        {/* Left: Categorías + Buscador + Grid */}
        <div className="bg-brand-green/40 backdrop-blur-md rounded-xl p-3 flex flex-col min-w-0 min-h-0 border border-brand-gold/10 overflow-hidden md:pb-3 pb-[calc(4rem+12px)]">
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

                  {/* En móvil: sin placeholder (consistente con ClientView - todos sin imagen en smartphone) */}

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

        {/* Right Side desktop: comanda densa tipo ticket (renderComandaDesktop) — mobile usa renderComanda() */}
        <div
          className="waiter-comanda-sticky rounded-xl p-3 flex flex-col min-h-0 border overflow-hidden hidden md:flex"
          style={{ backgroundColor: 'var(--waiter-panel)', borderColor: 'var(--waiter-border)', color: 'var(--waiter-text)' }}
        >
          {renderComandaDesktop()}
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

      {/* Modal de confirmación de reemplazo de mesero (compartido con la vista de selección) */}
      {reemplazoModal}

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

      {/* Product Detail Modal — agregar (selectedProductDetail) o editar pendiente (editingItem) */}
      <ProductDetailModalWaiter
        product={editingItem ? editingItem.product : selectedProductDetail}
        isOpen={!!selectedProductDetail || !!editingItem}
        onClose={() => { setSelectedProductDetail(null); setEditingItem(null); }}
        onAdd={(product, quantity, notes, options, extras) => {
          try { agregarAlCarro(product, quantity, notes, options, extras, comensalActivo); } finally { setSelectedProductDetail(null); }
        }}
        initialItem={editingItem}
        onSaveEdit={handleSaveEdit}
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
                          const itemsDelComensal = itemsDeBDDelComensal(seat);

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
                                  <span className="font-black text-sm font-mono">{sharesEnCarga ? 'Cargando...' : `$${formatoMXN(sub)}`}</span>
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
                                  disabled={cobroBloqueadoPorShares}
                                  title={sharesEnCarga ? 'Cargando participaciones...' : compartidosHuerfanos.length > 0 ? 'Participación no disponible' : 'Cobrar a este comensal'}
                                  className="px-3 py-3 rounded-xl bg-gradient-to-r from-brand-green to-brand-green-dark text-white font-black text-xs shadow hover:from-brand-green-light hover:to-brand-green transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        const nombreProd = productos.find(p => p.id === it.producto_id)?.name || it.producto_id;
                                        // Compartido: importe EXCLUSIVO = suma de share.monto IMPAGOS
                                        // del comensal (sin recalcular). Fila pagada: etiqueta "Pagado".
                                        // Normal: it.total_item. Nunca total_item para un compartido.
                                        const share = shareDeBD(it, seat);
                                        const esCompartido = it.seat_number === null;
                                        const filaCargando = esCompartido && sharesPorItem[it.id] === undefined;
                                        const impagasFila = esCompartido
                                          ? (sharesPorItem[it.id] || []).filter((sh: any) => sh.seat_number === seat && !sh.pagado)
                                          : [];
                                        const pagadasFila = esCompartido
                                          ? (sharesPorItem[it.id] || []).filter((sh: any) => sh.seat_number === seat && sh.pagado)
                                          : [];
                                        const montoFila = !esCompartido ? it.total_item : impagasFila.reduce((a: number, sh: any) => a + sh.monto, 0);
                                        const montoPagadoFila = pagadasFila.reduce((a: number, sh: any) => a + sh.monto, 0);
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
                                              {it.seat_number === null && share && (
                                                <div className="text-[10px] font-bold text-purple-700 mt-0.5">
                                                  ↳ Compartida · {share.porcentaje}%
                                                </div>
                                              )}
                                              {it.notas && it.notas.trim() !== '' && (
                                                <div className="text-[10px] italic text-brand-warm-gray mt-0.5 flex items-center gap-1">
                                                  <MessageSquare className="w-3 h-3 text-brand-warm-gray/50 shrink-0" />
                                                  <span>{it.notas}</span>
                                                </div>
                                              )}
                                              {!esCompartido && (
                                                <button
                                                  onClick={() => setShareCheckoutItem(it)}
                                                  title="Compartir este platillo entre comensales"
                                                  className="mt-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/20 transition-colors inline-flex items-center gap-1"
                                                >
                                                  <Users className="w-3 h-3" />
                                                  Compartir
                                                </button>
                                              )}
                                            </div>
                                            <span className="font-mono font-bold text-brand-green-dark shrink-0 pt-0.5">
                                              {filaCargando ? 'Cargando...' : (!esCompartido || impagasFila.length > 0 ? `$${formatoMXN(montoFila)}` : pagadasFila.length > 0 ? `Pagado · $${formatoMXN(montoPagadoFila)}` : 'Participación no disponible')}
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

                      {/* Avisos de compartidos: cargando o sin participación */}
                      {sharesEnCarga && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-xs font-bold text-blue-700">
                          Cargando participaciones de ítems compartidos...
                        </div>
                      )}
                      {!sharesEnCarga && compartidosHuerfanos.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center text-xs font-bold text-red-700">
                          Participación no disponible en {compartidosHuerfanos.length} ítem(s) compartido(s). No se puede cobrar hasta resolver el reparto.
                        </div>
                      )}

                      {/* Total de lo seleccionado */}
                      <div className="flex justify-between items-center pt-2 border-t border-brand-gold/10">
                        <span className="text-base font-black text-brand-green-dark uppercase">Total a cobrar</span>
                        <span className="text-2xl font-black text-brand-green-dark">{sharesEnCarga ? 'Cargando...' : `$${formatoMXN(obtenerTotalSeleccionado())}`}</span>
                      </div>

                      {/* Botón principal: cobrar lo seleccionado */}
                      <button
                        onClick={() => {
                          setShowHistorial(false);
                          setMontoRecibido(obtenerTotalSeleccionado().toFixed(2));
                          setReferenciaPago('');
                          setShowCheckoutModal(true);
                        }}
                        disabled={cobroBloqueadoPorShares || obtenerTotalSeleccionado() <= 0}
                        title={sharesEnCarga ? 'Cargando participaciones...' : compartidosHuerfanos.length > 0 ? 'Participación no disponible' : 'Cobrar lo seleccionado'}
                        className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-white font-black py-5 rounded-2xl shadow-lg shadow-brand-green/25 flex items-center justify-center gap-3 text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <DollarSign className="w-6 h-6" />
                        <span>{sharesEnCarga ? 'Cargando...' : `Cobrar $${formatoMXN(obtenerTotalSeleccionado())}`}</span>
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
                          {obtenerNombreAsiento(seat)} · {sharesEnCarga ? 'Cargando...' : `$${formatoMXN(calcularSubtotalAsiento(seat))}`}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Total a cobrar */}
                <div className="bg-brand-crema-dark/10 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1">Total a Cobrar</p>
                  <p className="text-4xl font-black text-brand-green-dark">
                    {sharesEnCarga ? 'Cargando...' : `$${formatoMXN(obtenerTotalSeleccionado())}`}
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
                  // Solo visual: mientras los shares cargan no mostrar cifra parcial.
                  if (sharesEnCarga) {
                    return (
                      <div className="bg-brand-crema-dark/10 border border-brand-gold/20 rounded-xl p-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-brand-warm-gray/60">Cambio:</span>
                        <span className="text-2xl font-black text-brand-warm-gray/60">Cargando...</span>
                      </div>
                    );
                  }
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

                {/* Error de cobro (C9.12 Fase 1.5): el modal permanece abierto para
                    reintento manual con la misma key. Sin falsa señal de éxito. */}
                {cobroError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700">No se pudo confirmar el cobro</p>
                      <p className="text-xs text-red-600 mt-1">{cobroError}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={cancelarCobro}
                    disabled={cobrandoAsientos}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-brand-warm-gray bg-brand-crema-dark/20 hover:bg-brand-crema-dark/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={!montoRecibido || parseFloat(montoRecibido) < obtenerTotalSeleccionado() || cobroBloqueadoPorShares || cobrandoAsientos}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${(!montoRecibido || parseFloat(montoRecibido) < obtenerTotalSeleccionado() || cobroBloqueadoPorShares || cobrandoAsientos)
                      ? 'bg-brand-crema-dark/50 text-brand-warm-gray/50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-brand-green to-brand-green-dark text-brand-crema shadow-lg hover:from-brand-green-light hover:to-brand-green'
                      }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {cobrandoAsientos ? 'Cobrando…' : 'Cobrar'}
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
            asientos={asientosActivos}
            etiquetaAsiento={(seat) => {
              // Reutiliza la misma fuente de los tabs (seat_config vía obtenerNombreAsiento).
              // Solo presentación: "C.°N · Nombre" o "C.°N" si no hay nombre.
              const base = obtenerNombreAsiento(seat);
              return base === `C.${seat}` ? `C.°${seat}` : `C.°${seat} · ${base}`;
            }}
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

      {/* Share Item Modal - Compartir un ítem individual de BD durante el checkout.
          Reutiliza el mismo modal con un CarroItem sintético cuyo total
          (unitPrice × quantity) equivale a it.total_item por construcción. */}
      <AnimatePresence>
        {shareCheckoutItem && (
          <ShareItemModal
            item={{
              id: `checkout-${shareCheckoutItem.id}`,
              product: {
                id: shareCheckoutItem.producto_id,
                name: productos.find(p => p.id === shareCheckoutItem.producto_id)?.name || shareCheckoutItem.producto_id,
                price: Number(shareCheckoutItem.precio_unitario) || 0,
                category: 'especiales',
              } as Product,
              quantity: shareCheckoutItem.cantidad,
              notes: shareCheckoutItem.notas || '',
              selectedOptions: [],
              seatNumber: shareCheckoutItem.seat_number,
              selectedExtras: [],
            }}
            unitPrice={Number(shareCheckoutItem.precio_unitario) || 0}
            onClose={() => setShareCheckoutItem(null)}
            asientos={asientosRealesCheckout()}
            etiquetaAsiento={(seat) => {
              const base = obtenerNombreAsiento(seat);
              return base === `C.${seat}` ? `C.°${seat}` : `C.°${seat} · ${base}`;
            }}
            onConfirm={async (_itemId, sharedWith) => {
              const bdId = shareCheckoutItem.id;
              setShareCheckoutItem(null);
              await compartirItemIndividual(bdId, sharedWith);
              await recargarCheckoutData();
            }}
          />
        )}
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
  // Modo edición (opcional, compatible hacia atrás): si se recibe initialItem,
  // el estado interno se precarga desde ese CarroItem y handleAdd deriva a onSaveEdit
  // en lugar de onAdd (no crea item nuevo ni fusiona).
  initialItem?: CarroItem | null;
  onSaveEdit?: (itemId: string, quantity: number, notes: string, options: CartItemOption[], extras: { nombre: string; precio: number }[]) => void;
}

const ProductDetailModalWaiter: React.FC<ProductDetailModalWaiterProps> = ({ product, isOpen, onClose, onAdd, initialItem, onSaveEdit }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [selectedChoices, setSelectedChoices] = useState<{ [optionName: string]: { choiceName: string; extraPrice: number } }>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedExtras, setSelectedSelectedExtras] = useState<{ nombre: string; precio: number }[]>([]);
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraPrice, setCustomExtraPrice] = useState('');
  // Solo UI: colapsable extra personalizado (desktop). Se resetea al cambiar de producto.
  const [mostrarExtraPersonalizado, setMostrarExtraPersonalizado] = useState(false);

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

  // Inicializar con opciones requeridas por defecto (modo agregar).
  // En modo edición (initialItem) se precarga quantity/notes/opciones/extras
  // desde el CarroItem. Las notas se sanean con el MISMO criterio que
  // handleModificarDevuelta para no duplicar el sufijo legacy "Extras: ...".
  useEffect(() => {
    if (!product) return;
    if (initialItem) {
      const precarga: { [optionName: string]: { choiceName: string; extraPrice: number } } = {};
      (initialItem.selectedOptions || []).forEach(o => {
        precarga[o.optionName] = { choiceName: o.choiceName, extraPrice: o.extraPrice };
      });
      setSelectedChoices(precarga);
      setQuantity(initialItem.quantity || 1);
      const notasCrudas = initialItem.notes || '';
      const conExtrasEstructurados = (initialItem.selectedExtras?.length || 0) > 0;
      setNotes(conExtrasEstructurados
        ? notasCrudas.replace(/\s*\|\s*Extras:.*$/i, '').replace(/^\s*Extras:.*$/i, '').trim()
        : notasCrudas);
      setSelectedSelectedExtras([...(initialItem.selectedExtras || [])]);
      setCustomExtraName('');
      setCustomExtraPrice('');
      setMostrarExtraPersonalizado(false);
      return;
    }
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
    setMostrarExtraPersonalizado(false);
  }, [product, initialItem]);

  const esEdicion = !!initialItem;

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
    // Modo edición: reemplaza el MISMO item (no crea ni fusiona). Ver handleSaveEdit.
    if (initialItem && onSaveEdit) {
      onSaveEdit(initialItem.id, quantity, notesWithExtras, optionsArray, selectedExtras);
      return;
    }
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
      cardClass="relative bg-brand-crema-light w-full sm:max-w-md md:max-w-[1024px] lg:max-w-[1080px] max-h-[92vh] sm:max-h-[85vh] md:h-[88dvh] rounded-t-2xl sm:rounded-2xl overflow-y-auto flex flex-col shadow-2xl"
    >
      {() => (
        <>
          {/* ===== DESKTOP (md+): layout con header global + 2 columnas + resumen sticky ===== */}
          <div className="hidden md:flex flex-col h-full min-h-0 bg-brand-green-dark text-brand-crema font-sans">
            {/* Header desktop 76px: volver · producto · $ · qty · AGREGAR · X */}
            <div className="flex items-center gap-3 px-4 shrink-0 border-b border-white/10" style={{ minHeight: '76px' }}>
              <button onClick={onClose} aria-label="Volver"
                className="w-11 h-11 flex items-center justify-center rounded-[10px] text-brand-crema hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-crema/50">{esEdicion ? 'Editar pedido' : 'Configurar pedido'}</p>
                <h2 className="font-black text-base leading-tight truncate">{product.name}</h2>
              </div>
              <span className="font-black text-lg shrink-0">${formatoMXN(totalCost)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Disminuir cantidad" disabled={quantity <= 1}
                  className="w-11 h-11 flex items-center justify-center rounded-[10px] border text-brand-crema/80 hover:bg-white/10 transition-colors disabled:opacity-40">−</button>
                <span className="w-8 text-center font-black text-lg" style={{ color: 'var(--waiter-text)' }}>{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} aria-label="Aumentar cantidad"
                  className="w-11 h-11 flex items-center justify-center rounded-[10px] border text-brand-crema/80 hover:bg-white/10 transition-colors">+</button>
              </div>
              <button onClick={handleAdd}
                className="shrink-0 min-h-[48px] px-4 rounded-[10px] bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark font-black text-sm transition-all active:scale-[0.99] flex items-center gap-2">
                {esEdicion ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {esEdicion ? 'Guardar cambios' : 'Agregar a la comanda'} · ${formatoMXN(totalCost)}
              </button>
              <button onClick={onClose} aria-label="Cerrar"
                className="w-11 h-11 flex items-center justify-center rounded-[10px] text-brand-crema hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo: configuración (scroll) + resumen lateral (fijo) */}
            <div className="flex-1 flex min-h-0">
              {/* IZQUIERDA 65%: configuración con scroll */}
              <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3 space-y-4">
                {/* Product summary compacto */}
                <div className="flex gap-3 items-center">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-16 h-16 rounded-[10px] object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-16 h-16 rounded-[10px] flex items-center justify-center shrink-0 bg-brand-green"><span className="text-2xl">🍽️</span></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-brand-crema/50">{product.category}</p>
                    <h3 className="font-black text-base leading-tight line-clamp-2">{product.name}</h3>
                    <p className="font-sans font-bold text-sm text-brand-gold mt-0.5">${formatoMXN(product.price)}</p>
                  </div>
                </div>
                {product.description && (
                  <p className="text-xs font-sans leading-snug line-clamp-2" style={{ color: 'var(--waiter-text-secondary)' }}>{product.description}</p>
                )}

                {/* OPCIONES */}
                {product.options && product.options.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-widest" style={{ color: 'var(--waiter-text-secondary)' }}>¿Cómo lo quiere?</h3>
                    {product.options.map((option) => (
                      <div key={option.name} className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <h4 className="text-base font-black" style={{ color: 'var(--waiter-text)' }}>{option.name}</h4>
                          {option.required && (
                            <span className="text-[10px] bg-brand-gold/20 text-brand-gold-dark font-black px-2 py-0.5 rounded-full tracking-wider shrink-0">Requerido</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {option.choices.map((choice) => {
                            const isSelected = selectedChoices[option.name]?.choiceName === choice.name;
                            return (
                              <button
                                key={choice.name}
                                onClick={() => handleChoiceSelect(option.name, choice.name, choice.extraPrice)}
                                aria-pressed={isSelected}
                                className={`min-h-[52px] p-3 rounded-[10px] text-left border transition-all flex items-center gap-2 ${isSelected
                                  ? 'border-brand-gold bg-brand-gold/15 text-brand-crema shadow-sm'
                                  : 'border-white/10 bg-white/[0.05] text-brand-crema/80 hover:border-white/25'
                                  }`}
                              >
                                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? 'border-brand-gold bg-brand-gold text-brand-green-dark' : 'border-white/25'}`}>
                                  {isSelected && <Check className="w-3 h-3" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-xs font-bold leading-tight">{choice.name}</span>
                                  {choice.extraPrice > 0 && (
                                    <span className="block text-[11px] mt-0.5 font-black text-brand-gold">
                                      +${formatoMXN(choice.extraPrice)}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* NOTAS RÁPIDAS */}
                <div className="space-y-2">
                  <h3 className="font-black text-xs uppercase tracking-widest" style={{ color: 'var(--waiter-text-secondary)' }}>Notas rápidas</h3>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_NOTES.map(chip => {
                      const activa = notes.split(',').map(t => t.trim()).includes(chip);
                      return (
                        <button
                          key={chip}
                          onClick={() => appendQuickNote(chip)}
                          aria-pressed={activa}
                          className={`min-h-[40px] px-3 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${
                            activa
                              ? 'bg-brand-gold text-brand-green-dark shadow-sm'
                              : 'border border-white/15 text-brand-crema/75 hover:border-brand-gold/50'
                          }`}
                        >
                          {activa && <Check className="w-3.5 h-3.5" />}
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* EXTRAS */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-black text-xs uppercase tracking-widest" style={{ color: 'var(--waiter-text-secondary)' }}>Extras</h3>
                    <span className="text-[11px] font-black" style={{ color: 'var(--waiter-text-secondary)' }}>{selectedExtras.length} seleccionados</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {extras.map(extra => {
                      const activo = selectedExtras.some(e => e.nombre === extra.nombre);
                      return (
                        <button
                          key={extra.id}
                          onClick={() => {
                            const exists = selectedExtras.find(e => e.nombre === extra.nombre);
                            if (exists) setSelectedSelectedExtras(selectedExtras.filter(e => e.nombre !== extra.nombre));
                            else setSelectedSelectedExtras([...selectedExtras, { nombre: extra.nombre, precio: extra.precio }]);
                          }}
                          aria-pressed={activo}
                          className={`min-h-[52px] p-2.5 rounded-[10px] text-left border transition-all flex items-center gap-2 ${
                            activo ? 'border-brand-gold bg-brand-gold/15 text-brand-crema shadow-sm' : 'border-white/10 bg-white/[0.05] text-brand-crema/80 hover:border-white/25'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${activo ? 'border-brand-gold bg-brand-gold text-brand-green-dark' : 'border-white/25'}`}>
                            {activo && <Check className="w-3 h-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-black leading-tight truncate">{extra.nombre}</span>
                            <span className="block text-[11px] mt-0.5 font-black text-brand-gold">+${formatoMXN(extra.precio)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Extra personalizado colapsable */}
                  <button
                    onClick={() => setMostrarExtraPersonalizado(prev => !prev)}
                    aria-expanded={mostrarExtraPersonalizado}
                    className="w-full min-h-[44px] px-3 rounded-[10px] border border-white/10 text-brand-crema/80 hover:border-brand-gold/50 transition-all flex items-center gap-2 text-sm font-black"
                  >
                    <Plus className="w-4 h-4 text-brand-gold shrink-0" />
                    Agregar extra personalizado
                  </button>
                  {mostrarExtraPersonalizado && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text" value={customExtraName}
                        onChange={(e) => setCustomExtraName(e.target.value)}
                        placeholder="Nombre del extra"
                        aria-label="Nombre del extra personalizado"
                        className="flex-1 min-w-0 min-h-[44px] text-sm px-3 rounded-[10px] border border-white/15 bg-white/[0.04] text-brand-crema placeholder:text-brand-crema/35 focus:border-brand-gold/60 outline-hidden"
                      />
                      <input
                        type="text" inputMode="numeric" value={customExtraPrice}
                        onChange={(e) => setCustomExtraPrice(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="$"
                        aria-label="Precio del extra personalizado"
                        className="w-20 min-h-[44px] text-sm px-2 rounded-[10px] border border-white/15 bg-white/[0.04] text-brand-crema placeholder:text-brand-crema/35 focus:border-brand-gold/60 outline-hidden text-center"
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
                        aria-label="Agregar extra personalizado"
                        className="shrink-0 w-11 h-11 rounded-[10px] bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark font-black flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {selectedExtras.filter(e => !extras.some(pe => pe.nombre === e.nombre)).length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {selectedExtras.filter(e => !extras.some(pe => pe.nombre === e.nombre)).map((extra, idx) => (
                        <span key={`${extra.nombre}-${idx}`}
                          className="text-xs font-black bg-white/[0.04] border border-white/10 text-brand-crema pl-3 pr-1.5 py-1.5 rounded-[10px] flex items-center gap-2">
                          <span className="flex-1 truncate">{extra.nombre}</span>
                          <span className="font-black text-brand-gold shrink-0">${formatoMXN(extra.precio)}</span>
                          <button
                            onClick={() => setSelectedSelectedExtras(selectedExtras.filter(e => !(e.nombre === extra.nombre && e.precio === extra.precio)))}
                            aria-label={`Quitar ${extra.nombre}`}
                            className="w-8 h-8 shrink-0 rounded-lg text-brand-crema/60 hover:text-red-400 hover:bg-red-500/10">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* INSTRUCCIONES ESPECIALES */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-black text-xs uppercase tracking-widest" style={{ color: 'var(--waiter-text-secondary)' }}>Instrucciones especiales</h3>
                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--waiter-text-secondary)' }}>Opcional</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escribe una indicación para cocina..."
                    rows={2}
                    className="w-full min-h-[88px] text-sm p-3 rounded-[10px] border border-white/15 bg-white/[0.04] text-brand-crema placeholder:text-brand-crema/35 focus:border-brand-gold/60 outline-hidden resize-none"
                  />
                </div>
              </div>

              {/* DERECHA 35%: resumen fijo sticky */}
              <aside className="w-[35%] shrink-0 border-l border-white/10 px-4 py-4 overflow-y-auto">
                <h3 className="font-black text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--waiter-text-secondary)' }}>Resumen del pedido</h3>
                <div className="flex gap-2.5 items-center pb-2.5" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-12 h-12 rounded-[10px] object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 bg-brand-green"><span>🍽️</span></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm leading-tight line-clamp-2" style={{ color: 'var(--waiter-text)' }}>{product.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--waiter-text-secondary)' }}>${formatoMXN(product.price)}</p>
                  </div>
                </div>

                <div className="py-2.5" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--waiter-text-secondary)' }}>Opciones</p>
                  {Object.keys(selectedChoices).length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--waiter-text-secondary)' }}>Sin opciones seleccionadas</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(selectedChoices).map(([optName, val]: [string, any]) => (
                        <p key={optName} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--waiter-text)' }}>
                          <Check className="w-3.5 h-3.5 text-brand-gold shrink-0" /> {val.choiceName}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="py-2.5" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--waiter-text-secondary)' }}>Notas rápidas</p>
                  {QUICK_NOTES.filter(chip => notes.split(',').map(t => t.trim()).includes(chip)).length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--waiter-text-secondary)' }}>Sin notas</p>
                  ) : (
                    <div className="space-y-1">
                      {QUICK_NOTES.filter(chip => notes.split(',').map(t => t.trim()).includes(chip)).map(chip => (
                        <p key={chip} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--waiter-text)' }}>
                          <Check className="w-3.5 h-3.5 text-brand-gold shrink-0" /> {chip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="py-2.5" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--waiter-text-secondary)' }}>Extras</p>
                  {selectedExtras.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--waiter-text-secondary)' }}>0 seleccionados</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedExtras.map((e, idx) => (
                        <p key={`${e.nombre}-${idx}`} className="text-xs flex items-center justify-between gap-2" style={{ color: 'var(--waiter-text)' }}>
                          <span className="truncate">{e.nombre}</span>
                          <span className="text-brand-gold">+${formatoMXN(e.precio)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="py-2.5" style={{ borderBottom: '1px solid var(--waiter-border)' }}>
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--waiter-text-secondary)' }}>Instrucciones</p>
                  {notes.trim() === '' ? (
                    <p className="text-xs" style={{ color: 'var(--waiter-text-secondary)' }}>Sin instrucciones</p>
                  ) : (
                    <p className="text-xs leading-snug line-clamp-3" style={{ color: 'var(--waiter-text)' }}>{notes}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: '2px solid var(--waiter-border)' }}>
                  <p className="font-black text-sm uppercase" style={{ color: 'var(--waiter-text-secondary)' }}>Total</p>
                  <p className="font-black text-xl" style={{ color: 'var(--waiter-text)' }}>${formatoMXN(totalCost)}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--waiter-text-secondary)' }}>Cant.</p>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Disminuir cantidad" disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center rounded-[10px] border text-brand-crema/80 hover:bg-white/10 disabled:opacity-40"
                      style={{ borderColor: 'var(--waiter-border)' }}>−</button>
                    <span className="w-8 text-center font-black" style={{ color: 'var(--waiter-text)' }}>{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} aria-label="Aumentar cantidad"
                      className="w-10 h-10 flex items-center justify-center rounded-[10px] border text-brand-crema/80 hover:bg-white/10"
                      style={{ borderColor: 'var(--waiter-border)' }}>+</button>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          {/* ===== MÓVIL (<md): diseño actual intacto ===== */}
          <div className="md:hidden flex flex-col h-full min-h-0">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Product Image */}
          <div className="relative h-64 sm:h-56 bg-brand-green-dark overflow-hidden shrink-0">
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
            <span className="font-display">{esEdicion ? 'Guardar cambios' : 'Agregar a Comanda'}</span>
          </button>
        </div>
        </div>

        </>
      )}
    </ModalWrapper>
  );
};

// ===================== MODAL COMPARTIR ÍTEM =====================
// Reparto exacto: distribuye un total ENTERO (centésimas de % o centavos)
// en n partes con base igualitaria y residuo al ÚLTIMO. Σ garantizada.
// Ej. repartirExacto(10000, 3) = [3333, 3333, 3334].
const repartirExacto = (total: number, n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === n - 1 ? resto : 0));
};

// Montos en centavos para porcentajes dados (en centésimas): los primeros
// se redondean y el último absorbe el residuo. Σ === totalCents siempre.
const montosExactos = (totalCents: number, pctsCentesimas: number[]): number[] => {
  const n = pctsCentesimas.length;
  if (n === 0) return [];
  const partes: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    const c = i === n - 1
      ? totalCents - acumulado
      : Math.round((totalCents * pctsCentesimas[i]) / 10000);
    if (i !== n - 1) acumulado += c;
    partes.push(c);
  }
  return partes;
};

interface ShareItemModalProps {
  item: CarroItem;
  unitPrice: number;
  onClose: () => void;
  onConfirm: (itemId: string, sharedWith: { seat: number; porcentaje: number; monto: number }[]) => void;
  // Comensales REALES existentes en la mesa (deduplicados y ordenados, no
  // necesariamente consecutivos). El 15 sigue siendo solo el tope de creación.
  asientos: number[];
  // Etiqueta visual del comensal (solo presentación, p. ej. "C.°1 · Juan").
  // La identidad real sigue siendo `seat`. Si no hay nombre, debe ser "C.°N".
  etiquetaAsiento: (seat: number) => string;
}

const ShareItemModal: React.FC<ShareItemModalProps> = ({ item, unitPrice, onClose, onConfirm, asientos, etiquetaAsiento }) => {
  const asientosDisponibles = [...asientos].sort((a, b) => a - b);

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

  // Distribución igualitaria exacta en centésimas (el último absorbe el residuo).
  const distribuirPorcentajes = (seats: number[]): Record<number, number> => {
    const partes = repartirExacto(10000, seats.length);
    const mapa: Record<number, number> = {};
    seats.forEach((s, i) => { mapa[s] = partes[i] / 100; });
    return mapa;
  };

  const toggleSeat = (seat: number) => {
    setSeleccionados(prev => {
      if (prev.includes(seat)) {
        const next = prev.filter(s => s !== seat);
        if (next.length === 0) return prev; // al menos 1
        // Redistribuir al eliminar (100.00% siempre, aunque con 1 no sea confirmable)
        setPorcentajes(distribuirPorcentajes(next));
        return next;
      }
      // Orden ascendente solo visual; la identidad sigue siendo `seat`
      const next = [...prev, seat].sort((a, b) => a - b);
      // Reparto igualitario automático exacto al agregar
      setPorcentajes(distribuirPorcentajes(next));
      return next;
    });
  };

  const cambiarPorcentaje = (seat: number, valor: string) => {
    const num = Number(valor);
    if (isNaN(num) || num < 0 || num > 100) return;
    setPorcentajes(prev => ({ ...prev, [seat]: num }));
  };

  const totalPct = seleccionados.reduce((s, seat) => s + (porcentajes[seat] || 0), 0);
  // Validación en centésimas enteras (sin flotantes frágiles): 100.00% = 10000
  const totalCentesimas = Math.round(totalPct * 100);
  const esValido = seleccionados.length >= 2 && totalCentesimas === 10000;
  const montoTotal = unitPrice * item.quantity;
  // Vista previa con la misma fórmula de confirmación (el último absorbe el residuo)
  const montosCentsVista = montosExactos(
    Math.round(montoTotal * 100),
    seleccionados.map(seat => Math.round((porcentajes[seat] || 0) * 100))
  );

  const confirmar = () => {
    if (!esValido) {
      alert('Selecciona al menos 2 comensales y asegura que la suma de porcentajes sea 100%.');
      return;
    }
    const sharedWith = seleccionados.map((seat, idx) => ({
      seat,
      porcentaje: porcentajes[seat],
      monto: montosCentsVista[idx] / 100
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
              const etiqueta = etiquetaAsiento(seat);
              return (
                <button
                  key={seat}
                  onClick={() => toggleSeat(seat)}
                  title={etiqueta}
                  className={`py-2 px-1 rounded-xl text-sm font-bold border transition-all truncate ${activo
                    ? 'bg-purple-600 text-white border-purple-600 shadow'
                    : 'bg-white text-brand-green-dark border-brand-gold/20 hover:bg-brand-crema'
                    }`}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>

          {seleccionados.length >= 2 && (
            <div className="space-y-2 pt-2">
              <div className="border-t border-brand-gold/10 pt-3 space-y-2">
                {seleccionados.map((seat, idx) => (
                  <div key={seat} className="flex items-center gap-2">
                    <span title={etiquetaAsiento(seat)} className="min-w-0 flex-1 truncate font-bold text-sm text-brand-green-dark">{etiquetaAsiento(seat)}</span>
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
                      ${formatoMXN(montosCentsVista[idx] / 100)}
                    </span>
                  </div>
                ))}
              </div>
              <div className={`text-center text-xs font-bold ${esValido ? 'text-emerald-600' : 'text-red-500'}`}>
                {esValido ? '✓ Reparto completo (100%)' : `Suma: ${totalCentesimas / 100}% — debe ser 100%`}
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
