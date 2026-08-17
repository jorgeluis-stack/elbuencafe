// src/db/DB.ts - Configuración de IndexedDB para El Buen Café

import { Mesa, Mesero, Cuenta, Minicomanda, ItemMinicomanda, ItemOpcion, HistorialAccion } from './Schema';

const DB_NAME = 'elbuencafe_db';
const DB_VERSION = 2;

// Función para abrir la base de datos
export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Eliminar tablas existentes para recrearlas con autoIncrement
            const storesToDelete = ['mesas', 'meseros', 'cuentas', 'minicomandas', 'items_minicomanda', 'items_opciones', 'historial_acciones', 'carro_local'];
            storesToDelete.forEach(store => {
                if (db.objectStoreNames.contains(store)) {
                    db.deleteObjectStore(store);
                }
            });

            // Crear tabla de Mesas (Estática pero con autoIncrement por flexibilidad)
            const mesasStore = db.createObjectStore('mesas', { keyPath: 'id', autoIncrement: true });
            mesasStore.createIndex('numero', 'numero', { unique: true });
            mesasStore.createIndex('estado', 'estado', { unique: false });

            // Crear tabla de Meseros (Estática y dinámica)
            const meserosStore = db.createObjectStore('meseros', { keyPath: 'id', autoIncrement: true });
            meserosStore.createIndex('username', 'username', { unique: true });
            meserosStore.createIndex('activo', 'activo', { unique: false });

            // Crear tabla de Cuentas (Entidad Viva)
            const cuentasStore = db.createObjectStore('cuentas', { keyPath: 'id', autoIncrement: true });
            cuentasStore.createIndex('mesa_id', 'mesa_id', { unique: false });
            cuentasStore.createIndex('mesero_id', 'mesero_id', { unique: false });
            cuentasStore.createIndex('estado', 'estado', { unique: false });
            cuentasStore.createIndex('fecha_apertura', 'fecha_apertura', { unique: false });

            // Crear tabla de Minicomandas
            const minicomandasStore = db.createObjectStore('minicomandas', { keyPath: 'id', autoIncrement: true });
            minicomandasStore.createIndex('cuenta_id', 'cuenta_id', { unique: false });
            minicomandasStore.createIndex('mesa_id', 'mesa_id', { unique: false });
            minicomandasStore.createIndex('mesero_id', 'mesero_id', { unique: false });
            minicomandasStore.createIndex('estado', 'estado', { unique: false });
            minicomandasStore.createIndex('fecha_envio', 'fecha_envio', { unique: false });

            // Crear tabla de Items de Minicomanda
            const itemsStore = db.createObjectStore('items_minicomanda', { keyPath: 'id', autoIncrement: true });
            itemsStore.createIndex('minicomanda_id', 'minicomanda_id', { unique: false });
            itemsStore.createIndex('producto_id', 'producto_id', { unique: false });

            // Crear tabla de Items Opciones
            const itemsOpcionesStore = db.createObjectStore('items_opciones', { keyPath: 'id', autoIncrement: true });
            itemsOpcionesStore.createIndex('item_id', 'item_id', { unique: false });

            // Crear tabla de Historial de Acciones
            const historialStore = db.createObjectStore('historial_acciones', { keyPath: 'id', autoIncrement: true });
            historialStore.createIndex('cuenta_id', 'cuenta_id', { unique: false });
            historialStore.createIndex('mesa_id', 'mesa_id', { unique: false });
            historialStore.createIndex('mesero_id', 'mesero_id', { unique: false });
            historialStore.createIndex('fecha', 'fecha', { unique: false });

            // Crear tabla de Carro Local
            db.createObjectStore('carro_local', { keyPath: 'mesa_id' });

            // Datos iniciales para Mesas
            const mesasData: Mesa[] = [
                { id: 1, numero: '1', capacidad: 2, estado: 'LIBRE', ubicacion: 'Interior' },
                { id: 2, numero: '2', capacidad: 4, estado: 'LIBRE', ubicacion: 'Interior' },
                { id: 3, numero: '3', capacidad: 4, estado: 'LIBRE', ubicacion: 'Terraza' },
                { id: 4, numero: '4', capacidad: 6, estado: 'LIBRE', ubicacion: 'Terraza' },
                { id: 5, numero: '5', capacidad: 2, estado: 'LIBRE', ubicacion: 'Barra' },
                { id: 6, numero: '6', capacidad: 2, estado: 'LIBRE', ubicacion: 'Barra' },
                { id: 7, numero: '7', capacidad: 2, estado: 'LIBRE', ubicacion: 'Barra' },
                { id: 8, numero: '8', capacidad: 4, estado: 'LIBRE', ubicacion: 'Terraza' },
                { id: 9, numero: 'Barra', capacidad: 10, estado: 'LIBRE', ubicacion: 'Barra' }
            ];

            mesasData.forEach(mesa => {
                mesasStore.add(mesa);
            });

            // Datos iniciales para Meseros
            const meserosData: Mesero[] = [
                { id: 1, nombre: 'Carlos Méndez', username: 'carlos', password_hash: 'carlos123', rol: 'mesero', activo: true },
                { id: 2, nombre: 'Sofía López', username: 'sofia', password_hash: 'sofia123', rol: 'mesero', activo: true },
                { id: 3, nombre: 'Juan Pérez', username: 'juan', password_hash: 'juan123', rol: 'mesero', activo: true },
                { id: 4, nombre: 'Admin', username: 'admin', password_hash: 'admin123', rol: 'admin', activo: true }
            ];

            meserosData.forEach(mesero => {
                meserosStore.add(mesero);
            });
        };

        request.onsuccess = (event: Event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event: Event) => {
            reject('Error al abrir la base de datos: ' + (event.target as IDBOpenDBRequest).error);
        };
    });
};

