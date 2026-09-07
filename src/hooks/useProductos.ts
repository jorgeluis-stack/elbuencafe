// src/hooks/useProductos.ts - Catálogo de platillos vivo con Realtime
// Fuente: tabla `productos` en Supabase (con fallback a localStorage).
// Se actualiza al instante cuando el admin modifica el menú.

import { useState, useEffect, useCallback } from 'react';
import { listarProductos, suscribirACambios } from '../db/SupabaseQueries';
import { Producto } from '../db/Schema';

export const useProductos = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await listarProductos();
            setProductos(data || []);
        } catch (error) {
            console.error('Error cargando productos:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const unsubscribe = suscribirACambios('productos', () => {
            refresh();
        });
        return () => unsubscribe();
    }, [refresh]);

    return { productos, loading, refresh };
};