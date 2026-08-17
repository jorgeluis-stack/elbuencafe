const fs = require('fs');
const code = fs.readFileSync('src/db/SupabaseQueries.ts', 'utf8');
const exportsList = [...code.matchAll(/export const ([a-zA-Z0-9_]+)/g)].map(m => m[1]);

fs.renameSync('src/db/SupabaseQueries.ts', 'src/db/SupabaseQueriesImpl.ts');

let out = `import * as SupabaseImpl from './SupabaseQueriesImpl';
import * as LocalQueries from './Queries';
import { isSupabaseConfigured } from './supabaseClient';

export type * from './SupabaseQueriesImpl';
export * from './Schema';

function withFallback<T extends keyof typeof SupabaseImpl>(name: T): typeof SupabaseImpl[T] {
    return (async (...args: any[]) => {
        const localFn = (LocalQueries as any)[name];
        if (!isSupabaseConfigured()) {
            if (localFn) return localFn(...args);
            return (SupabaseImpl[name] as any)(...args);
        }
        try {
            return await (SupabaseImpl[name] as any)(...args);
        } catch (e: any) {
            console.warn(\`Supabase fallback activated for \${String(name)} due to error: \`, e.message || e);
            if (localFn) return localFn(...args);
            throw e;
        }
    }) as any;
}

`;

for (const name of exportsList) {
    if (name === 'suscribirACambios') {
        // suscribirACambios is a function reference (not a query), delegate lazily to avoid
        // "Cannot access before initialization" on circular/order-dependent ESM evaluation.
        out += `export const suscribirACambios = (...args: any[]) => (SupabaseImpl as any).suscribirACambios(...args);\n`;
    } else {
        out += `export const ${name} = withFallback('${name}');\n`;
    }
}

fs.writeFileSync('src/db/SupabaseQueries.ts', out);
console.log('Proxy created successfully!');
