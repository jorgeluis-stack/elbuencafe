# Edge Function `crear-usuario`

Sub-fase 4a. Crea un empleado de forma atómica en cuatro destinos:

1. `auth.users` (email derivado `<username>@elbuencafe.local`, `email_confirm: true`)
2. `public.profiles` — la crea el trigger `handle_new_user` (no se inserta a mano); esta función solo la actualiza con `mesero_id`
3. `public.usuarios_sistema` — `{ username, password, roles, role }`
4. `public.meseros` — `{ nombre, username, password_hash, rol, activo: true }`

Si falla el paso 3, 4 o 5, se revierte en el mismo orden inverso
(`usuarios_sistema` → `meseros` → `auth.admin.deleteUser`). Si el borrado del
usuario de auth falla, responde `500 { error, user_id, partial: true }`.

## Contrato

`POST /crear-usuario`

```json
{ "username": "test_4a", "password": "test123", "roles": ["mesero"], "nombre": "Test 4a" }
```

| Campo | Regla |
| --- | --- |
| `username` | `^[a-z0-9_]{3,30}$` |
| `password` | 6–72 caracteres |
| `roles` | ≥ 1 elemento, subconjunto de `mesero`, `cocina`, `repartidor`. `admin` prohibido en v1 |
| `nombre` | 1–80 caracteres. Si se omite, se usa `username` |

`Authorization: Bearer <access_token>` es obligatorio: la función valida el token
con `auth.getUser` y después exige `roles LIKE '%admin%'` en `profiles`.
El cliente `supabase.functions.invoke` adjunta el JWT de la sesión activo.

| Status | Cuándo |
| --- | --- |
| 201 | `{ user_id, mesero_id, username }` |
| 401 | token ausente, inválido o expirado |
| 403 | caller sin rol `admin` |
| 409 | duplicado en `auth.users`, `profiles` o `usuarios_sistema` |
| 422 | validación de entrada |
| 500 | error interno. Con `partial: true` si no se pudo revertir |

## Seguridad

- Cliente `service_role` creado en runtime desde `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
  + `Deno.env.get('SUPABASE_URL')`. No se lee de `.env`, no se versiona ningún secreto.
- La clave **nunca** se expone al frontend: no existe ningún `VITE_` que la referencie.
- No se registra ni se devuelve la contraseña.

## Deploy (Dashboard, sin CLI)

1. Supabase Dashboard → Edge Functions → New Function → nombre `crear-usuario`
2. Pegar el contenido de `index.ts` → Deploy
3. El código vive en este archivo: cualquier cambio se versiona con commit y se
   vuelve a pegar en el Dashboard

## Verificación

`index.ts` empieza con `// @ts-nocheck`: es un artefacto Deno y `tsconfig.json`
del repo no tiene `exclude`, por lo que `npx tsc --noEmit` lo incluiría y
fallaría por `Deno` y por los imports `https://` / `npm:`. Sin esa directiva,
`tsc` reporta `TS2307` ×2 y `TS2304` ×2.
