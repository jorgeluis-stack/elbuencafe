export type CategoryId =
  | 'bebidas'
  | 'desayunos'
  | 'antojitos'
  | 'sopas'
  | 'mariscos'
  | 'carnes'
  | 'paninos'
  | 'ensaladas'
  | 'postres'
  | 'especiales';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: CategoryId;
  popular?: boolean;
  image?: string;
  options?: {
    name: string;
    choices: { name: string; extraPrice: number }[];
    required: boolean;
  }[];
  calories?: number;
  prepTime?: number;
  spicy?: boolean;
  vegetarian?: boolean;
}

export interface CartItemOption {
  optionName: string;
  choiceName: string;
  extraPrice: number;
}

export interface Extra {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
  created_at?: string;
}

export interface CartItem {
  id: string; // unique cart item id (product.id + selected option fingerprints)
  product: Product;
  quantity: number;
  notes: string;
  selectedOptions: CartItemOption[];
  selectedExtras?: { nombre: string; precio: number }[];
}

export type OrderType = 'local' | 'domicilio';

export type OrderStatus = 'pendiente' | 'listo' | 'entregado' | 'cobrado';

export type PaymentMethod = 'efectivo' | 'electronico';

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  tableNumber?: string;
  waiterName?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  items: CartItem[];
  status: OrderStatus;
  createdAt: string; // ISO string
  notes?: string;
  total: number;
  deliveryCharge?: number;
  elapsedSeconds?: number;
  paymentMethod?: PaymentMethod;
  paid?: boolean;
  paymentDate?: string;
}

// ==================== TIPOS PARA SISTEMA DE CUENTAS (Fase 1) ====================

// Estados de Mesa
export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'COBRADA';

// Estados de Cuenta
export type CuentaEstado = 'ABIERTA' | 'COBRADA';

// Estados de Minicomanda
export type MinicomandaEstado = 'PENDIENTE' | 'LISTO' | 'ENTREGADO' | 'DEVUELTA';

// Interface para Mesa
export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: MesaEstado;
  ubicacion?: string;
  mesero_activo_id?: number;
}

// Interface para Mesero
export interface Mesero {
  id: number;
  nombre: string;
  username: string;
  password_hash: string;
  rol: string; // Roles separados por coma: "admin,mesero,cocina" (ej: "mesero,cocina" para múltiples roles)
  activo: boolean;
}

// Configuración de comensales (nombre personalizado por asiento)
export interface SeatConfig {
  nombre: string;
}

// Interface para Cuenta
export interface Cuenta {
  id: number;
  mesa_id: number;
  mesero_id: number;
  estado: CuentaEstado;
  total_acumulado: number;
  fecha_apertura: string;
  fecha_cierre?: string;
  metodo_pago?: 'efectivo' | 'electronico';
  total_pagado?: number;
  cambio?: number;
  notas?: string;
  seat_config?: Record<string, SeatConfig> | null;
  created_at: string;
}

// Interface para Minicomanda
export interface Minicomanda {
  id: number;
  cuenta_id: number;
  mesa_id: number;
  mesero_id: number;
  estado: MinicomandaEstado;
  fecha_envio: string;
  fecha_entrega?: string;
  total: number;
}

// Interface para Item de Minicomanda
export interface ItemMinicomanda {
  id: number;
  minicomanda_id: number;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  notas: string;
  total_item: number;
  seat_number: number | null;
  estado_minicomanda?: 'PENDIENTE' | 'LISTO' | 'ENTREGADO' | 'DEVUELTA';
}

// Reparto de un ítem compartido entre comensales
export interface ItemComensalShare {
  id: number;
  item_id: number;
  seat_number: number;
  porcentaje: number;
  monto: number;
  pagado: boolean;
  created_at: string;
}

// Porción de un ítem compartido asignada a un comensal (estado local del carro)
export interface CarroShare {
  seat: number;
  porcentaje: number;
  monto: number;
}

// Interface para Opción de Item
export interface ItemOpcion {
  id: number;
  item_id: number;
  opcion_nombre: string;
  choice_nombre: string;
  precio_extra: number;
}

// Interface para Historial de Acciones
export interface HistorialAccion {
  id: number;
  cuenta_id?: number;
  minicomanda_id?: number;
  mesa_id?: number;
  mesero_id?: number;
  accion: string;
  descripcion: string;
  monto?: number;
  fecha: string;
}

// Interface para Carro Item (temporal)
export interface CarroItem {
  id: string;
  product: Product;
  quantity: number;
  notes: string;
  selectedOptions: CartItemOption[];
  seatNumber: number | null;
  sharedWith?: CarroShare[];
  selectedExtras?: { nombre: string; precio: number }[];
}

// Interface para Estado de Mesa (completo)
export interface EstadoMesa {
  mesa: Mesa;
  cuenta?: Cuenta;
  minicomandas: Minicomanda[];
  items: ItemMinicomanda[];
}

// Interface para Minicomanda con items (para mostrar en cocina)
export interface MinicomandaConItems extends Minicomanda {
  items: ItemMinicomanda[];
}

// Interface para Cuenta con minicomandas (para mostrar en checkout)
export interface CuentaConMinicomandas extends Cuenta {
  minicomandas: MinicomandaConItems[];
}

// Interface para Ticket de Venta
export interface TicketVenta {
  mesa: Mesa;
  mesero: Mesero;
  cuenta: Cuenta;
  minicomandas: MinicomandaConItems[];
  items: ItemMinicomanda[];
  total: number;
  fecha: string;
  metodoPago: 'efectivo' | 'electronico';
  totalPagado: number;
  cambio: number;
}
