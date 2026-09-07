import React, { useState, useEffect, useRef } from 'react';
import { useOrders } from '../context/OrderContext';
import {
    agregarMesero,
    actualizarMesero,
    obtenerMeseroPorUsername,
    sincronizarMesasConfiguradas,
    obtenerMinicomandasConItemsPorCuentas,
    obtenerTodosLosMeseros,
    obtenerTodosLosExtras,
    agregarExtra,
    actualizarExtra,
    eliminarExtra,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    subirImagenProducto
} from '../db/SupabaseQueries';
import { useProductos } from '../hooks/useProductos';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';
import {
    DollarSign,
    CreditCard,
    ShoppingBag,
    Calendar,
    Download,
    Plus,
    Trash2,
    Edit,
    Image as ImageIcon,
    X,
    CheckCircle,
    Check,
    Clock,
    Users,
    ChefHat,
    Settings,
    UserPlus,
    UserX,
    User,
    Archive,
    RotateCcw,
    Printer,
    Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { imprimirTicketReparto } from '../utils/printer';
import { ModalWrapper } from './ModalWrapper';

interface OrderWithPayment {
    id: string;
    orderNumber: string;
    type: 'local' | 'domicilio';
    tableNumber?: string;
    waiterName?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    items: any[];
    status: 'pendiente' | 'listo' | 'entregado' | 'cobrado';
    createdAt: string;
    notes?: string;
    total: number;
    paymentMethod?: 'efectivo' | 'electronico';
    paid?: boolean;
    paymentDate?: string;
}

interface UserCredentials {
    username: string;
    password: string;
    roles: string; // Roles separados por coma: "admin,mesero,cocina,repartidor"
}

// Si está en false, se oculta toda la interfaz de pedidos a domicilio sin borrar el código.
const MODULO_DELIVERY_VISIBLE = false;

// Utilidades de fecha en zona horaria de CDMX (UTC-6)
const obtenerFechaLocalYYYYMMDD = (): string => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
};

const parsearFechaLocal = (fecha: string): Date => {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const formatearFechaLocal = (fecha: string): string =>
    parsearFechaLocal(fecha).toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

// Rango 00:00–24:00 del día en CDMX (UTC-6) expresado como instantes UTC
const obtenerRangoDiaUTC = (fecha: string): { inicio: string; fin: string } => {
    const [y, m, d] = fecha.split('-').map(Number);
    const inicio = new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0));
    const fin = new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0, 0));
    return { inicio: inicio.toISOString(), fin: fin.toISOString() };
};

