// @ts-nocheck
// Artefacto Deno (Supabase Edge Function). No forma parte del toolchain Node/Vite
// del repo, por eso se excluye del type-check de `npx tsc --noEmit`.
// Deploy: Dashboard → Edge Functions → New Function → 'crear-usuario' → pegar → Deploy.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES_PERMITIDOS = ["mesero", "cocina", "repartidor"];
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const DOMINIO_EMAIL = "elbuencafe.local";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esDuplicadoDeAuth(admin: SupabaseClient, email: string): Promise<{ duplicado: boolean; error: string | null }> {
  return (async () => {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return { duplicado: false, error: error.message };
      if ((data.users ?? []).some((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())) {
        return { duplicado: true, error: null };
      }
      if ((data.users ?? []).length < 200) break;
    }
    return { duplicado: false, error: null };
  })();
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
    return json(403, { error: "Solo los administradores pueden crear usuarios" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(422, { error: "Cuerpo JSON invalido" });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roles = (Array.isArray(body.roles) ? body.roles : [])
    .map((r) => String(r).trim().toLowerCase())
    .filter(Boolean);
  const nombre = (typeof body.nombre === "string" ? body.nombre.trim() : "") || username;

  if (!USERNAME_RE.test(username)) {
    return json(422, { error: "Usuario invalido: use 3-30 caracteres minusculas, numeros o guion bajo" });
  }
  if (password.length < 6 || password.length > 72) {
    return json(422, { error: "La contrasena debe tener entre 6 y 72 caracteres" });
  }
  if (roles.length === 0) {
    return json(422, { error: "Debe indicar al menos un rol" });
  }
  if (roles.some((r) => !ROLES_PERMITIDOS.includes(r))) {
    return json(422, { error: `Roles no permitidos. Use un subconjunto de: ${ROLES_PERMITIDOS.join(", ")} (admin no disponible en v1)` });
  }
  if (nombre.length < 1 || nombre.length > 80) {
    return json(422, { error: "El nombre debe tener entre 1 y 80 caracteres" });
  }

  const email = `${username}@${DOMINIO_EMAIL}`;
  const rolesCsv = roles.join(",");

  const emailCheck = await esDuplicadoDeAuth(admin, email);
  if (emailCheck.error) {
    return json(500, { error: `No se pudo verificar auth.users: ${emailCheck.error}` });
  }
  if (emailCheck.duplicado) {
    return json(409, { error: "El usuario ya existe en auth.users" });
  }

  const { data: profiles, error: profilesError } = await admin.from("profiles").select("username");
  if (profilesError) {
    return json(500, { error: `No se pudo verificar profiles: ${profilesError.message}` });
  }
  if ((profiles ?? []).some((p) => String(p.username ?? "").toLowerCase() === username.toLowerCase())) {
    return json(409, { error: "El nombre de usuario ya esta registrado en profiles" });
  }

  const { data: sistema, error: sistemaError } = await admin.from("usuarios_sistema").select("username");
  if (sistemaError) {
    return json(500, { error: `No se pudo verificar usuarios_sistema: ${sistemaError.message}` });
  }
  if ((sistema ?? []).some((u) => String(u.username ?? "").toLowerCase() === username.toLowerCase())) {
    return json(409, { error: "El nombre de usuario ya esta registrado en usuarios_sistema" });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, roles: rolesCsv, nombre },
  });
  if (createError || !created?.user) {
    const mensaje = createError?.message ?? "No se pudo crear el usuario en auth.users";
    const estado = /already/i.test(mensaje) ? 409 : 500;
    return json(estado, { error: mensaje });
  }
  const newUserId = created.user.id;

  let meseroId: number | null = null;
  try {
    const { error: insertUsuario } = await admin.from("usuarios_sistema").insert({
      username,
      password,
      roles: rolesCsv,
      role: rolesCsv,
    });
    if (insertUsuario) {
      throw new Error(`usuarios_sistema: ${insertUsuario.message}`);
    }

    const { data: meseroRow, error: insertMesero } = await admin
      .from("meseros")
      .insert({ nombre, username, password_hash: password, rol: rolesCsv, activo: true })
      .select("id")
      .single();
    if (insertMesero || !meseroRow) {
      throw new Error(`meseros: ${insertMesero?.message ?? "sin id devuelto"}`);
    }
    meseroId = Number(meseroRow.id);

    const { data: perfilActualizado, error: updateProfile } = await admin
      .from("profiles")
      .update({ mesero_id: meseroId })
      .eq("id", newUserId)
      .select("id")
      .single();
    if (updateProfile || !perfilActualizado) {
      throw new Error(
        `profiles: ${updateProfile?.message ?? "perfil no creado por el trigger handle_new_user"}`,
      );
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);

    await admin.from("usuarios_sistema").delete().eq("username", username);
    if (meseroId !== null) {
      await admin.from("meseros").delete().eq("id", meseroId);
    } else {
      await admin.from("meseros").delete().eq("username", username);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(newUserId);
    if (deleteError) {
      return json(500, { error: mensaje, user_id: newUserId, partial: true });
    }
    return json(500, { error: mensaje });
  }

  return json(201, { user_id: newUserId, mesero_id: meseroId, username });
});