// Función para cerrar la base de datos
export const closeDB = (db: IDBDatabase): void => {
    db.close();
};

// Función para leer todos los registros de una store
export const getAllRecords = <T>(storeName: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result as T[]);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener registros: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para obtener un registro por ID
export const getRecordById = <T>(storeName: string, id: number): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result as T | undefined);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener registro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para agregar un registro
export const addRecord = <T>(storeName: string, record: Omit<T, 'id'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(record);

            request.onsuccess = () => {
                resolve(request.result as number);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al agregar registro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para actualizar un registro
export const updateRecord = <T>(storeName: string, record: T): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(record);

            request.onsuccess = () => {
                resolve();
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al actualizar registro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para eliminar un registro
export const deleteRecord = <T>(storeName: string, id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al eliminar registro: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para obtener registros por índice
export const getRecordsByIndex = <T>(storeName: string, indexName: string, value: any): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => {
                resolve(request.result as T[]);
                closeDB(db);
            };

            request.onerror = () => {
                reject('Error al obtener registros por índice: ' + request.error);
                closeDB(db);
            };
        }).catch(reject);
    });
};

// Función para transacción múltiple
export const transactionMultiple = <T>(operations: { storeName: string; operation: 'get' | 'add' | 'put' | 'delete'; key?: number; record?: T }[]): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(operations.map(op => op.storeName), 'readwrite');
            const results: T[] = [];

            operations.forEach((op, index) => {
                const store = transaction.objectStore(op.storeName);
                let request: IDBRequest;

                if (op.operation === 'get') {
                    request = store.get(op.key!);
                } else if (op.operation === 'add') {
                    request = store.add(op.record!);
                } else if (op.operation === 'put') {
                    request = store.put(op.record!);
                } else if (op.operation === 'delete') {
                    request = store.delete(op.key!);
                }

                request.onsuccess = () => {
                    if (op.operation === 'get' || op.operation === 'add') {
                        results[index] = request.result as T;
                    }
                    // Verificar si todas las operaciones están completas
                    if (results.length === operations.length && results.every(r => r !== undefined)) {
                        resolve(results);
                        closeDB(db);
                    }
                };

                request.onerror = () => {
                    reject('Error en operación: ' + request.error);
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
