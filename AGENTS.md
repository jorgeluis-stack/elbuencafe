# AGENTS.md — El Buen Café

## Stack
React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Supabase (PostgreSQL + Realtime). No router library — view switching is state-driven via `currentRole` in OrderContext.

## Commands
- `npm run dev` — Vite dev server on port 3000 (keeps running; app stops if killed)
- `npm run lint` — **Only runs `tsc --noEmit`** (no ESLint/Prettier)
- `npm run build` — Vite production build to `dist/`
- No tests exist. No test framework configured.

## Lint/Typecheck
Run `npx tsc --noEmit` before committing. The only known pre-existing error is `updateAdminCredentials` in AdminDashboard.tsx (not blocking).

## Architecture
- **No router.** `App.tsx` switches views based on `currentRole` state (`login | cliente | mesero | cocina | admin`).
- **Two contexts:** `OrderContext` (client orders) and `AccountContext` (waiter/kitchen flow). They are separate systems.
- **Dual DB:** IndexedDB (local fallback) + Supabase (remote). All DB access goes through `src/db/SupabaseQueries.ts` (auto-generated proxy). Never import from `Queries.ts` or `SupabaseQueriesImpl.ts` directly.
- **Proxy pattern:** `supabaseClient.ts` exports a Proxy. When Supabase env vars are missing, it returns dummy objects — app degrades to IndexedDB.
- If you modify `SupabaseQueriesImpl.ts`, regenerate the proxy: `node generate_proxy.cjs`.

## Supabase
- `.env` contains `VITE_PUBLIC_SUPABASE_URL` and `VITE_PUBLIC_SUPABASE_KEY` (client-safe, public).
- SQL must be run manually in the Supabase dashboard SQL Editor — the terminal cannot access the secret key.
- RLS is enabled but policies are wide open (`FOR ALL USING (true)`). Passwords are plaintext.
- Realtime enabled on: `minicomandas`, `cuentas`, `ordenes_cliente`, `mesas`, `usuarios_sistema`, `meseros`.

## Code Conventions
- **Language:** All UI, comments, variable names, business logic are in **Spanish** (`obtenerTodasLasMesas`, `verificarCredencialesMesero`).
- Component files: PascalCase. DB schemas/types: PascalCase.
- Tailwind utility classes only. Custom CSS in `index.css` uses Tailwind v4 `@theme` block.
- Icons: `lucide-react`. Animations: `motion/react` (framer-motion successor).
- Products are static in `src/data/menu.ts`, cached in localStorage.

## Deployment
Vercel SPA with `vercel.json` rewrites. Build: `vite build`, output: `dist/`.

## Gotchas
- **Two parallel order systems:** Client orders (`ordenes_cliente` table, JSONB items) vs. waiter orders (minicomandas, normalized rows). They don't cross-reference.
- **Two user tables:** `meseros` (staff) and `usuarios_sistema` (login). Roles can be comma-separated strings.
- **Admin ticket printing** uses `Printer` icon from lucide-react and calls `imprimirTicketReparto` from `src/utils/printer.ts`.
- **Client checkout flow:** select payment method (efectivo/tarjeta) -> shows change for cash -> prints ticket.
- **Delivery charge:** `DELIVERY_CHARGE = 25` constant in ClientView, stored as `delivery_charge` in DB.
