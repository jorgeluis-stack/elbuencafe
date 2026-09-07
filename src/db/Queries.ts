// src/db/Queries.ts - Funciones CRUD para cada tabla

import { Mesa, Mesero, Cuenta, SeatConfig, Minicomanda, ItemMinicomanda, ItemOpcion, HistorialAccion, CarroItem, Producto } from './Schema';
import { getAllRecords, getRecordById, addRecord, updateRecord, deleteRecord, getRecordsByIndex, openDB, closeDB } from './DB';

// ==================== FUNCIONES DE MESAS ====================

export const obtenerTodasLasMesas = (): Promise<Mesa[]> => {
    return getAllRecords<Mesa>('mesas');
};

export const obtenerMesaPorId = (id: number): Promise<Mesa | undefined> => {
    return getRecordById<Mesa>('mesas', id);
};

export const obtenerMesaPorNumero = (numero: string): Promise<Mesa | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('mesas', 'readonly');
            const store = transaction.objectStore('mesas');
            const index = store.index('numero');
            const request = index.get(numero);

            request.onsuccess = () => {
                resolve(request.result as Mesa | undefined);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener mesa: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

export const actualizarEstadoMesa = (mesaId: number, estado: 'LIBRE' | 'OCUPADA' | 'COBRADA'): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('mesas', 'readwrite');
            const store = transaction.objectStore('mesas');
            const request = store.get(mesaId);

            request.onsuccess = () => {
                const mesa = request.result as Mesa;
                mesa.estado = estado;
                const updateRequest = store.put(mesa);

                updateRequest.onsuccess = () => {
                    resolve();
                    closeDB(db);
                };

                updateRequest.onerror = () => {
                    reject('Error al actualizar estado de mesa: ' + updateRequest.error);
                    closeDB(db);
                };
            };

            request.onerror = () => {
                reject('Error al obtener mesa: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// ==================== FUNCIONES DE MESEROS ====================

export const obtenerTodosLosMeseros = (): Promise<Mesero[]> => {
    return getAllRecords<Mesero>('meseros');
};

export const obtenerMeseroPorId = (id: number): Promise<Mesero | undefined> => {
    return getRecordById<Mesero>('meseros', id);
};

export const agregarMesero = (mesero: Omit<Mesero, 'id'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('meseros', 'readwrite');
            const store = transaction.objectStore('meseros');
            const request = store.add(mesero);

            request.onsuccess = () => {
                resolve(request.result as number);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al agregar mesero: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

export const actualizarMesero = (mesero: Mesero): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('meseros', 'readwrite');
            const store = transaction.objectStore('meseros');
            const request = store.put(mesero);

            request.onsuccess = () => {
                resolve();
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al actualizar mesero: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

export const obtenerMeseroPorUsername = (username: string): Promise<Mesero | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('meseros', 'readonly');
            const store = transaction.objectStore('meseros');
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => {
                resolve(request.result as Mesero | undefined);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener mesero: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

export const verificarCredencialesMesero = (username: string, password: string): Promise<Mesero | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('meseros', 'readonly');
            const store = transaction.objectStore('meseros');
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => {
                const mesero = request.result as Mesero | undefined;
                if (mesero && mesero.password_hash === password && mesero.activo) {
                    resolve(mesero);
                } else {
                    resolve(undefined);
                }
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al verificar credenciales: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// ==================== FUNCIONES DE CUENTAS ====================

export const obtenerTodasLasCuentas = (): Promise<Cuenta[]> => {
    return getAllRecords<Cuenta>('cuentas');
};

export const obtenerCuentasAbiertas = (): Promise<Cuenta[]> => {
    return getAllRecords<Cuenta>('cuentas').then(cuentas => cuentas.filter(c => c.estado === 'ABIERTA'));
};

export const obtenerCuentaPorId = (id: number): Promise<Cuenta | undefined> => {
    return getRecordById<Cuenta>('cuentas', id);
};

export const obtenerCuentasPorMesa = (mesaId: number): Promise<Cuenta[]> => {
    return getRecordsByIndex<Cuenta>('cuentas', 'mesa_id', mesaId);
};

export const obtenerCuentasPorMesero = (meseroId: number): Promise<Cuenta[]> => {
    return getRecordsByIndex<Cuenta>('cuentas', 'mesero_id', meseroId);
};

export const obtenerCuentaAbiertaPorMesa = (mesaId: number): Promise<Cuenta | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('cuentas', 'readonly');
            const store = transaction.objectStore('cuentas');
            const index = store.index('mesa_id');
            const request = index.getAll(mesaId);

            request.onsuccess = () => {
                const cuentas = request.result as Cuenta[];
                const cuentaAbierta = cuentas.find(c => c.estado === 'ABIERTA');
                resolve(cuentaAbierta);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener cuenta abierta: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

export const crearCuenta = (cuenta: Omit<Cuenta, 'id' | 'created_at'>): Promise<number> => {
    return addRecord<Cuenta>('cuentas', {
        ...cuenta,
        created_at: new Date().toISOString()
    });
};

export const actualizarCuenta = (cuenta: Cuenta): Promise<void> => {
    return updateRecord<Cuenta>('cuentas', cuenta);
};

// En modo local (IndexedDB) el seat_config vive dentro del objeto Cuenta.
// Actualizamos la cuenta completa con el nuevo mapa de nombres.
export const actualizarSeatConfig = async (
    cuentaId: number,
    seatConfig: Record<string, SeatConfig>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const cuenta = await getRecordById<Cuenta>('cuentas', cuentaId);
        if (!cuenta) return { success: false, error: 'Cuenta no encontrada' };
        cuenta.seat_config = seatConfig;
        await updateRecord<Cuenta>('cuentas', cuenta);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Error local' };
    }
};

export const obtenerCuentasCobradasEnFecha = async (_fecha: string): Promise<any[]> => {
    const todas = await obtenerTodasLasCuentas();
    return todas.filter(c => {
        if (c.estado !== 'COBRADA' || !c.fecha_cierre) return false;
        return c.fecha_cierre.startsWith(_fecha);
    });
};

export const obtenerMinicomandasConItemsPorCuentas = async (cuentaIds: number[]): Promise<any[]> => {
    if (cuentaIds.length === 0) return [];
    const todasMinis = await obtenerTodasLasMinicomandas();
    const minis = todasMinis.filter(m => cuentaIds.includes(m.cuenta_id));
    const todosItems = await obtenerTodosLosItemsMinicomanda();
    return minis.map(m => ({
        ...m,
        items_minicomanda: todosItems.filter(i => i.minicomanda_id === m.id)
    }));
};

export const cerrarCuenta = (cuentaId: number, totalPagado: number, cambio: number, metodoPago: 'efectivo' | 'electronico'): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('cuentas', 'readwrite');
            const store = transaction.objectStore('cuentas');
            const request = store.get(cuentaId);

            request.onsuccess = () => {
                const cuenta = request.result as Cuenta;
                cuenta.estado = 'COBRADA';
                cuenta.fecha_cierre = new Date().toISOString();
                cuenta.total_pagado = totalPagado;
                cuenta.cambio = cambio;
                cuenta.metodo_pago = metodoPago;

                const updateRequest = store.put(cuenta);

                updateRequest.onsuccess = () => {
                    resolve();
                    closeDB(db);
                };

                updateRequest.onerror = () => {
                    reject('Error al cerrar cuenta: ' + updateRequest.error);
                    closeDB(db);
                };
            };

            request.onerror = () => {
                reject('Error al obtener cuenta: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// ==================== FUNCIONES DE MINICOMANDAS ====================

export const obtenerTodasLasMinicomandas = (): Promise<Minicomanda[]> => {
    return getAllRecords<Minicomanda>('minicomandas');
};

export const obtenerMinicomandaPorId = (id: number): Promise<Minicomanda | undefined> => {
    return getRecordById<Minicomanda>('minicomandas', id);
};

export const obtenerMinicomandasPorCuenta = (cuentaId: number): Promise<Minicomanda[]> => {
    return getRecordsByIndex<Minicomanda>('minicomandas', 'cuenta_id', cuentaId);
};

export const obtenerMinicomandasPorMesa = (mesaId: number): Promise<Minicomanda[]> => {
    return getRecordsByIndex<Minicomanda>('minicomandas', 'mesa_id', mesaId);
};

export const crearMinicomanda = (minicomanda: Omit<Minicomanda, 'id'>): Promise<number> => {
    return addRecord<Minicomanda>('minicomandas', minicomanda);
};

export const actualizarMinicomanda = (minicomanda: Minicomanda): Promise<void> => {
    return updateRecord<Minicomanda>('minicomandas', minicomanda);
};

export const marcarMinicomandaComoListo = (minicomandaId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('minicomandas', 'readwrite');
            const store = transaction.objectStore('minicomandas');
            const request = store.get(minicomandaId);

            request.onsuccess = () => {
                const minicomanda = request.result as Minicomanda;
                minicomanda.estado = 'LISTO';
                minicomanda.fecha_entrega = new Date().toISOString();

                const updateRequest = store.put(minicomanda);

                updateRequest.onsuccess = () => {
                    resolve();
                    closeDB(db);
                };

                updateRequest.onerror = () => {
                    reject('Error al marcar minicomanda como listo: ' + updateRequest.error);
                    closeDB(db);
                };
            };

            request.onerror = () => {
                reject('Error al obtener minicomanda: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// ==================== FUNCIONES DE ITEMS DE MINICOMANDA ====================

export const obtenerTodosLosItemsMinicomanda = (): Promise<ItemMinicomanda[]> => {
    return getAllRecords<ItemMinicomanda>('items_minicomanda');
};

export const obtenerItemMinicomandaPorId = (id: number): Promise<ItemMinicomanda | undefined> => {
    return getRecordById<ItemMinicomanda>('items_minicomanda', id);
};

export const obtenerItemsPorMinicomanda = (minicomandaId: number): Promise<ItemMinicomanda[]> => {
    return getRecordsByIndex<ItemMinicomanda>('items_minicomanda', 'minicomanda_id', minicomandaId);
};

export const crearItemMinicomanda = (item: Omit<ItemMinicomanda, 'id'>): Promise<number> => {
    return addRecord<ItemMinicomanda>('items_minicomanda', item);
};

export const actualizarItemMinicomanda = (item: ItemMinicomanda): Promise<void> => {
    return updateRecord<ItemMinicomanda>('items_minicomanda', item);
};

export const eliminarItemMinicomanda = (id: number): Promise<void> => {
    return deleteRecord<ItemMinicomanda>('items_minicomanda', id);
};

// ==================== FUNCIONES DE ITEMS OPCIONES ====================

export const obtenerTodasLasOpciones = (): Promise<ItemOpcion[]> => {
    return getAllRecords<ItemOpcion>('items_opciones');
};

export const obtenerOpcionesPorItem = (itemId: number): Promise<ItemOpcion[]> => {
    return getRecordsByIndex<ItemOpcion>('items_opciones', 'item_id', itemId);
};

export const crearOpcion = (opcion: Omit<ItemOpcion, 'id'>): Promise<number> => {
    return addRecord<ItemOpcion>('items_opciones', opcion);
};

export const crearMultiplesOpciones = (opciones: Omit<ItemOpcion, 'id'>[]): Promise<number[]> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('items_opciones', 'readwrite');
            const store = transaction.objectStore('items_opciones');
            const results: number[] = [];

            opciones.forEach(opcion => {
                const request = store.add(opcion);
                request.onsuccess = () => {
                    results.push(request.result as number);
                    if (results.length === opciones.length) {
                        resolve(results);
                        closeDB(db);
                    }
                };
                request.onerror = () => {
                    reject('Error al agregar opción: ' + request.error);
                    closeDB(db);
                };
            });

            transaction.oncomplete = () => {
                resolve(results);
                closeDB(db);
            };

            transaction.onerror = () => {
                reject('Error en transacción: ' + transaction.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// ==================== FUNCIONES DE HISTORIAL DE ACCIONES ====================

export const obtenerTodoElHistorial = (): Promise<HistorialAccion[]> => {
    return getAllRecords<HistorialAccion>('historial_acciones');
};

export const obtenerHistorialPorCuenta = (cuentaId: number): Promise<HistorialAccion[]> => {
    return getRecordsByIndex<HistorialAccion>('historial_acciones', 'cuenta_id', cuentaId);
};

export const obtenerHistorialPorMesa = (mesaId: number): Promise<HistorialAccion[]> => {
    return getRecordsByIndex<HistorialAccion>('historial_acciones', 'mesa_id', mesaId);
};

export const obtenerHistorialPorMesero = (meseroId: number): Promise<HistorialAccion[]> => {
    return getRecordsByIndex<HistorialAccion>('historial_acciones', 'mesero_id', meseroId);
};

export const crearHistorialAccion = (accion: Omit<HistorialAccion, 'id' | 'fecha'>): Promise<number> => {
    return addRecord<HistorialAccion>('historial_acciones', {
        ...accion,
        fecha: new Date().toISOString()
    });
};

// ==================== FUNCIONES AUXILIARES ====================

// Obtener estado completo de una mesa
export const obtenerEstadoMesaCompleto = (mesaId: number): Promise<{
    mesa: Mesa;
    cuenta?: Cuenta;
    minicomandas: Minicomanda[];
    items: ItemMinicomanda[];
}> => {
    return new Promise(async (resolve, reject) => {
        try {
            const mesa = await obtenerMesaPorId(mesaId);
            if (!mesa) {
                reject('Mesa no encontrada');
                return;
            }

            // Obtener TODAS las cuentas de la mesa (no solo la abierta)
            // para que el historial muestre todos los pedidos de la mesa
            const cuentas = await obtenerCuentasPorMesa(mesaId);

            // Obtener la cuenta abierta actual (si existe)
            const cuentaAbierta = cuentas.find(c => c.estado === 'ABIERTA');

            // Obtener TODAS las minicomandas de TODAS las cuentas de la mesa
            const minicomandasPromises = cuentas.map(c => obtenerMinicomandasPorCuenta(c.id));
            const minicomandasArrays = await Promise.all(minicomandasPromises);
            const minicomandas = minicomandasArrays.flat();

            // Obtener todos los items de todas las minicomandas
            const itemsPromises = minicomandas.map(m => obtenerItemsPorMinicomanda(m.id));
            const itemsArray = await Promise.all(itemsPromises);
            const items = itemsArray.flat();

            resolve({ mesa, cuenta: cuentaAbierta, minicomandas, items });
        } catch (error) {
            reject(error);
        }
    });
};

// Calcular total de una cuenta
export const calcularTotalCuenta = (cuentaId: number): Promise<number> => {
    return new Promise(async (resolve, reject) => {
        try {
            const minicomandas = await obtenerMinicomandasPorCuenta(cuentaId);
            const itemsPromises = minicomandas.map(m => obtenerItemsPorMinicomanda(m.id));
            const itemsArray = await Promise.all(itemsPromises);
            const items = itemsArray.flat();

            const total = items.reduce((sum, item) => sum + item.total_item, 0);
            resolve(total);
        } catch (error) {
            reject(error);
        }
    });
};

// Obtener productos desde localStorage (para compatibilidad con el sistema actual)
export const obtenerProductos = (): Promise<Producto[]> => {
    return new Promise((resolve, reject) => {
        const savedProducts = localStorage.getItem('elbuencafe_products');
        if (savedProducts) {
            resolve(JSON.parse(savedProducts));
        } else {
            // Cargar productos desde el archivo menu.ts
            import('../data/menu').then(({ PRODUCTS }) => {
                localStorage.setItem('elbuencafe_products', JSON.stringify(PRODUCTS));
                resolve(PRODUCTS);
            }).catch(reject);
        }
    });
};

// Fallbacks locales del catálogo (cuando Supabase no está configurado).
// Misma interfaz que las funciones de SupabaseQueriesImpl.ts.
const leerProductosLocal = (): Producto[] => {
    const savedProducts = localStorage.getItem('elbuencafe_products');
    if (savedProducts) {
        try { return JSON.parse(savedProducts) as Producto[]; } catch { /* ignorar */ }
    }
    return [];
};

const guardarProductosLocal = (productos: Producto[]): void => {
    localStorage.setItem('elbuencafe_products', JSON.stringify(productos));
};

export const listarProductos = (): Promise<Producto[]> => {
    return new Promise((resolve) => {
        const guardados = leerProductosLocal();
        if (guardados.length > 0) {
            resolve(guardados);
        } else {
            import('../data/menu').then(({ PRODUCTS }) => {
                guardarProductosLocal(PRODUCTS);
                resolve(PRODUCTS);
            });
        }
    });
};

export const crearProducto = (producto: Producto): Promise<Producto> => {
    return new Promise((resolve) => {
        const guardados = leerProductosLocal();
        guardados.push(producto);
        guardarProductosLocal(guardados);
        resolve(producto);
    });
};

export const actualizarProducto = (clave: string, cambios: Partial<Producto>): Promise<void> => {
    return new Promise((resolve) => {
        const guardados = leerProductosLocal().map(p =>
            p.id === clave ? { ...p, ...cambios, id: clave } : p
        );
        guardarProductosLocal(guardados);
        resolve();
    });
};

export const eliminarProducto = (clave: string): Promise<void> => {
    return new Promise((resolve) => {
        const guardados = leerProductosLocal().filter(p => p.id !== clave);
        guardarProductosLocal(guardados);
        resolve();
    });
};

export const subirImagenProducto = (_file: File): Promise<string> => {
    return new Promise((_resolve, reject) => {
        reject(new Error('Supabase no configurado: no se pueden subir imágenes. Usa una URL.'));
    });
};

// Guardar carro local en IndexedDB
export const guardarCarroLocal = (mesaId: number, carro: CarroItem[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('carro_local', 'readwrite');
            const store = transaction.objectStore('carro_local');

            // Eliminar carro anterior si existe
            const deleteRequest = store.delete(mesaId);

            deleteRequest.onsuccess = () => {
                // Guardar nuevo carro
                const saveRequest = store.put({ mesa_id: mesaId, items: carro });

                saveRequest.onsuccess = () => {
                    resolve();
                    closeDB(db);
                };

                saveRequest.onerror = () => {
                    reject('Error al guardar carro: ' + saveRequest.error);
                    closeDB(db);
                };
            };

            deleteRequest.onerror = () => {
                reject('Error al eliminar carro anterior: ' + deleteRequest.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Obtener carro local
export const obtenerCarroLocal = (mesaId: number): Promise<CarroItem[] | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('carro_local', 'readonly');
            const store = transaction.objectStore('carro_local');
            const request = store.get(mesaId);

            request.onsuccess = () => {
                const result = request.result as { items: CarroItem[] } | undefined;
                resolve(result?.items);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener carro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Limpiar carro local
export const limpiarCarroLocal = (mesaId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction('carro_local', 'readwrite');
            const store = transaction.objectStore('carro_local');
            const request = store.delete(mesaId);

            request.onsuccess = () => {
                resolve();
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al limpiar carro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};
