// src/db/supabaseClient.ts - Cliente Supabase para El Buen Café
// Inicialización segura: no falla si las variables de entorno no están configuradas

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';
const supabaseKey: string = import.meta.env.VITE_PUBLIC_SUPABASE_KEY || '';

/**
 * Cliente Supabase con inicialización perezosa (lazy).
 * Solo se crea si las variables de entorno están configuradas.
 * Si no, retorna null y la app usa localStorage/IndexedDB como fallback.
 */
let _supabase: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient | null => {
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }
    if (!_supabase) {
        try {
            _supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            });
        } catch (error) {
            console.error('❌ Error al inicializar Supabase:', error);
            return null;
        }
    }
    return _supabase;
};

/**
 * Proxy que redirige las llamadas al cliente Supabase real,
 * o lanza un error descriptivo si no está configurado.
 */
const createSupabaseProxy = (): SupabaseClient => {
    const handler: ProxyHandler<object> = {
        get(_target, prop: string) {
            const client = getSupabase();
            if (!client) {
                // Retornar funciones dummy que no crashean pero advierten
                if (prop === 'from') {
                    return (table: string) => {
                        console.warn(`⚠️ Supabase no configurado. Llamada a .from('${table}') ignorada.`);
                        return createDummyQueryBuilder();
                    };
                }
                if (prop === 'channel') {
                    return (..._args: any[]) => {
                        console.warn('⚠️ Supabase no configurado. Canal Realtime ignorado.');
                        return createDummyChannel();
                    };
                }
                if (prop === 'removeChannel') {
                    return (..._args: any[]) => { };
                }
                if (prop === 'auth') {
                    return createDummyAuth();
                }
                return (..._args: any[]) => {
                    console.warn(`⚠️ Supabase no configurado. Llamada a .${prop}() ignorada.`);
                    return Promise.resolve({ data: null, error: null });
                };
            }
            const value = (client as any)[prop];
            return typeof value === 'function' ? value.bind(client) : value;
        }
    };
    return new Proxy({}, handler) as unknown as SupabaseClient;
};

/**
 * QueryBuilder dummy que retorna resultados vacíos en lugar de crashear.
 */
const createDummyQueryBuilder = (): any => {
    const chainable = {
        select: () => chainable,
        insert: () => chainable,
        update: () => chainable,
        delete: () => chainable,
        upsert: () => chainable,
        eq: () => chainable,
        neq: () => chainable,
        gt: () => chainable,
        gte: () => chainable,
        lt: () => chainable,
        lte: () => chainable,
        like: () => chainable,
        ilike: () => chainable,
        is: () => chainable,
        in: () => chainable,
        order: () => chainable,
        limit: () => chainable,
        range: () => chainable,
        single: () => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Supabase not configured' } }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return chainable;
};

/**
 * Canal Realtime dummy.
 */
const createDummyChannel = (): any => ({
    on: () => createDummyChannel(),
    subscribe: () => ({ unsubscribe: () => { } }),
    unsubscribe: () => { },
});

/**
 * Auth dummy.
 */
const createDummyAuth = (): any => ({
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
});

/**
 * Cliente Supabase exportado.
 * - Si las ENV vars están configuradas: cliente real de Supabase
 * - Si no: proxy dummy que no crashea (usa localStorage como fallback)
 */
export const supabase: SupabaseClient = createSupabaseProxy();

/**
 * Verifica si Supabase está correctamente configurado.
 */
export const isSupabaseConfigured = (): boolean => {
    return Boolean(supabaseUrl && supabaseKey);
};

/**
 * Retorna las URLs/config para debugging.
 */
export const getSupabaseConfig = () => ({
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'no configurado',
    configured: isSupabaseConfigured(),
});
