-- ============================================================================
-- c9_nivel2_01_profiles_y_trigger.sql
-- Fecha: 2026-10-07
-- Contexto: Nivel 2 sub-fase 1 — tabla public.profiles + trigger auto-creación
--            de profile al registrarse un usuario en auth.users.
--
-- DOCUMENTACIÓN versionada — refleja lo que YA está aplicado en Supabase
-- (proyecto klrjltzwuzakclfzngbs). NO re-ejecutar sin revisar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla public.profiles (definición EXACTA extraída de la base, 2026-10-07)
--    5 columnas: id, username, roles, mesero_id, created_at.
--    SIN columna updated_at. SIN CHECK constraint sobre roles.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username    text        NOT NULL UNIQUE,
  roles       text        NOT NULL DEFAULT 'mesero'::text,
  mesero_id   integer     NULL REFERENCES public.meseros (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice único case-insensitive sobre username.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (lower(username));

-- ----------------------------------------------------------------------------
-- 2. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all
  ON public.profiles
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.roles LIKE '%admin%'
  ));

-- ----------------------------------------------------------------------------
-- 3. Función public.handle_new_user() — verbatim de pg_get_functiondef
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'roles', 'mesero')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4. Trigger on_auth_user_created: AFTER INSERT ON auth.users
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Aplicado manualmente en SQL Editor el 2026-10-07.
-- Verificado end-to-end: 3 users + 3 identities + 3 profiles.
