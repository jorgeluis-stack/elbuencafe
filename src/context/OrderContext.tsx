// src/context/OrderContext.tsx - Contexto de pedidos para El Buen Café
// MIGRADO: localStorage → Supabase PostgreSQL + Realtime

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Order, CartItem, Product, OrderType, OrderStatus, PaymentMethod } from '../types';
import {
  obtenerOrdenesCliente,
  crearOrdenCliente,
  actualizarEstadoOrdenCliente,
  marcarOrdenPagada,
  eliminarOrdenCliente,
  suscribirACambios,
  verificarCredencialesUsuario,
  obtenerTodosLosUsuarios,
  guardarUsuario as guardarUsuarioDB,
  eliminarUsuario as eliminarUsuarioDB,
  UsuarioSistema
} from '../db/SupabaseQueries';
import { isSupabaseConfigured } from '../db/supabaseClient';

interface UserCredentials {
  username: string;
  password: string;
  roles: string; // Roles separados por coma: "admin,mesero,cocina,repartidor"
}

interface OrderContextType {
  orders: Order[];
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, notes: string, options: { optionName: string; choiceName: string; extraPrice: number }[]) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  placeOrder: (orderData: {
    type: OrderType;
    tableNumber?: string;
    waiterName?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    notes?: string;
    paymentMethod?: PaymentMethod;
    deliveryCharge?: number;
  }) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  resetOrders: () => Promise<void>;
  markOrderAsPaid: (orderId: string, paymentMethod: PaymentMethod) => Promise<void>;
  currentRole: 'cliente' | 'mesero' | 'cocina' | 'admin' | 'login';
  setCurrentRole: (role: 'cliente' | 'mesero' | 'cocina' | 'admin' | 'login') => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  notifications: string[];
  addNotification: (message: string) => void;
  clearNotifications: () => void;
  users: UserCredentials[];
  saveUser: (user: UserCredentials) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
  updateAdminCredentials: (username: string, password: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

// Órdenes mock iniciales (solo se usan si Supabase no está configurado)
const MOCK_ORDERS: Order[] = [
  {
    id: 'ord_1',
    orderNumber: '001',
    type: 'local',
    tableNumber: '4',
    waiterName: 'Carlos',
    items: [
      {
        id: 'cap_irl_1',
        product: {
          id: 'capuchino_irlandes',
          name: 'Capuchino Irlandés',
          price: 70,
          category: 'bebidas'
        },
        quantity: 1,
        notes: 'Bien caliente, espolvoreado con canela extra.',
        selectedOptions: []
      },
      {
        id: 'chil_arr_1',
        product: {
          id: 'chilaquiles_arrachera',
          name: 'Chilaquiles c/arrachera',
          price: 140,
          category: 'desayunos',
          options: [
            {
              name: 'Salsa',
              required: true,
              choices: [{ name: 'Salsa Verde', extraPrice: 0 }, { name: 'Salsa Roja', extraPrice: 0 }]
            }
          ]
        },
        quantity: 1,
        notes: 'Chilaquiles verdes, bien fritos.',
        selectedOptions: [{ optionName: 'Salsa', choiceName: 'Salsa Verde', extraPrice: 0 }]
      }
    ],
    status: 'pendiente',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    total: 210,
    notes: 'Cliente de la mesa de la esquina.'
  },
  {
    id: 'ord_2',
    orderNumber: '002',
    type: 'domicilio',
    customerName: 'Mariana Gómez',
    customerPhone: '936 123 4567',
    address: 'Av. Paseo Tabasco #142, Col. Centro',
    items: [
      {
        id: 'pan_casa_1',
        product: {
          id: 'panino_casa',
          name: 'Panino de la Casa',
          price: 150,
          category: 'paninos'
        },
        quantity: 1,
        notes: 'Sin cebolla por favor.',
        selectedOptions: []
      },
      {
        id: 'jug_ver_1',
        product: {
          id: 'jugo_verde',
          name: 'Jugo Verde',
          price: 65,
          category: 'bebidas'
        },
        quantity: 1,
        notes: 'Sin hielo.',
        selectedOptions: []
      }
    ],
    status: 'pendiente',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    total: 215,
    notes: 'Entregar en la caseta de vigilancia.'
  },
  {
    id: 'ord_3',
    orderNumber: '003',
    type: 'local',
    tableNumber: '2',
    waiterName: 'Sofía',
    items: [
      {
        id: 'omelette_jq_1',
        product: {
          id: 'omelette_jamon_queso',
          name: 'Omelette con Jamón y Queso',
          price: 100,
          category: 'desayunos'
        },
        quantity: 2,
        notes: 'Con salsa picante aparte.',
        selectedOptions: []
      }
    ],
    status: 'listo',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    total: 200
  }
];

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentRole, setCurrentRole] = useState<'cliente' | 'mesero' | 'cocina' | 'admin' | 'login'>('cliente');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [users, setUsers] = useState<UserCredentials[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar usuarios desde Supabase
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        if (isSupabaseConfigured()) {
          const usuariosDB = await obtenerTodosLosUsuarios();
          const mapped: UserCredentials[] = usuariosDB.map(u => ({
            username: u.username,
            password: u.password,
            roles: u.roles
          }));
          setUsers(mapped);
        } else {
          // Fallback a localStorage
          const savedUsers = localStorage.getItem('elbuencafe_users');
          if (savedUsers) {
            try {
              const parsed = JSON.parse(savedUsers);
              // Normalizar formato antiguo (role) → nuevo (roles)
              const normalized = parsed.map((u: any) => ({
                username: u.username,
                password: u.password,
                roles: u.roles || u.role || 'mesero'
              }));
              setUsers(normalized);
            } catch {
              setUsers([]);
            }
          } else {
            const defaultUsers: UserCredentials[] = [
              { username: 'admin', password: 'admin', roles: 'admin' }
            ];
            setUsers(defaultUsers);
            localStorage.setItem('elbuencafe_users', JSON.stringify(defaultUsers));
          }
        }
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
      }
    };
    cargarUsuarios();
  }, []);

  // Cargar órdenes desde Supabase (o localStorage como fallback)
  useEffect(() => {
    const cargarOrdenes = async () => {
      try {
        if (isSupabaseConfigured()) {
          const ordenesDB = await obtenerOrdenesCliente();
          const mapped: Order[] = ordenesDB.map(o => ({
            id: o.id,
            orderNumber: o.order_number,
            type: o.type,
            tableNumber: o.table_number,
            waiterName: o.waiter_name,
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            address: o.address,
            items: o.items as CartItem[],
            status: o.status,
            createdAt: o.created_at,
          total: o.total,
          deliveryCharge: o.delivery_charge,
          notes: o.notes,
          paymentMethod: o.payment_method,
          paid: o.paid,
            paymentDate: o.payment_date
          }));
          setOrders(mapped);
        } else {
          // Fallback a localStorage
          const savedOrders = localStorage.getItem('elbuencafe_orders');
          if (savedOrders) {
            try {
              setOrders(JSON.parse(savedOrders));
            } catch {
              setOrders(MOCK_ORDERS);
            }
          } else {
            setOrders(MOCK_ORDERS);
          }
        }
      } catch (error) {
        console.error('Error al cargar órdenes:', error);
        // Fallback a MOCK_ORDERS si hay error
        setOrders(MOCK_ORDERS);
      } finally {
        setLoading(false);
      }
    };
    cargarOrdenes();
  }, []);

  // Cargar carrito desde localStorage (el carro es temporal, no va a BD)
  useEffect(() => {
    const savedCart = localStorage.getItem('elbuencafe_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch { /* ignorar error de parse */ }
    }
  }, []);

  // Suscripción Realtime: cambios en usuarios_sistema (roles modificados por admin)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const unsubscribe = suscribirACambios('usuarios_sistema', async () => {
      try {
        const usuariosDB = await obtenerTodosLosUsuarios();
        const mapped: UserCredentials[] = usuariosDB.map(u => ({
          username: u.username,
          password: u.password,
          roles: u.roles
        }));
        setUsers(mapped);
        // Notificar a otros componentes que los usuarios cambiaron
        window.dispatchEvent(new CustomEvent('reload_tables'));
        window.dispatchEvent(new CustomEvent('users_updated'));
      } catch (error) {
        console.error('Error al recargar usuarios por Realtime:', error);
      }
    });
    return unsubscribe;
  }, []);

  // Suscripción Realtime: cambios en órdenes de cliente
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const unsubscribe = suscribirACambios('ordenes_cliente', (payload) => {
      if (payload.eventType === 'INSERT') {
        const nuevaOrden: Order = {
          id: payload.new.id,
          orderNumber: payload.new.order_number,
          type: payload.new.type,
          tableNumber: payload.new.table_number,
          waiterName: payload.new.waiter_name,
          customerName: payload.new.customer_name,
          customerPhone: payload.new.customer_phone,
          address: payload.new.address,
          items: payload.new.items as CartItem[],
          status: payload.new.status,
          createdAt: payload.new.created_at,
          total: payload.new.total,
          deliveryCharge: payload.new.delivery_charge,
          notes: payload.new.notes,
          paymentMethod: payload.new.payment_method,
          paid: payload.new.paid,
          paymentDate: payload.new.payment_date
        };
        setOrders(prev => [nuevaOrden, ...prev]);
        addNotification(`🔔 Nuevo pedido recibido: ${nuevaOrden.type === 'local' ? 'Mesa ' + nuevaOrden.tableNumber : 'Domicilio para ' + nuevaOrden.customerName}`);
      } else if (payload.eventType === 'UPDATE') {
        setOrders(prev => prev.map(o => {
          if (o.id === payload.new.id) {
            const oldStatus = o.status;
            const newStatus = payload.new.status as OrderStatus;
            if (oldStatus !== newStatus) {
              if (newStatus === 'listo') {
                addNotification(`✔️ El pedido #${o.orderNumber} está ¡LISTO!`);
              } else if (newStatus === 'entregado') {
                addNotification(`🚚 El pedido #${o.orderNumber} ha sido entregado.`);
              } else if (newStatus === 'cobrado') {
                addNotification(`💰 Pedido #${o.orderNumber} cobrado.`);
              }
            }
            return {
              ...o,
              status: newStatus,
              paid: payload.new.paid,
              paymentMethod: payload.new.payment_method,
              paymentDate: payload.new.payment_date
            };
          }
          return o;
        }));
      } else if (payload.eventType === 'DELETE') {
        setOrders(prev => prev.filter(o => o.id !== payload.old.id));
      }
    });

    return unsubscribe;
  }, []);

  // Notificaciones
  const addNotification = (message: string) => {
    setNotifications((prev) => [message, ...prev.slice(0, 19)]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Gestión de usuarios
  const saveUser = async (user: UserCredentials) => {
    try {
      if (isSupabaseConfigured()) {
        await guardarUsuarioDB({
          username: user.username,
          password: user.password,
          roles: user.roles
        });
        // Recargar usuarios
        const usuariosDB = await obtenerTodosLosUsuarios();
        const mapped: UserCredentials[] = usuariosDB.map(u => ({
          username: u.username,
          password: u.password,
          roles: u.roles
        }));
        setUsers(mapped);
      } else {
        const updatedUsers = [...users, user];
        setUsers(updatedUsers);
        localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));
      }
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      // Fallback a localStorage
      const updatedUsers = [...users, user];
      setUsers(updatedUsers);
      localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));
    }
  };

  const deleteUser = async (username: string) => {
    try {
      if (isSupabaseConfigured()) {
        await eliminarUsuarioDB(username);
        const usuariosDB = await obtenerTodosLosUsuarios();
        const mapped: UserCredentials[] = usuariosDB.map(u => ({
          username: u.username,
          password: u.password,
          roles: u.roles
        }));
        setUsers(mapped);
      } else {
        const updatedUsers = users.filter(u => u.username !== username);
        setUsers(updatedUsers);
        localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));
      }
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      const updatedUsers = users.filter(u => u.username !== username);
      setUsers(updatedUsers);
      localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));
    }
  };

  const updateAdminCredentials = async (username: string, password: string) => {
    // Primero eliminar el admin anterior, luego crear el nuevo
    try {
      if (isSupabaseConfigured()) {
        await eliminarUsuarioDB('admin');
        await guardarUsuarioDB({ username, password, roles: 'admin' });
        const usuariosDB = await obtenerTodosLosUsuarios();
        const mapped: UserCredentials[] = usuariosDB.map(u => ({
          username: u.username,
          password: u.password,
          roles: u.roles
        }));
        setUsers(mapped);
      } else {
        const updatedUsers = users.map(u =>
          u.roles.includes('admin') ? { ...u, username, password } : u
        );
        setUsers(updatedUsers);
        localStorage.setItem('elbuencafe_users', JSON.stringify(updatedUsers));
      }
    } catch (error) {
      console.error('Error al actualizar admin:', error);
    }
  };

  // Carrito (localStorage — temporal)
  const persistCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('elbuencafe_cart', JSON.stringify(newCart));
  };

  const addToCart = (
    product: Product,
    quantity: number,
    notes: string,
    options: { optionName: string; choiceName: string; extraPrice: number }[]
  ) => {
    const optionFingerprint = options.map(o => `${o.optionName}:${o.choiceName}`).join('|');
    const cartItemId = `${product.id}-${optionFingerprint}-${notes.substring(0, 10)}`;

    const existingIndex = cart.findIndex(item => item.id === cartItemId);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += quantity;
      persistCart(updated);
    } else {
      const newItem: CartItem = {
        id: cartItemId,
        product,
        quantity,
        notes,
        selectedOptions: options
      };
      persistCart([...cart, newItem]);
    }
    addNotification(`🛒 Agregado: ${product.name} (x${quantity})`);
  };

  const removeFromCart = (cartItemId: string) => {
    const filtered = cart.filter(item => item.id !== cartItemId);
    persistCart(filtered);
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    const updated = cart.map(item =>
      item.id === cartItemId ? { ...item, quantity } : item
    );
    persistCart(updated);
  };

  const clearCart = () => {
    persistCart([]);
  };

  const placeOrder = async (orderData: {
    type: OrderType;
    tableNumber?: string;
    waiterName?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    notes?: string;
    paymentMethod?: PaymentMethod;
    deliveryCharge?: number;
  }): Promise<Order | null> => {
    const itemTotal = cart.reduce((sum, item) => {
      const optionExtra = item.selectedOptions.reduce((optSum, opt) => optSum + opt.extraPrice, 0);
      return sum + (item.product.price + optionExtra) * item.quantity;
    }, 0);

    const orderNum = String(orders.length + 1).padStart(3, '0');
    const orderId = `ord_${Date.now()}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderNum,
      type: orderData.type,
      tableNumber: orderData.tableNumber,
      waiterName: orderData.waiterName,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      address: orderData.address,
      items: [...cart],
      status: 'pendiente',
      createdAt: new Date().toISOString(),
      notes: orderData.notes,
      total: itemTotal + (orderData.deliveryCharge || 0),
      deliveryCharge: orderData.deliveryCharge || 0,
      paymentMethod: orderData.paymentMethod
    };

    try {
      if (isSupabaseConfigured()) {
        await crearOrdenCliente({
          id: orderId,
          order_number: orderNum,
          type: orderData.type,
          table_number: orderData.tableNumber || null,
          waiter_name: orderData.waiterName || null,
          customer_name: orderData.customerName || null,
          customer_phone: orderData.customerPhone || null,
          address: orderData.address || null,
          items: cart as any,
          status: 'pendiente',
          total: itemTotal + (orderData.deliveryCharge || 0),
          delivery_charge: orderData.deliveryCharge || 0,
          notes: orderData.notes || '',
          payment_method: orderData.paymentMethod || null,
          paid: false,
          payment_date: null
        });
        // No agregar al estado local — Realtime lo hará automáticamente
      } else {
        // Fallback a localStorage
        const updatedOrders = [...orders, newOrder];
        setOrders(updatedOrders);
        localStorage.setItem('elbuencafe_orders', JSON.stringify(updatedOrders));
      }

      persistCart([]); // Limpiar carrito
      addNotification(`🎉 Pedido #${orderNum} enviado con éxito!`);
      return newOrder;
    } catch (error) {
      console.error('Error al crear orden:', error);
      // Fallback a localStorage
      const updatedOrders = [...orders, newOrder];
      setOrders(updatedOrders);
      localStorage.setItem('elbuencafe_orders', JSON.stringify(updatedOrders));
      persistCart([]);
      addNotification(`🎉 Pedido #${orderNum} enviado con éxito!`);
      return newOrder;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      if (isSupabaseConfigured()) {
        await actualizarEstadoOrdenCliente(orderId, status);
        // Realtime se encarga de actualizar el state
      } else {
        const updated = orders.map(o =>
          o.id === orderId ? { ...o, status } : o
        );
        setOrders(updated);
        localStorage.setItem('elbuencafe_orders', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error al actualizar orden:', error);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      if (isSupabaseConfigured()) {
        await eliminarOrdenCliente(orderId);
        // Realtime se encarga de eliminar del state
      } else {
        const filtered = orders.filter(o => o.id !== orderId);
        setOrders(filtered);
        localStorage.setItem('elbuencafe_orders', JSON.stringify(filtered));
      }
    } catch (error) {
      console.error('Error al eliminar orden:', error);
    }
  };

  const resetOrders = async () => {
    try {
      if (isSupabaseConfigured()) {
        // Eliminar todas las órdenes una por una
        for (const order of orders) {
          await eliminarOrdenCliente(order.id);
        }
      } else {
        setOrders([]);
        localStorage.setItem('elbuencafe_orders', JSON.stringify([]));
      }
      addNotification('🔒 Corte de caja realizado. Pedidos reiniciados.');
    } catch (error) {
      console.error('Error al reiniciar órdenes:', error);
    }
  };

  const markOrderAsPaid = async (orderId: string, paymentMethod: PaymentMethod) => {
    try {
      if (isSupabaseConfigured()) {
        await marcarOrdenPagada(orderId, paymentMethod);
        // Realtime se encarga de actualizar el state
      } else {
        const updated = orders.map(o => {
          if (o.id === orderId) {
            return {
              ...o,
              status: 'cobrado' as OrderStatus,
              paid: true,
              paymentDate: new Date().toISOString(),
              paymentMethod
            };
          }
          return o;
        });
        setOrders(updated);
        localStorage.setItem('elbuencafe_orders', JSON.stringify(updated));
      }
      const order = orders.find(o => o.id === orderId);
      if (order) {
        addNotification(`💰 Pedido #${order.orderNumber} cobrado con ${paymentMethod === 'efectivo' ? 'Efectivo' : 'Tarjeta'}`);
      }
    } catch (error) {
      console.error('Error al marcar orden como pagada:', error);
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      cart,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      placeOrder,
      updateOrderStatus,
      deleteOrder,
      resetOrders,
      markOrderAsPaid,
      currentRole,
      setCurrentRole,
      selectedProduct,
      setSelectedProduct,
      notifications,
      addNotification,
      clearNotifications,
      users,
      saveUser,
      deleteUser,
      updateAdminCredentials
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