export const AdminDashboard: React.FC = () => {
    const { orders, currentRole, setCurrentRole, users, saveUser, deleteUser, addNotification, resetOrders, markOrderAsPaid, updateAdminCredentials } = useOrders();
    const [employeeNombre, setEmployeeNombre] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(obtenerFechaLocalYYYYMMDD());
    const [showMenuManager, setShowMenuManager] = useState(false);
    const [orderFilter, setOrderFilter] = useState<'todos' | 'online' | 'local'>('todos');
    const prevOrdersCount = useRef(orders.length);

    // Sonido de notificación para nuevos pedidos
    useEffect(() => {
        if (orders.length > prevOrdersCount.current) {
            try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = 'sine';
                gain.gain.value = 0.3;
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
                setTimeout(() => {
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.frequency.value = 1000;
                    osc2.type = 'sine';
                    gain2.gain.value = 0.3;
                    osc2.start();
                    osc2.stop(ctx.currentTime + 0.15);
                }, 200);
            } catch (_) { /* silencioso */ }
        }
        prevOrdersCount.current = orders.length;
    }, [orders.length]);

    // Load extras
    useEffect(() => {
        const loadExtras = async () => {
            if (!isSupabaseConfigured()) {
                setExtras([]);
                return;
            }
            setExtrasLoading(true);
            try {
                const data = await obtenerTodosLosExtras();
                setExtras(data || []);
            } catch (error) {
                console.error('Error loading extras:', error);
            }
            setExtrasLoading(false);
        };
        loadExtras();
    }, []);
    
    const [showUserManager, setShowUserManager] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showEmployeeManager, setShowEmployeeManager] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showCorteModal, setShowCorteModal] = useState(false);
    const [showExtrasManager, setShowExtrasManager] = useState(false);
    const [selectedOrderForCheckout, setSelectedOrderForCheckout] = useState<any>(null);
    const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'efectivo' | 'electronico'>('efectivo');
    const [configUsername, setConfigUsername] = useState('');
    const [configPassword, setConfigPassword] = useState('');
    const [configConfirmPassword, setConfigConfirmPassword] = useState('');
    const [configTables, setConfigTables] = useState(localStorage.getItem('elbuencafe_table_count') || '15');
    const [employeeUsername, setEmployeeUsername] = useState('');
    const [employeePassword, setEmployeePassword] = useState('');
    const [employeeRoles, setEmployeeRoles] = useState<string[]>(['mesero']);
    const [editingUser, setEditingUser] = useState<UserCredentials | null>(null);
    const [editRolesMap, setEditRolesMap] = useState<Record<string, string[]>>({});
    const [localSales, setLocalSales] = useState<any[]>([]);
    const [localSalesLoading, setLocalSalesLoading] = useState(false);

    // Extras state
    const [extras, setExtras] = useState<any[]>([]);
    const [extrasLoading, setExtrasLoading] = useState(false);
    const [newExtraNombre, setNewExtraNombre] = useState('');
    const [newExtraPrecio, setNewExtraPrecio] = useState(25);
    const [editingExtra, setEditingExtra] = useState<any>(null);

    // Cargar cuentas de meseros (ABIERTAS + COBRADAS) en la fecha seleccionada
    useEffect(() => {
        const fetchLocalSales = async () => {
            if (!isSupabaseConfigured()) {
                setLocalSales([]);
                return;
            }
            setLocalSalesLoading(true);
            try {
                const { inicio: fechaInicio, fin: fechaFin } = obtenerRangoDiaUTC(selectedDate);

                const { data: cuentas } = await supabase
                    .from('cuentas')
                    .select('*, mesas!inner(numero)')
                    .gte('fecha_apertura', fechaInicio)
                    .lte('fecha_apertura', fechaFin)
                    .order('fecha_apertura', { ascending: false });

                if (!cuentas) { setLocalSales([]); return; }

                const cuentaIds = cuentas.map((c: any) => c.id);
                const minicomandasConItems = await obtenerMinicomandasConItemsPorCuentas(cuentaIds);
                const meseros = await obtenerTodosLosMeseros();

                const converted = cuentas.map((cuenta: any) => {
                    const mesero = meseros.find((m: any) => m.id === cuenta.mesero_id);
                    const minis = minicomandasConItems.filter((m: any) => m.cuenta_id === cuenta.id);
                    const items = minis.flatMap((mini: any) =>
                        (mini.items_minicomanda || []).map((item: any) => ({
                            product: { name: item.producto_id, price: item.precio_unitario },
                            quantity: item.cantidad,
                            notes: item.notas || '',
                            selectedOptions: []
                        }))
                    );

                    // Respaldo: si la cuenta no guardó total, se calcula desde sus ítems
                    const totalDesdeItems = items.reduce((sum: number, item: any) => sum + (item.product.price || 0) * (item.quantity || 0), 0);

                    let status: 'pendiente' | 'listo' | 'entregado' | 'cobrado';
                    if (cuenta.estado === 'COBRADA') {
                        status = 'cobrado';
                    } else if (minis.length > 0 && minis.every((m: any) => m.estado === 'LISTO' || m.estado === 'ENTREGADO')) {
                        status = 'listo';
                    } else if (minis.length > 0) {
                        status = 'pendiente';
                    } else {
                        status = 'pendiente';
                    }

                    return {
                        id: `local_${cuenta.id}`,
                        orderNumber: `M-${cuenta.id}`,
                        type: 'local' as const,
                        tableNumber: cuenta.mesas?.numero || String(cuenta.mesa_id),
                        waiterName: mesero?.nombre || `Mesero #${cuenta.mesero_id}`,
                        customerName: mesero?.nombre || `Mesero #${cuenta.mesero_id}`,
                        items,
                        status,
                        createdAt: cuenta.fecha_apertura,
                        total: cuenta.total_pagado || cuenta.total_acumulado || totalDesdeItems,
                        paymentMethod: cuenta.metodo_pago || 'efectivo',
                        paid: cuenta.estado === 'COBRADA',
                        paymentDate: cuenta.fecha_cierre
                    };
                });
                setLocalSales(converted);
            } catch (error) {
                console.error('Error fetching local sales:', error);
                setLocalSales([]);
            }
            setLocalSalesLoading(false);
        };
        fetchLocalSales();
    }, [selectedDate]);

    // Solo admin puede gestionar menú y usuarios
    const canManageMenu = currentRole === 'admin';
    const canManageUsers = currentRole === 'admin';

    // Filter orders by date
    const getOrdersByDate = (date: string) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        return orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.getTime() === targetDate.getTime();
        });
    };

    const onlineDailyOrders = MODULO_DELIVERY_VISIBLE ? getOrdersByDate(selectedDate) : [];
    const dailyOrders = [...onlineDailyOrders, ...localSales];

    // Filter only paid orders for reconciliation
    const paidOrders = dailyOrders.filter(order => order.paid || order.status === 'cobrado');

    // Calculate statistics for ALL daily orders (for stats cards)
    const dailyStats = dailyOrders.reduce((acc, order) => {
        const paymentMethod = order.paymentMethod || 'efectivo';
        acc.total += order.total;
        acc[paymentMethod] += order.total;
        acc.count++;
        return acc;
    }, { total: 0, efectivo: 0, electronico: 0, count: 0 });

    // Calculate paid-only statistics (for reconciliation)
    const paidStats = paidOrders.reduce((acc, order) => {
        const paymentMethod = order.paymentMethod || 'efectivo';
        acc.total += order.total;
        acc[paymentMethod] += order.total;
        acc.count++;
        return acc;
    }, { total: 0, efectivo: 0, electronico: 0, count: 0 });

    // Calculate difference (for physical money reconciliation)
    const [physicalCash, setPhysicalCash] = useState<string>('');
    const difference = parseFloat(physicalCash || '0') - paidStats.efectivo;

    const handleDownloadReport = () => {
        const reportDate = new Date(selectedDate).toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let report = `═══════════════════════════════════════════════════════════════
              REPORTE DE VENTAS - EL BUEN CAFÉ
═══════════════════════════════════════════════════════════════
Fecha: ${reportDate}
Generado: ${new Date().toLocaleString('es-MX')}
═══════════════════════════════════════════════════════════════

📊 RESUMEN DE VENTAS
───────────────────────────────────────────────────────────────
Total de Ventas:      $${dailyStats.total.toFixed(2)}
Cantidad de Ventas:  ${dailyStats.count}
───────────────────────────────────────────────────────────────

💰 MÉTODO DE PAGO
───────────────────────────────────────────────────────────────
Efectivo:             $${dailyStats.efectivo.toFixed(2)}
Electrónico:          $${dailyStats.electronico.toFixed(2)}
───────────────────────────────────────────────────────────────

⚖️ COTEJO DE EFECTIVO
───────────────────────────────────────────────────────────────
Dinero Físico:        $${parseFloat(physicalCash || '0').toFixed(2)}
Reportado:            $${dailyStats.efectivo.toFixed(2)}
Diferencia:           $${difference.toFixed(2)}
───────────────────────────────────────────────────────────────

📋 DETALLE DE PEDIDOS
───────────────────────────────────────────────────────────────
`;

        dailyOrders.forEach(order => {
            const paymentMethod = order.paymentMethod || 'efectivo';
            const paymentIcon = paymentMethod === 'efectivo' ? '💵' : '💳';

            report += `
Venta #${order.orderNumber} - ${paymentIcon} ${paymentMethod.toUpperCase()}
Tipo: ${order.type === 'local' ? 'Mesa ' + (order.tableNumber || 'N/A') : 'Domicilio'}
Cliente: ${order.customerName || order.waiterName || 'N/A'}
Método: ${paymentMethod === 'efectivo' ? 'Efectivo' : 'Electrónico'}
───────────────────────────────────────────────────────────────
`;
            order.items.forEach((item: any) => {
                const optionExtra = item.selectedOptions.reduce((sum: number, opt: any) => sum + opt.extraPrice, 0);
                const itemPrice = (item.product.price + optionExtra) * item.quantity;
                report += `  • ${item.product.name} (x${item.quantity}) - $${itemPrice.toFixed(2)}\n`;
                if (item.selectedOptions.length > 0) {
                    item.selectedOptions.forEach((opt: any) => {
                        report += `    - ${opt.choiceName}\n`;
                    });
                }
                if (item.notes) {
                    report += `    Notas: ${item.notes}\n`;
                }
            });
            report += `TOTAL: $${order.total.toFixed(2)}\n`;
            report += `───────────────────────────────────────────────────────────────\n`;
        });

        report += `
═══════════════════════════════════════════════════════════════
              FIN DEL REPORTE
═══════════════════════════════════════════════════════════════
`;

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_ventas_${selectedDate}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLogout = () => {
        setCurrentRole('cliente');
    };

    const handleCorteCaja = () => {
        // Archive current orders before resetting
        const archiveKey = `elbuencafe_orders_archive_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const archiveData = {
            date: new Date().toISOString(),
            orders: dailyOrders,
            stats: {
                total: dailyStats.total,
                efectivo: dailyStats.efectivo,
                electronico: dailyStats.electronico,
                count: dailyStats.count,
                paidCount: paidOrders.length,
                paidTotal: paidStats.total,
                paidEfectivo: paidStats.efectivo,
                paidElectronico: paidStats.electronico
            }
        };
        localStorage.setItem(archiveKey, JSON.stringify(archiveData));

        // Also save to a cortes index for history
        const cortesIndex = JSON.parse(localStorage.getItem('elbuencafe_cortes_index') || '[]');
        cortesIndex.push({
            key: archiveKey,
            date: archiveData.date,
            total: dailyStats.total,
            count: dailyStats.count
        });
        localStorage.setItem('elbuencafe_cortes_index', JSON.stringify(cortesIndex));

        // Reset orders
        resetOrders();
        setShowCorteModal(false);
        setPhysicalCash('');
    };

    return (
        <div className="min-h-screen bg-brand-crema-light pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-green-dark via-brand-green to-brand-green-dark text-brand-crema py-6 px-4 shadow-xl">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Panel de Administración</h1>
                        <p className="text-brand-crema/60 text-sm">El Buen Café - Restaurante Gourmet</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-wider">Fecha</p>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-brand-crema/20 border border-brand-gold/30 rounded-lg px-3 py-1.5 text-sm text-brand-crema focus:outline-none focus:border-brand-gold/50"
                            />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white rounded-2xl p-5 shadow-lg border border-brand-gold/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-brand-gold/10 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-brand-gold" />
                            </div>
                            <div>
                                <p className="text-xs text-brand-warm-gray/60 uppercase font-bold">Ventas Totales</p>
                                <p className="text-2xl font-bold text-brand-green-dark">${dailyStats.total.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white rounded-2xl p-5 shadow-lg border border-brand-gold/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-brand-green" />
                            </div>
                            <div>
                                <p className="text-xs text-brand-warm-gray/60 uppercase font-bold">Cuentas</p>
                                <p className="text-2xl font-bold text-brand-green-dark">{dailyStats.count}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white rounded-2xl p-5 shadow-lg border border-brand-gold/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <p className="text-xs text-brand-warm-gray/60 uppercase font-bold">Efectivo</p>
                                <p className="text-2xl font-bold text-red-500">${dailyStats.efectivo.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white rounded-2xl p-5 shadow-lg border border-brand-gold/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-brand-warm-gray/60 uppercase font-bold">Electrónico</p>
                                <p className="text-2xl font-bold text-blue-500">${dailyStats.electronico.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Reconciliation Section */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="bg-white rounded-2xl p-6 shadow-lg border border-brand-gold/10 mb-6"
                >
                    <h3 className="text-lg font-bold text-brand-green-dark mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-brand-gold" />
                        Cotejo de Efectivo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-2 block">
                                Dinero Físico (Caja)
                            </label>
                            <input
                                type="number"
                                value={physicalCash}
                                onChange={(e) => setPhysicalCash(e.target.value)}
                                className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-lg font-bold text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                placeholder="Ingresa el dinero físico"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-2 block">
                                Reportado en App
                            </label>
                            <div className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-lg font-bold text-red-500">
                                ${paidStats.efectivo.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-2 block">
                                Diferencia
                            </label>
                            <div className={`w-full rounded-lg px-4 py-3 text-lg font-bold ${difference === 0 ? 'bg-green-500/10 text-green-600' : difference > 0 ? 'bg-red-500/10 text-red-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                                ${difference.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Gestionar Menú - Solo visible para admin */}
                    {canManageMenu && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowMenuManager(true)}
                            className="bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-6 rounded-2xl shadow-lg shadow-brand-gold/20 flex flex-col items-center justify-center gap-3 transition-all"
                        >
                            <ChefHat className="w-8 h-8" />
                            <span>Gestionar Menú</span>
                        </motion.button>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowReport(true)}
                        className="bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-brand-crema font-bold py-6 rounded-2xl shadow-lg shadow-brand-green/20 flex flex-col items-center justify-center gap-3 transition-all"
                    >
                        <Download className="w-8 h-8" />
                        <span>Descargar Reporte</span>
                    </motion.button>

                    {/* Configuración - Solo visible para admin */}
                    {canManageUsers && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                // Cargar credenciales actuales del admin
                                const adminUser = users.find(u => u.roles.includes('admin'));
                                if (adminUser) {
                                    setConfigUsername(adminUser.username);
                                    setConfigPassword('');
                                    setConfigConfirmPassword('');
                                }
                                setShowConfigModal(true);
                            }}
                            className="bg-gradient-to-r from-brand-crema-dark to-brand-warm-gray hover:from-brand-crema hover:to-brand-warm-gray/80 text-brand-green-dark font-bold py-6 rounded-2xl shadow-lg shadow-brand-warm-gray/20 flex flex-col items-center justify-center gap-3 transition-all"
                        >
                            <Settings className="w-8 h-8" />
                            <span>Configuración</span>
                        </motion.button>
                    )}

                    {/* Gestionar Empleados - Solo visible para admin */}
                    {canManageUsers && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowEmployeeManager(true)}
                            className="bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-brand-crema font-bold py-6 rounded-2xl shadow-lg shadow-brand-green/20 flex flex-col items-center justify-center gap-3 transition-all"
                        >
                            <Users className="w-8 h-8" />
                            <span>Gestionar Empleados</span>
                        </motion.button>
                    )}

                    {/* Gestionar Extras - Solo visible para admin */}
                    {canManageUsers && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowExtrasManager(true)}
                            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-pink-500/20 flex flex-col items-center justify-center gap-3 transition-all"
                        >
                            <Plus className="w-8 h-8" />
                            <span>Extras</span>
                        </motion.button>
                    )}

                    {/* Corte de Caja - Solo visible para admin */}
                    {canManageUsers && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowCorteModal(true)}
                            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-red-500/20 flex flex-col items-center justify-center gap-3 transition-all"
                        >
                            <Archive className="w-8 h-8" />
                            <span>Corte de Caja</span>
                        </motion.button>
                    )}
                </div>

                {/* Daily Orders List */}
                <div className="bg-white rounded-2xl shadow-lg border border-brand-gold/10 overflow-hidden">
                    <div className="bg-brand-green-dark/5 px-6 py-4 border-b border-brand-gold/10">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-brand-green-dark flex items-center gap-2">
                                <Clock className="w-5 h-5 text-brand-gold" />
                                Ventas del Día ({dailyOrders.length})
                            </h3>
                            <span className="text-xs text-brand-warm-gray/60 uppercase font-bold">
                                Ventas Contabilizadas: {paidOrders.length}
                            </span>
                        </div>
                        {/* Filtros (visibles solo con módulo de delivery activo) */}
                        {MODULO_DELIVERY_VISIBLE && (
                        <div className="flex gap-2">
                            {(['todos', 'online', 'local'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setOrderFilter(f)}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider transition-all ${orderFilter === f
                                        ? 'bg-brand-gold text-brand-green-dark shadow-sm'
                                        : 'bg-brand-crema-dark/10 text-brand-warm-gray/60 hover:bg-brand-crema-dark/20'
                                        }`}
                                >
                                    {f === 'todos' ? 'Todos' : f === 'online' ? 'Delivery' : 'Local'}
                                </button>
                            ))}
                        </div>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {(() => {
                            const filtered = dailyOrders.filter(o => {
                                if (orderFilter === 'online') return o.type === 'domicilio';
                                if (orderFilter === 'local') return o.type === 'local';
                                return true;
                            });
                            return filtered.length === 0 ? (
                                <div className="p-12 text-center text-brand-warm-gray/50">
                                    <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p>No hay ventas registradas para esta fecha</p>
                                </div>
                            ) : filtered.map((order) => {
                                const paymentMethod = order.paymentMethod || 'efectivo';
                                const paymentIcon = paymentMethod === 'efectivo' ? '💵' : '💳';
                                const paymentLabel = paymentMethod === 'efectivo' ? 'Efectivo' : 'Electrónico';
                                const isPaid = order.paid || order.status === 'cobrado';
                                const paidIcon = isPaid ? '✅' : '⏳';
                                const paidLabel = isPaid ? 'Cobrado' : 'Pendiente';

                                return (
                                    <div key={order.id} className="px-6 py-4 border-b border-brand-gold/5 last:border-0 hover:bg-brand-crema/30 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-brand-gold text-brand-green-dark text-xs font-bold px-2 py-1 rounded">
                                                    #{order.orderNumber}
                                                </span>
                                                <span className="text-xs text-brand-warm-gray/60 uppercase font-bold">
                                                    {MODULO_DELIVERY_VISIBLE && order.type === 'domicilio' ? 'Domicilio' : 'Mesa ' + (order.tableNumber || 'N/A')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${paymentMethod === 'efectivo' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                    {paymentIcon} {paymentLabel}
                                                </span>
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${isPaid ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                                    {paidIcon} {paidLabel}
                                                </span>
                                                <span className="text-sm font-bold text-brand-green-dark">
                                                    ${order.total.toFixed(2)}
                                                </span>
                                                {!isPaid && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedOrderForCheckout(order);
                                                            setCheckoutPaymentMethod('efectivo');
                                                            setShowCheckoutModal(true);
                                                        }}
                                                        className="bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark text-xs font-bold px-3 py-1.5 rounded-lg shadow-md transition-all"
                                                    >
                                                        Checkout
                                                    </button>
                                                )}
                                                {MODULO_DELIVERY_VISIBLE && order.type === 'domicilio' && (
                                                    <button
                                                        onClick={() => {
                                                            imprimirTicketReparto({
                                                                restaurantName: 'EL BUEN CAFÉ',
                                                                orderNumber: order.orderNumber,
                                                                customerName: order.customerName || 'Cliente',
                                                                customerPhone: order.customerPhone || '',
                                                                address: order.address || '',
                                                                items: order.items.map((i: any) => ({
                                                                    name: i.product?.name || 'Producto',
                                                                    quantity: i.quantity,
                                                                    price: i.product?.price || 0,
                                                                    notes: i.notes
                                                                })),
                                                                total: order.total,
                                                                metodoPago: paymentMethod === 'efectivo' ? 'EFECTIVO' : 'TARJETA',
                                                                deliveryCharge: order.deliveryCharge || 0,
                                                                fecha: new Date().toLocaleString('es-MX')
                                                            });
                                                        }}
                                                        className="text-brand-green-dark bg-brand-gold/20 hover:bg-brand-gold/30 text-xs font-bold px-2 py-1.5 rounded-lg border border-brand-gold/30 transition-all flex items-center gap-1"
                                                        title="Imprimir ticket de reparto"
                                                    >
                                                        <Printer className="w-3 h-3" />
                                                        Ticket
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-brand-warm-gray/60">
                                            {order.customerName && <span className="mr-4">Cliente: {order.customerName}</span>}
                                            {order.customerPhone && <span className="mr-4">Tel: {order.customerPhone}</span>}
                                            {order.address && <span>Dir: {order.address}</span>}
                                        </div>
                                    </div>
                                );
                            })
                        })()}
                    </div>
                </div>
            </div>

            {/* Menu Manager Modal */}
            <AnimatePresence>
                {showMenuManager && (
                    <AdminMenuManager onClose={() => setShowMenuManager(false)} />
                )}
            </AnimatePresence>

            {/* Report Modal */}
            <ModalWrapper
                isOpen={showReport}
                cardClass="bg-brand-crema-light w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
                {() => (
                    <>
                        <div className="bg-gradient-to-r from-brand-green-dark to-brand-green p-6 text-brand-crema">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Reporte de Ventas</h2>
                                <button
                                    onClick={() => setShowReport(false)}
                                    className="text-brand-crema/70 hover:text-brand-crema"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="text-center mb-6">
                                <p className="text-sm text-brand-warm-gray/60">Fecha: {formatearFechaLocal(selectedDate)}</p>
                                <p className="text-sm text-brand-warm-gray/60">Generado: {new Date().toLocaleString('es-MX')}</p>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Resumen de Ventas</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-brand-warm-gray/50">Ventas Totales</p>
                                            <p className="text-xl font-bold text-brand-green-dark">${dailyStats.total.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-brand-warm-gray/50">Cuentas</p>
                                            <p className="text-xl font-bold text-brand-green-dark">{dailyStats.count}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Método de Pago</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-red-500/10 p-3 rounded-lg">
                                            <p className="text-xs text-red-500/70 mb-1">Efectivo</p>
                                            <p className="text-xl font-bold text-red-500">${dailyStats.efectivo.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-blue-500/10 p-3 rounded-lg">
                                            <p className="text-xs text-blue-500/70 mb-1">Electrónico</p>
                                            <p className="text-xl font-bold text-blue-500">${dailyStats.electronico.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Cotejo de Efectivo</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-brand-warm-gray/50">Dinero Físico</p>
                                            <p className="text-lg font-bold text-brand-green-dark">${parseFloat(physicalCash || '0').toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-brand-warm-gray/50">Reportado</p>
                                            <p className="text-lg font-bold text-red-500">${dailyStats.efectivo.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-brand-warm-gray/50">Diferencia</p>
                                            <p className={`text-lg font-bold ${difference === 0 ? 'text-green-600' : difference > 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                                                ${difference.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Detalles de Pedidos</h3>
                                    <div className="space-y-4 max-h-60 overflow-y-auto">
                                        {dailyOrders.map((order) => (
                                            <div key={order.id} className="border-b border-brand-gold/10 pb-3 last:border-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-brand-gold">#{order.orderNumber}</span>
                                                    <span className="text-xs text-brand-warm-gray/60">{order.type === 'local' ? 'Mesa ' + order.tableNumber : 'Domicilio'}</span>
                                                </div>
                                                <div className="text-xs text-brand-warm-gray/60 space-y-1">
                                                    {order.items.map((item: any, idx: number) => {
                                                        const optionExtra = item.selectedOptions.reduce((sum: number, opt: any) => sum + opt.extraPrice, 0);
                                                        const itemPrice = (item.product.price + optionExtra) * item.quantity;
                                                        return (
                                                            <div key={idx}>
                                                                • {item.product.name} (x{item.quantity}) - ${itemPrice.toFixed(2)}
                                                                {item.selectedOptions.map((opt: any) => (
                                                                    <span key={opt.choiceName} className="ml-2 text-brand-warm-gray/40">[{opt.choiceName}]</span>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-sm font-bold text-brand-green-dark mt-2 text-right">
                                                    TOTAL: ${order.total.toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleDownloadReport}
                                className="w-full mt-6 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                <span>Descargar Reporte</span>
                            </button>
                        </div>
                    </>
                )}
            </ModalWrapper>

            {/* Configuración Modal */}
            <ModalWrapper
                isOpen={showConfigModal}
                cardClass="bg-brand-crema-light w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
                {() => (
                    <>
                        <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-6 text-brand-green-dark">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Configuración de Credenciales</h2>
                                    <button
                                        onClick={() => setShowConfigModal(false)}
                                        className="text-brand-green-dark/70 hover:text-brand-green-dark"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                        Usuario Actual
                                    </label>
                                    <input
                                        type="text"
                                        value={configUsername}
                                        onChange={(e) => setConfigUsername(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="admin"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                        Nueva Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={configPassword}
                                        onChange={(e) => setConfigPassword(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                        Confirmar Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={configConfirmPassword}
                                        onChange={(e) => setConfigConfirmPassword(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="••••••••"
                                    />
                                </div>
                                {configPassword !== configConfirmPassword && configConfirmPassword !== '' && (
                                    <p className="text-red-500 text-xs">Las contraseñas no coinciden</p>
                                )}
                                <div>
                                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block mt-2">
                                        Número de Mesas
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={configTables}
                                        onChange={(e) => setConfigTables(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-4 py-3 text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                    />
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfigModal(false)}
                                        className="flex-1 bg-brand-crema-dark text-brand-warm-gray font-bold py-3 rounded-lg hover:bg-brand-crema"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (configPassword !== configConfirmPassword) {
                                                alert('Las contraseñas no coinciden');
                                                return;
                                            }
                                            if (configUsername && configPassword) {
                                                try {
                                                    await updateAdminCredentials(configUsername, configPassword);
                                                    addNotification('✅ Credenciales guardadas exitosamente');
                                                } catch (err) {
                                                    console.error('Error al guardar credenciales:', err);
                                                    addNotification('❌ Error al guardar credenciales');
                                                }
                                            }
                                            localStorage.setItem('elbuencafe_table_count', configTables);
                                            try {
                                                await sincronizarMesasConfiguradas(parseInt(configTables));
                                            } catch (err) {
                                                console.error('Error sincronizando mesas:', err);
                                            }
                                            window.dispatchEvent(new CustomEvent('reload_tables'));
                                            addNotification('✅ Configuración guardada');
                                            setShowConfigModal(false);
                                        }}
                                        className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark font-bold py-3 rounded-lg"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </ModalWrapper>

                {/* Gestión de Empleados Modal */}
                <ModalWrapper
                    isOpen={showEmployeeManager}
                    cardClass="bg-brand-crema-light w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {() => (
                        <>
                            <div className="bg-gradient-to-r from-brand-green-dark to-brand-green p-6 text-brand-crema">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Gestión de Empleados</h2>
                                    <button
                                        onClick={() => setShowEmployeeManager(false)}
                                        className="text-brand-crema/70 hover:text-brand-crema"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                {/* Add Employee Form */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl mb-6">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-4 flex items-center gap-2">
                                        <UserPlus className="w-4 h-4 text-brand-gold" />
                                        Agregar Nuevo Empleado
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                                Usuario
                                            </label>
                                            <input
                                                type="text"
                                                value={employeeUsername}
                                                onChange={(e) => setEmployeeUsername(e.target.value)}
                                                className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                                                placeholder="Nombre de usuario"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                                Contraseña
                                            </label>
                                            <input
                                                type="password"
                                                value={employeePassword}
                                                onChange={(e) => setEmployeePassword(e.target.value)}
                                                className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                                Rol
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {['mesero', 'cocina', 'repartidor'].map(rol => (
                                                    <label key={rol} className="flex items-center gap-1 text-sm cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={employeeRoles.includes(rol)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setEmployeeRoles([...employeeRoles, rol]);
                                                                } else {
                                                                    setEmployeeRoles(employeeRoles.filter(r => r !== rol));
                                                                }
                                                            }}
                                                            className="accent-brand-gold"
                                                        />
                                                        <span className="text-brand-green-dark capitalize">{rol}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <input
                                            type="text"
                                            value={employeeNombre}
                                            onChange={(e) => setEmployeeNombre(e.target.value)}
                                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg py-2 px-3 text-sm text-brand-green-dark focus:outline-none focus:border-brand-gold mb-2"
                                            placeholder="Nombre del empleado"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (employeeNombre && employeeUsername && employeePassword) {
                                                    // Verificar si ya existe en Supabase (usuarios_sistema)
                                                    const existingInUsers = users.find(u => u.username.toLowerCase() === employeeUsername.toLowerCase());
                                                    if (existingInUsers) {
                                                        alert('El usuario ya existe en el sistema');
                                                        return;
                                                    }

                                                    // Guardar en Supabase + localStorage (OrderContext)
                                                    const newUser: UserCredentials = {
                                                        username: employeeUsername,
                                                        password: employeePassword,
                                                        roles: employeeRoles.join(',')
                                                    };
                                                    await saveUser(newUser);

                                                    // También guardar en tabla meseros (AccountContext)
                                                    try {
                                                        await agregarMesero({
                                                            nombre: employeeNombre,
                                                            username: employeeUsername,
                                                            password_hash: employeePassword,
                                                            rol: employeeRoles.join(','),
                                                            activo: true
                                                        });
                                                    } catch (error) {
                                                        console.error('Error al agregar mesero:', error);
                                                        // No bloqueamos - el usuario ya se guardó en usuarios_sistema
                                                    }

                                                    addNotification(`✅ Empleado ${employeeNombre} agregado exitosamente`);
                                                    setEmployeeNombre('');
                                                    setEmployeeUsername('');
                                                    setEmployeePassword('');
                                                    setEmployeeRoles(['mesero']);
                                                } else {
                                                    alert('Por favor completa todos los campos');
                                                }
                                            }}
                                            className="w-full bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <UserPlus className="w-5 h-5" />
                                            <span>Agregar Empleado</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Employees List */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-2">
                                        Lista de Empleados ({users.length})
                                    </h3>
                                    {users.length === 0 ? (
                                        <div className="text-center py-8 text-brand-warm-gray/50">
                                            <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>No hay empleados registrados</p>
                                        </div>
                                    ) : (
                                        users.map(user => (
                                            <React.Fragment key={user.username}>
                                                <div className="bg-white rounded-xl p-4 border border-brand-gold/10 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.roles.includes('admin') ? 'bg-brand-gold/20 text-brand-gold' :
                                                            user.roles.includes('mesero') ? 'bg-blue-500/20 text-blue-500' :
                                                                user.roles.includes('cocina') ? 'bg-orange-500/20 text-orange-500' :
                                                                    'bg-purple-500/20 text-purple-500'
                                                            }`}>
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-brand-green-dark">{user.username}</p>
                                                            <p className="text-xs text-brand-warm-gray/60 uppercase font-bold">
                                                                {user.roles.includes('admin') ? 'Administrador' : user.roles.includes('mesero') && user.roles.includes('cocina') ? 'Mesero/Cocina' : user.roles.includes('mesero') ? 'Mesero' : user.roles.includes('cocina') ? 'Cocina' : 'Repartidor'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {!user.roles.includes('admin') && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`¿Estás seguro de eliminar al usuario ${user.username}?`)) {
                                                                        deleteUser(user.username);
                                                                        try {
                                                                            const { error } = await supabase.from('usuarios_sistema').delete().eq('username', user.username);
                                                                            if (error) console.error('Error al eliminar de Supabase:', error);
                                                                        } catch (err) {
                                                                            console.error('Error al eliminar usuario:', err);
                                                                        }
                                                                        addNotification(`❌ Usuario ${user.username} eliminado`);
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-500/10"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                if (editingUser?.username === user.username) {
                                                                    setEditingUser(null);
                                                                } else {
                                                                    setEditingUser(user);
                                                                }
                                                            }}
                                                            className={`p-2 rounded-lg transition-colors ${editingUser?.username === user.username ? 'bg-brand-gold/20 text-brand-gold' : 'text-brand-gold hover:text-brand-gold-dark hover:bg-brand-gold/10'}`}
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Panel de edición de roles */}
                                                {editingUser?.username === user.username && (
                                                    <div className="mt-4 pt-4 border-t border-brand-gold/10 space-y-3">
                                                        <p className="text-xs font-bold uppercase text-brand-warm-gray/60">Editar Roles:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['mesero', 'cocina', 'repartidor'].map(rol => {
                                                                const currentRoles = editRolesMap[user.username] || user.roles.split(',').filter((r: string) => r);
                                                                return (
                                                                    <label key={rol} className="flex items-center gap-1 text-sm cursor-pointer bg-brand-crema-dark/5 px-3 py-1.5 rounded-lg">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={currentRoles.includes(rol)}
                                                                            onChange={(e) => {
                                                                                const newRoles = e.target.checked
                                                                                    ? [...currentRoles, rol]
                                                                                    : currentRoles.filter((r: string) => r !== rol);
                                                                                setEditRolesMap(prev => ({ ...prev, [user.username]: newRoles }));
                                                                            }}
                                                                            className="accent-brand-gold"
                                                                        />
                                                                        <span className="text-brand-green-dark capitalize">{rol}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                const rolesToSave = (editRolesMap[user.username] || user.roles.split(',').filter((r: string) => r)).join(',');

                                                                const updatedUsers = users.map((u: any) =>
                                                                    u.username === user.username
                                                                        ? { ...u, roles: rolesToSave }
                                                                        : u
                                                                );
                                                                localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));

                                                                try {
                                                                    const { error } = await supabase.from('usuarios_sistema').update({ roles: rolesToSave }).eq('username', user.username);
                                                                    if (error) console.error('Error al actualizar en Supabase:', error);
                                                                    // También actualizar en tabla meseros para sincronización completa
                                                                    const { error: error2 } = await supabase.from('meseros').update({ rol: rolesToSave }).eq('username', user.username);
                                                                    if (error2) console.error('Error al actualizar mesero:', error2);
                                                                } catch (err) {
                                                                    console.error('Error al actualizar usuario:', err);
                                                                }

                                                                addNotification(`✅ Roles de ${user.username} actualizados a: ${rolesToSave}`);
                                                                setEditingUser(null);
                                                                setEditRolesMap({});
                                                            }}
                                                            className="w-full bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark font-bold py-2 rounded-lg text-sm"
                                                        >
                                                            💾 Guardar Roles
                                                        </button>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </ModalWrapper>

                {/* Extras Manager Modal */}
                <ModalWrapper
                    isOpen={showExtrasManager}
                    cardClass="bg-brand-crema-light w-full max-w-2xl rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
                >
                    {() => (
                        <>
                            <div className="bg-gradient-to-r from-pink-500 to-pink-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Gestión de Extras</h2>
                                    <button
                                        onClick={() => setShowExtrasManager(false)}
                                        className="text-white/70 hover:text-white"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                {/* Add Extra Form */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl mb-6">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-4 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-pink-500" />
                                        Agregar Extra
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                                Nombre
                                            </label>
                                            <input
                                                type="text"
                                                value={newExtraNombre}
                                                onChange={(e) => setNewExtraNombre(e.target.value)}
                                                className="w-full bg-brand-crema border border-pink-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                                                placeholder="Ej. Tocino"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">
                                                Precio
                                            </label>
                                            <input
                                                type="number"
                                                value={newExtraPrecio}
                                                onChange={(e) => setNewExtraPrecio(Number(e.target.value))}
                                                className="w-full bg-brand-crema border border-pink-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                                                placeholder="25"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (newExtraNombre && newExtraPrecio > 0) {
                                                        try {
                                                            await agregarExtra({
                                                                nombre: newExtraNombre,
                                                                precio: newExtraPrecio,
                                                                activo: true
                                                            });
                                                            addNotification(`✅ Extra "${newExtraNombre}" agregado`);
                                                            setNewExtraNombre('');
                                                            setNewExtraPrecio(25);
                                                            // Refresh extras
                                                            const data = await obtenerTodosLosExtras();
                                                            setExtras(data || []);
                                                        } catch (error) {
                                                            console.error('Error adding extra:', error);
                                                        }
                                                    } else {
                                                        alert('Completa nombre y precio');
                                                    }
                                                }}
                                                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold py-2 rounded-lg text-sm"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Extras List */}
                                <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">
                                    Extras Registrados ({extras.length})
                                </h3>
                                {extrasLoading ? (
                                    <div className="text-center py-8 text-brand-warm-gray/50">
                                        Cargando...
                                    </div>
                                ) : extras.length === 0 ? (
                                    <div className="text-center py-8 text-brand-warm-gray/50">
                                        <Plus className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>No hay extras registrados</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {extras.map((extra: any) => (
                                            <div
                                                key={extra.id}
                                                className="bg-brand-crema-dark/5 p-3 rounded-xl flex items-center justify-between hover:bg-brand-crema-dark/10 transition-colors"
                                            >
                                                <div>
                                                    <span className="font-bold text-brand-green-dark">{extra.nombre}</span>
                                                    <span className="text-xs text-brand-warm-gray/60 ml-2">
                                                        +${extra.precio.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {editingExtra?.id === extra.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={editingExtra.precio}
                                                                onChange={(e) => setEditingExtra({ ...editingExtra, precio: Number(e.target.value) })}
                                                                className="w-16 bg-brand-crema border border-pink-500/20 rounded px-2 py-1 text-sm"
                                                            />
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await actualizarExtra(editingExtra);
                                                                        addNotification(`✅ Extra actualizado`);
                                                                        setEditingExtra(null);
                                                                        const data = await obtenerTodosLosExtras();
                                                                        setExtras(data || []);
                                                                    } catch (error) {
                                                                        console.error('Error updating extra:', error);
                                                                    }
                                                                }}
                                                                className="text-green-500 hover:text-green-600"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingExtra(null)}
                                                                className="text-red-500 hover:text-red-600"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingExtra(extra)}
                                                                className="text-brand-warm-gray/60 hover:text-brand-green-dark"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`¿Eliminar "${extra.nombre}"?`)) {
                                                                        try {
                                                                            await eliminarExtra(extra.id);
                                                                            addNotification(`❌ Extra eliminado`);
                                                                            const data = await obtenerTodosLosExtras();
                                                                            setExtras(data || []);
                                                                        } catch (error) {
                                                                            console.error('Error deleting extra:', error);
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-600"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </ModalWrapper>

{/* Checkout Modal */}
                <ModalWrapper
                    isOpen={showCheckoutModal && !!selectedOrderForCheckout}
                    cardClass="bg-brand-crema-light w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    {() => (
                        <>
                            <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-6 text-brand-green-dark">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Checkout - Generar Cuenta</h2>
                                    <button
                                        onClick={() => {
                                            setShowCheckoutModal(false);
                                            setSelectedOrderForCheckout(null);
                                        }}
                                        className="text-brand-green-dark/70 hover:text-brand-green-dark"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Order Summary */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Resumen de la Cuenta</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Mesa:</span>
                                            <span className="font-bold text-brand-green-dark">Mesa {selectedOrderForCheckout.tableNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Mesero:</span>
                                            <span className="font-bold text-brand-green-dark">{selectedOrderForCheckout.waiterName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Fecha:</span>
                                            <span className="font-bold text-brand-green-dark">{new Date(selectedOrderForCheckout.createdAt).toLocaleDateString('es-MX')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl max-h-40 overflow-y-auto">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Platillos</h3>
                                    <div className="space-y-2 text-sm">
                                        {selectedOrderForCheckout.items.map((item: any, idx: number) => {
                                            const optExtra = item.selectedOptions.reduce((sum: number, opt: any) => sum + opt.extraPrice, 0);
                                            const itemPrice = (item.product.price + optExtra) * item.quantity;
                                            return (
                                                <div key={idx} className="flex justify-between">
                                                    <span className="text-brand-warm-gray/70">{item.product.name} (x{item.quantity})</span>
                                                    <span className="font-bold text-brand-green-dark">${itemPrice.toFixed(2)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-bold text-brand-warm-gray/60">Total a Pagar:</span>
                                        <span className="text-2xl font-black text-brand-green-dark">${selectedOrderForCheckout.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-3 block">
                                        Método de Pago
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCheckoutPaymentMethod('efectivo')}
                                            className={`py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${checkoutPaymentMethod === 'efectivo'
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                : 'bg-brand-crema text-brand-warm-gray hover:bg-brand-crema-dark'
                                                }`}
                                        >
                                            <span className="text-lg">💵</span>
                                            Efectivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCheckoutPaymentMethod('electronico')}
                                            className={`py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${checkoutPaymentMethod === 'electronico'
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                : 'bg-brand-crema text-brand-warm-gray hover:bg-brand-crema-dark'
                                                }`}
                                        >
                                            <span className="text-lg">💳</span>
                                            Tarjeta
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Payment */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        markOrderAsPaid(selectedOrderForCheckout.id, checkoutPaymentMethod);
                                        setShowCheckoutModal(false);
                                        setSelectedOrderForCheckout(null);
                                    }}
                                    className="w-full bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    <span>Confirmar Pago</span>
                                </button>
                            </div>
                        </>
                    )}
                </ModalWrapper>

{/* Corte de Caja Modal */}
                <ModalWrapper
                    isOpen={showCorteModal}
                    cardClass="bg-brand-crema-light w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    {() => (
                        <>
                            <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <Archive className="w-6 h-6" />
                                        Corte de Caja
                                    </h2>
                                    <button
                                        onClick={() => setShowCorteModal(false)}
                                        className="text-white/70 hover:text-white"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Warning */}
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <p className="text-sm text-red-600 font-bold flex items-center gap-2">
                                        <RotateCcw className="w-5 h-5" />
                                        Esta acción archivará todos los pedidos actuales y reiniciará los contadores a cero.
                                    </p>
                                </div>

                                {/* Summary */}
                                <div className="bg-brand-crema-dark/5 p-4 rounded-xl">
                                    <h3 className="text-sm font-bold uppercase text-brand-warm-gray/60 mb-3">Resumen del Corte</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Fecha:</span>
                                            <span className="font-bold text-brand-green-dark">{new Date(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Total de Pedidos:</span>
                                            <span className="font-bold text-brand-green-dark">{dailyOrders.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">Pedidos Cobrados:</span>
                                            <span className="font-bold text-green-600">{paidOrders.length}</span>
                                        </div>
                                        <div className="border-t border-brand-gold/10 pt-2 mt-2">
                                            <div className="flex justify-between">
                                                <span className="text-brand-warm-gray/60 font-bold">Ventas Totales:</span>
                                                <span className="font-black text-brand-green-dark text-lg">${dailyStats.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">💵 Efectivo:</span>
                                            <span className="font-bold text-red-500">${dailyStats.efectivo.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-brand-warm-gray/60">💳 Electrónico:</span>
                                            <span className="font-bold text-blue-500">${dailyStats.electronico.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-brand-gold/10 pt-2 mt-2">
                                            <div className="flex justify-between">
                                                <span className="text-brand-warm-gray/60 font-bold">Total Cobrado:</span>
                                                <span className="font-black text-green-600 text-lg">${paidStats.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Confirm & Cancel Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCorteModal(false)}
                                        className="bg-brand-crema-dark hover:bg-brand-warm-gray/20 text-brand-warm-gray font-bold py-4 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCorteCaja}
                                        className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Archive className="w-5 h-5" />
                                        <span>Realizar Corte</span>
                                    </button>
                                </div>
</div>
                            </>
                        )}
                    </ModalWrapper>
                </div>
                );
};

// Separate component for menu management
const AdminMenuManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { productos, loading, refresh } = useProductos();
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    const handleAddProduct = async (nuevo: any) => {
        setSaving(true);
        try {
            await crearProducto(nuevo);
            await refresh();
            setShowAddForm(false);
        } catch (error) {
            alert('Error al agregar platillo: ' + (error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este platillo?')) {
            try {
                await eliminarProducto(id);
                await refresh();
            } catch (error) {
                alert('Error al eliminar platillo: ' + (error as Error).message);
            }
        }
    };

    const handleUpdateProduct = async (id: string, updates: Partial<any>) => {
        setSaving(true);
        try {
            await actualizarProducto(id, updates);
            await refresh();
            setEditingProduct(null);
        } catch (error) {
            alert('Error al actualizar platillo: ' + (error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = productos.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-brand-crema-light w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="bg-gradient-to-r from-brand-green-dark to-brand-green p-6 text-brand-crema">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Gestión de Menú</h2>
                        <button
                            onClick={onClose}
                            className="text-brand-crema/70 hover:text-brand-crema"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Search and Add */}
                    <div className="flex items-center justify-between mb-6">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-brand-crema border border-brand-gold/20 rounded-xl px-4 py-3 text-brand-green-dark focus:outline-none focus:border-brand-gold"
                            placeholder="Buscar platillo..."
                        />
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Agregar Platillo</span>
                        </button>
                    </div>

                    {/* Products Grid */}
                    {loading && productos.length === 0 ? (
                        <div className="text-center py-16 text-brand-warm-gray/50">
                            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">Cargando menú...</p>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-brand-gold/10">
                                <div className="h-32 bg-brand-crema relative">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-brand-warm-gray/40">
                                            <ImageIcon className="w-12 h-12" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-brand-gold uppercase">{product.category}</span>
                                        <span className="text-sm font-bold text-brand-green-dark">${Number(product.price).toFixed(2)}</span>
                                    </div>
                                    <h3 className="font-bold text-brand-green-dark mb-2">{product.name}</h3>
                                    {product.description && (
                                        <p className="text-xs text-brand-warm-gray/60 line-clamp-2 mb-4">{product.description}</p>
                                    )}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setEditingProduct(product)}
                                            className="text-brand-gold hover:text-brand-gold-dark p-2 rounded-lg hover:bg-brand-gold/10"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(product.id)}
                                            className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </div>
            </motion.div>

            {/* Add Product Modal */}
            <AnimatePresence>
            {showAddForm && (
                <NuevoProductoModal
                    onClose={() => setShowAddForm(false)}
                    onSave={handleAddProduct}
                    saving={saving}
                />
            )}
            </AnimatePresence>

            {/* Edit Product Modal */}
            <AnimatePresence>
            {editingProduct && (
                <EditProductModal
                    product={editingProduct}
                    onClose={() => setEditingProduct(null)}
                    onUpdate={handleUpdateProduct}
                    saving={saving}
                />
            )}
            </AnimatePresence>
        </motion.div>
    );
};

// Campo de imagen híbrido: pegar URL de internet o subir archivo (cámara/galería)
const ImagenProductoField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await subirImagenProducto(file);
            onChange(url);
        } catch (error) {
            alert('Error al subir imagen: ' + (error as Error).message);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="bg-brand-green text-brand-crema hover:bg-brand-green-dark font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                    {uploading ? 'Subiendo...' : (<><Upload className="w-4 h-4" /> Subir</>)}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                />
            </div>
            {value && (
                <div className="flex items-center gap-3">
                    <img src={value} alt="Vista previa" className="h-16 w-16 object-cover rounded-lg border border-brand-gold/20" />
                    <span className="text-[10px] text-brand-warm-gray/50 break-all">{value}</span>
                </div>
            )}
        </div>
    );
};

// Modal para agregar un nuevo platillo (formulario controlado)
const NuevoProductoModal: React.FC<{ onClose: () => void; onSave: (p: any) => void; saving: boolean }> = ({ onClose, onSave, saving }) => {
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('especiales');
    const [image, setImage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!id.trim() || !name.trim() || price === '') return;
        onSave({
            id: id.trim(),
            name: name.trim(),
            description: description.trim() || undefined,
            price: parseFloat(price),
            category,
            image: image.trim() || undefined,
            options: []
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-brand-crema-light w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="bg-gradient-to-r from-brand-green-dark to-brand-green p-6 text-brand-crema">
                    <h3 className="text-lg font-bold">Agregar Nuevo Platillo</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">ID (clave única)</label>
                        <input
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                            required
                            placeholder="ej. cafe_americano"
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Nombre</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Precio</label>
                        <input
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            type="number"
                            step="0.01"
                            required
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Categoría</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        >
                            <option value="especiales">Destacados</option>
                            <option value="bebidas">Bebidas</option>
                            <option value="desayunos">Desayunos</option>
                            <option value="antojitos">Antojitos</option>
                            <option value="sopas">Sopas</option>
                            <option value="mariscos">Mariscos</option>
                            <option value="carnes">Carnes y Pollo</option>
                            <option value="paninos">Paninos</option>
                            <option value="ensaladas">Ensaladas</option>
                            <option value="postres">Postres</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Imagen</label>
                        <ImagenProductoField value={image} onChange={setImage} />
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-brand-crema-dark text-brand-warm-gray font-bold py-2 rounded-lg hover:bg-brand-crema"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark font-bold py-2 rounded-lg disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

// Component for editing a product
const EditProductModal: React.FC<{ product: any; onClose: () => void; onUpdate: (id: string, updates: Partial<any>) => void; saving: boolean }> = ({ product, onClose, onUpdate, saving }) => {
    const [name, setName] = useState(product.name);
    const [description, setDescription] = useState(product.description || '');
    const [price, setPrice] = useState(product.price?.toString() || '');
    const [category, setCategory] = useState(product.category || 'especiales');
    const [image, setImage] = useState(product.image || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(product.id, {
            name,
            description: description.trim() || undefined,
            price: parseFloat(price),
            category,
            image: image.trim() || undefined
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-brand-crema-light w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-6 text-brand-green-dark">
                    <h3 className="text-lg font-bold">Editar Platillo</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Nombre</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Precio</label>
                        <input
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            type="number"
                            step="0.01"
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Categoría</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                        >
                            <option value="especiales">Destacados</option>
                            <option value="bebidas">Bebidas</option>
                            <option value="desayunos">Desayunos</option>
                            <option value="antojitos">Antojitos</option>
                            <option value="sopas">Sopas</option>
                            <option value="mariscos">Mariscos</option>
                            <option value="carnes">Carnes y Pollo</option>
                            <option value="paninos">Paninos</option>
                            <option value="ensaladas">Ensaladas</option>
                            <option value="postres">Postres</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-brand-warm-gray/60 mb-1 block">Imagen</label>
                        <ImagenProductoField value={image} onChange={setImage} />
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-brand-crema-dark text-brand-warm-gray font-bold py-2 rounded-lg hover:bg-brand-crema"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-brand-green-dark font-bold py-2 rounded-lg disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};
