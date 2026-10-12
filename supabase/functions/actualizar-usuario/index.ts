// @ts-nocheck
// Artefacto Deno (Supabase Edge Function). No forma parte del toolchain Node/Vite
// del repo, por eso se excluye del type-check de `npx tsc --noEmit`.
// Deploy: Dashboard → Edge Functions → New Function → 'actualizar-usuario' → pegar → Deploy.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES_PERMITIDOS = ["mesero", "cocina", "repartidor"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Metodo no permitido: use POST" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Configuracion del servidor incompleta (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { error: "Token de autenticacion ausente" });
  }
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return json(401, { error: "Sesion invalida o expirada" });
  }
  const caller = authData.user;

  const { data: callerProfile, error: callerProfileError } = await admin
    .from("profiles")
    .select("roles")
    .eq("id", caller.id)
    .maybeSingle();
  if (callerProfileError) {
    return json(500, { error: `No se pudo verificar al usuario: ${callerProfileError.message}` });
  }
  const callerRoles = String(callerProfile?.roles ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (!callerRoles.includes("admin")) {
    return json(403, { error: "Solo los administradores pueden actualizar usuarios" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(422, { error: "Cuerpo JSON invalido" });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const roles = (Array.isArray(body.roles) ? body.roles : [])
    .map((r) => String(r).trim().toLowerCase())
    .filter(Boolean);

  if (!UUID_RE.test(userId)) {
    return json(422, { error: "user_id invalido: se espera un UUID" });
  }
  if (roles.length === 0) {
    return json(422, { error: "Debe indicar al menos un rol" });
  }
  if (roles.some((r) => !ROLES_PERMITIDOS.includes(r))) {
    return json(422, { error: `Roles no permitidos. Use un subconjunto de: ${ROLES_PERMITIDOS.join(", ")} (admin no disponible en v1)` });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    return json(500, { error: `No se pudo leer profiles: ${profileError.message}` });
  }
  if (!profile) {
    return json(404, { error: "Usuario no encontrado en profiles" });
  }
  const username = String(profile.username ?? "").trim();
  if (!username) {
    return json(500, { error: "El perfil no tiene username; no se puede sincronizar usuarios_sistema/meseros" });
  }

  const rolesCsv = roles.join(",");

  const { error: updateProfileError } = await admin
    .from("profiles")
    .update({ roles: rolesCsv })
    .eq("id", userId);
  if (updateProfileError) {
    return json(500, { error: `profiles: ${updateProfileError.message}` });
  }

  const { error: updateSistemaError } = await admin
    .from("usuarios_sistema")
    .update({ roles: rolesCsv, role: rolesCsv })
    .eq("username", username);
  if (updateSistemaError) {
    return json(500, { error: `usuarios_sistema: ${updateSistemaError.message}`, user_id: userId, partial: true });
  }

  const { error: updateMeseroError } = await admin
    .from("meseros")
    .update({ rol: rolesCsv })
    .eq("username", username);
  if (updateMeseroError) {
    return json(500, { error: `meseros: ${updateMeseroError.message}`, user_id: userId, partial: true });
  }

  return json(200, { user_id: userId, username, roles });
});
