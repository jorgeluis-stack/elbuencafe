// src/db/Schema.ts - Definición de tablas y tipos para IndexedDB

// Tipos para Mesas (Estática)
export interface Mesa {
    id: number;
    numero: string;
    capacidad: number;
    estado: 'LIBRE' | 'OCUPADA' | 'COBRADA';
    ubicacion?: string;
    mesero_activo_id?: number;
}

// Tipos para Meseros (Estática)
export interface Mesero {
    id: number;
    nombre: string;
    username: string;
    password_hash: string;
    rol: string;
    activo: boolean;
}

// Tipos para Cuentas (Entidad Viva)
export interface SeatConfig {
    nombre: string;
}

export interface Cuenta {
    id: number;
    mesa_id: number;
    mesero_id: number;
    estado: 'ABIERTA' | 'COBRADA';
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

// Tipos para Minicomandas
export interface Minicomanda {
    id: number;
    cuenta_id: number;
    mesa_id: number;
    mesero_id: number;
    estado: 'PENDIENTE' | 'LISTO' | 'ENTREGADO' | 'DEVUELTA';
    fecha_envio: string;
    fecha_entrega?: string;
    total: number;
}

// Tipos para Items de Minicomanda
export interface ItemMinicomanda {
    id: number;
    minicomanda_id: number;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    notas: string;
    total_item: number;
    seat_number: number | null;
}

// Tipos para reparto de ítems compartidos entre comensales
export interface ItemComensalShare {
    id: number;
    item_id: number;
    seat_number: number;
    porcentaje: number;
    monto: number;
    pagado: boolean;
    created_at: string;
}

// Tipos para Items Opciones
export interface ItemOpcion {
    id: number;
    item_id: number;
    opcion_nombre: string;
    choice_nombre: string;
    precio_extra: number;
}

// Tipos para Historial de Acciones
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

// Tipos para Productos (se usan los del sistema actual)
export interface Producto {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
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
  activo?: boolean;
}

// Tipos para Extras
export interface Extra {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
  created_at?: string;
}

// Tipos para Carro Local (temporal)
export interface CarroItem {
  id: string;
  product: Producto;
  quantity: number;
  notes: string;
  selectedOptions: {
      optionName: string;
      choiceName: string;
      extraPrice: number;
  }[];
  seatNumber: number | null;
  sharedWith?: {
      seat: number;
      porcentaje: number;
      monto: number;
  }[];
  selectedExtras?: { nombre: string; precio: number }[];
}

// Tipos para Estado de Mesa
export interface EstadoMesa {
    mesa_id: number;
    mesa_numero: string;
    cuenta?: Cuenta;
    minicomandas: Minicomanda[];
    items: ItemMinicomanda[];
}
