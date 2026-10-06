-- RPC verificar_credenciales
-- Creado: 2026-10-06 (Nivel 1 seguridad, commit e649351)
-- Desplegado en: proyecto klrjltzwuzakclfzngbs (SQL Editor)
-- Fuente: pg_get_functiondef() extraído 2026-10-06
-- Uso desde código: SupabaseQueriesImpl.ts:185 (mesero), :1257 (usuario_sistema)
-- Validado end-to-end: P1-P6 PASS + test_crud con activo=false rechazado

CREATE OR REPLACE FUNCTION public.verificar_credenciales(p_tipo text, p_username text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  IF p_tipo = 'usuario_sistema' THEN
    SELECT id, username, role, roles INTO v_user
    FROM usuarios_sistema
    WHERE username = p_username AND password = p_password
    LIMIT 1;
  ELSIF p_tipo = 'mesero' THEN
    SELECT id, nombre, username, rol, activo INTO v_user
    FROM meseros
    WHERE username = p_username AND password_hash = p_password
      AND activo = true
    LIMIT 1;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  END IF;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'credenciales_invalidas');
  END IF;

  RETURN jsonb_build_object('ok', true, 'usuario', to_jsonb(v_user));
END;
$function$;

REVOKE ALL ON FUNCTION public.verificar_credenciales(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_credenciales(text, text, text) TO anon, authenticated;

-- Source of truth versionado: este archivo preserva la definición exacta de la
-- RPC tal como vive en Supabase (proyecto klrjltzwuzakclfzngbs, desplegada
-- manualmente en SQL Editor el 2026-10-06). Fuente: pg_get_functiondef().
-- Commit del código que la usa: e649351.
-- Tests funcionales: P1-P6 PASS (ver INFORME-FINAL-NIVEL1.md).
-- Desplegado manualmente en SQL Editor el 2026-10-06.
