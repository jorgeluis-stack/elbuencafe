-- ============================================================================
-- C9 FASE 2 — RPC transaccional: public.cobrar_asientos(...)
-- Proyecto: El Buen Café
-- Ejecutar en Supabase Dashboard > SQL Editor DESPUÉS de
-- supabase/c9_cobro_atomico_infra.sql. Requiere privilegios de owner
-- (SECURITY DEFINER, REVOKE/GRANT).
--
-- Contrato:
--   p_mesa_id INT, p_seat_numbers INT[], p_total_recibido NUMERIC(10,2),
--   p_cambio NUMERIC(10,2), p_metodo_pago TEXT ('efectivo'|'electronico'),
--   p_referencia TEXT NULL, p_mesero_id INT, p_idempotency_key TEXT
-- Retorna JSONB:
--   {status, deuda, recibido, cambio, cuentas_cerradas, mesa_liberada,
--    pendientes_restantes}
--   status: COBRADO | YA_PROCESADO | SIN_CAMBIOS
--
-- Semántica contable (FASE 0.1, copiada del camino vivo cobrarAsientos/C5):
--   * cuentas.total_pagado representa el ACUMULADO de importes aplicados a la
--     cuenta por TODAS las operaciones que la liquidaron: cada operación suma
--     ROUND(COALESCE(total_pagado,0) + deuda reclamada por ESTA operación, 2)
--     (ingreso neto por cuenta, cambio = 0). NUNCA se replica el
--     recibido/cambio totales en varias cuentas: el efectivo físico recibido
--     y el cambio pertenecen únicamente al registro económico de la operación
--     (historial_acciones.monto = RECIBIDO total, una sola cabecera por
--     operación con accion='COBRAR_ASIENTOS') y NO se duplican en cada cuenta.
--   * El corte de caja suma cuentas.total_pagado => ingreso neto correcto.
--   * Contradicción documentada (no bloqueante): el camino global legacy
--     cobrarCuenta guarda RECIBIDO en total_pagado; la UI solo usa el camino
--     por asientos. La RPC preserva el camino por asientos.
--
-- Reglas implementadas (C6/C7/C8):
--   * Advisory transaction lock por mesa PRIMERO (mutex primario).
--   * Idempotencia doble capa: L1 misma clave (hash igual -> YA_PROCESADO con
--     el mismo resultado económico almacenado, status transformado solo en la
--     respuesta del replay; hash distinto -> DUPLICATE_KEY_CONFLICT);
--     L2 claves distintas sobre la misma deuda -> el perdedor ve 0 claims y
--     retorna SIN_CAMBIOS sin efectos económicos.
--   * SIN_CAMBIOS nunca se almacena: no bloquea operaciones futuras.
--   * Claims set-based: DELETE..RETURNING (items) y
--     UPDATE..WHERE pagado=false..RETURNING (shares). Sin SELECT-decide-UPDATE.
--   * DEVUELTA es cobrable (entra en claim/deuda/cierre) pero JAMÁS pasa a
--     ENTREGADO (diverge a propósito del filtro C5, que la excluía del cobro;
--     C5 en código NO se modifica).
--   * SHARE_HUERFANO (ítem seat NULL sin shares, o suma != total_item ±1¢)
--     aborta TODA la transacción.
--   * Validación económica dentro de la transacción desde BD (nunca totales UI):
--     efectivo => cambio = recibido - deuda (±1¢, cambio >= -1¢);
--     electrónico => recibido = deuda (±1¢), cambio = 0 (±1¢).
--   * Cuentas: solo se cierran cuentas ABIERTA (bloqueadas) con deuda
--     restante 0 que ESTA operación liquidó (o que ya estaban vacías al
--     bloquear). Nunca se cierra porque otro la cerró.
--   * Escrituras explícitas mínimas: NO se toca minicomandas.cuenta_id ni se
--     reenvían snapshots (compatibilidad C3).
--   * Liberación de mesa condicional con el SQL exacto del spec (sin COBRADA).
--   * SECURITY DEFINER + search_path fijo. Sin withFallback: si Supabase no
--     está disponible la llamada falla en cliente (FAIL CLOSED, fase posterior).
--   * Sin loops de retry. statement_timeout 10s => la contención aborta limpio
--     y revierte todo (caso I).
--
-- Códigos de error (SQLSTATE personalizados clase C9):
--   C9001 DUPLICATE_KEY_CONFLICT (misma clave, parámetros distintos)
--   C9002 SHARE_HUERFANO (integridad de reparto rota)
--   C9003 error de validación/negocio (mensaje con el detalle:
--         MESA_NO_ENCONTRADA, ASIENTOS_INVALIDOS, METODO_INVALIDO,
--         MESERO_INVALIDO, MONTO_INVALIDO, CAMBIO_INVALIDO)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cobrar_asientos(
    p_mesa_id INT,
    p_seat_numbers INT[],
    p_total_recibido NUMERIC(10,2),
    p_cambio NUMERIC(10,2),
    p_metodo_pago TEXT,
    p_referencia TEXT,
    p_mesero_id INT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $func$
DECLARE
    v_recibido NUMERIC(10,2);
    v_cambio NUMERIC(10,2);
    v_seats INT[];
    v_hash TEXT;
    v_prev_hash TEXT;
    v_prev_result JSONB;
    v_mesa_id INT;
    v_mesero_activo BOOLEAN;
    v_cuentas INT[];
    v_deuda_ini_por_cuenta NUMERIC(10,2)[];
    v_cobrado_por_cuenta NUMERIC(10,2)[];
    v_cerradas INT[] := '{}';
    v_deuda NUMERIC(10,2) := 0;
    v_items_claim INT := 0;
    v_shares_claim INT := 0;
    v_minis INT[] := '{}';
    v_pendientes INT;
    v_liberada BOOLEAN;
    v_resultado JSONB;
    v_cuenta_hist INT;
    r_cuenta INT;
    r RECORD;
    v_rest_count INT;
    v_rest_items NUMERIC(10,2);
    v_rest_shares NUMERIC(10,2);
    v_restante NUMERIC(10,2);
    v_claim_cuenta NUMERIC(10,2);
    v_mini_de_item INT;
BEGIN
    -- ---------------------------------------------------------------
    -- 0) Validaciones baratas (antes del lock; sin efectos)
    -- ---------------------------------------------------------------
    IF p_mesa_id IS NULL THEN
        RAISE EXCEPTION 'C9 VALIDACION: MESA_NO_ENCONTRADA' USING ERRCODE = 'C9003';
    END IF;
    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'C9 VALIDACION: IDEMPOTENCY_KEY_INVALIDO' USING ERRCODE = 'C9003';
    END IF;
    SELECT COALESCE(ARRAY_AGG(DISTINCT s ORDER BY s), '{}')
      INTO v_seats
      FROM UNNEST(p_seat_numbers) AS s
     WHERE s IS NOT NULL AND s > 0;
    IF v_seats = '{}' THEN
        RAISE EXCEPTION 'C9 VALIDACION: ASIENTOS_INVALIDOS' USING ERRCODE = 'C9003';
    END IF;
    IF p_total_recibido IS NULL OR p_cambio IS NULL THEN
        RAISE EXCEPTION 'C9 VALIDACION: MONTO_INVALIDO' USING ERRCODE = 'C9003';
    END IF;
    v_recibido := ROUND(p_total_recibido, 2);
    v_cambio := ROUND(p_cambio, 2);
    IF v_recibido < 0 THEN
        RAISE EXCEPTION 'C9 VALIDACION: MONTO_INVALIDO' USING ERRCODE = 'C9003';
    END IF;
    IF p_metodo_pago NOT IN ('efectivo', 'electronico') THEN
        RAISE EXCEPTION 'C9 VALIDACION: METODO_INVALIDO' USING ERRCODE = 'C9003';
    END IF;
    IF p_mesero_id IS NULL THEN
        RAISE EXCEPTION 'C9 VALIDACION: MESERO_INVALIDO' USING ERRCODE = 'C9003';
    END IF;

    -- Hash canónico de la petición (Nivel 1: detectar reuso de clave).
    v_hash := encode(
        digest(
            'mesa=' || p_mesa_id::TEXT
            || '|seats=' || array_to_string(v_seats, ',')
            || '|recibido=' || v_recibido::TEXT
            || '|cambio=' || v_cambio::TEXT
            || '|metodo=' || p_metodo_pago
            || '|ref=' || COALESCE(p_referencia, '')
            || '|mesero=' || p_mesero_id::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- ---------------------------------------------------------------
    -- 1) Mutex primario: advisory transaction lock por mesa.
    --    (Se libera solo al fin de la transacción: éxito o rollback.)
    -- ---------------------------------------------------------------
    PERFORM pg_advisory_xact_lock(hashtextextended('cobro_mesa:' || p_mesa_id::TEXT, 0));

    -- ---------------------------------------------------------------
    -- 2) Idempotencia Nivel 1 (bajo lock: sin carreras).
    -- ---------------------------------------------------------------
    SELECT c.request_hash, c.resultado
      INTO v_prev_hash, v_prev_result
      FROM public.cobro_idempotencia c
     WHERE c.idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_prev_hash = v_hash THEN
            -- YA_PROCESADO: mismo JSON económico, status transformado solo en
            -- la respuesta del replay (el JSON almacenado NO se modifica).
            RETURN jsonb_set(v_prev_result, '{status}', '"YA_PROCESADO"'::JSONB);
        ELSE
            RAISE EXCEPTION 'C9 DUPLICATE_KEY_CONFLICT: la clave ya se usó con parámetros distintos'
                USING ERRCODE = 'C9001';
        END IF;
    END IF;

    -- ---------------------------------------------------------------
    -- 3) Locks de fila en orden determinista: mesa -> cuentas ->
    --    minicomandas -> items -> shares (ids ascendentes).
    -- ---------------------------------------------------------------
    SELECT m.id INTO v_mesa_id
      FROM public.mesas m
     WHERE m.id = p_mesa_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'C9 VALIDACION: MESA_NO_ENCONTRADA' USING ERRCODE = 'C9003';
    END IF;

    SELECT COALESCE(ARRAY_AGG(c.id ORDER BY c.id), '{}')
      INTO v_cuentas
      FROM public.cuentas c
     WHERE c.mesa_id = p_mesa_id
       AND c.estado = 'ABIERTA';
    -- Sin cuentas abiertas no hay nada cobrable (Nivel 2 / mesa ya liquidada).
    IF v_cuentas = '{}' THEN
        SELECT COUNT(*) INTO v_pendientes
          FROM public.cuentas c
         WHERE c.mesa_id = p_mesa_id AND c.estado = 'ABIERTA';
        RETURN jsonb_build_object(
            'status', 'SIN_CAMBIOS',
            'deuda', 0,
            'recibido', v_recibido,
            'cambio', v_cambio,
            'cuentas_cerradas', '[]'::JSONB,
            'mesa_liberada', false,
            'pendientes_restantes', v_pendientes
        );
    END IF;

    -- Mesero válido según reglas actuales (existe y activo).
    SELECT TRUE INTO v_mesero_activo
      FROM public.meseros ms
     WHERE ms.id = p_mesero_id AND ms.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'C9 VALIDACION: MESERO_INVALIDO' USING ERRCODE = 'C9003';
    END IF;

    -- Bloquear cuentas (ya filtradas ABIERTA, ordenadas por id).
    PERFORM 1
      FROM public.cuentas c
     WHERE c.id = ANY(v_cuentas)
     ORDER BY c.id
     FOR UPDATE;

    -- Bloquear minicomandas de esas cuentas (todas: DEVUELTA incluida).
    PERFORM 1
      FROM public.minicomandas mm
     WHERE mm.cuenta_id = ANY(v_cuentas)
     ORDER BY mm.id
     FOR UPDATE;

    -- Bloquear items candidatos (normales del asiento + compartidos).
    PERFORM 1
      FROM public.items_minicomanda im
      JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
     WHERE mm.cuenta_id = ANY(v_cuentas)
       AND (im.seat_number = ANY(v_seats) OR im.seat_number IS NULL)
     ORDER BY im.id
     FOR UPDATE OF im;

    -- Bloquear shares pendientes de los asientos solicitados.
    PERFORM 1
      FROM public.item_comensal_share sh
      JOIN public.items_minicomanda im ON im.id = sh.item_id
      JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
     WHERE mm.cuenta_id = ANY(v_cuentas)
       AND im.seat_number IS NULL
       AND sh.seat_number = ANY(v_seats)
       AND sh.pagado = FALSE
     ORDER BY sh.id
     FOR UPDATE OF sh;

    -- ---------------------------------------------------------------
    -- 4) Integridad de shares ANTES del claim (SHARE_HUERFANO aborta todo).
    --    Aplica a ítems compartidos con deuda pendiente (no liquidados).
    -- ---------------------------------------------------------------
    FOR r IN
        SELECT im.id AS item_id, im.total_item AS total_item,
               COUNT(sh.id) AS n_shares,
               COALESCE(SUM(sh.monto), 0) AS suma_monto,
               BOOL_AND(sh.pagado) AS todo_pagado
          FROM public.items_minicomanda im
          JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
          LEFT JOIN public.item_comensal_share sh ON sh.item_id = im.id
         WHERE mm.cuenta_id = ANY(v_cuentas)
           AND im.seat_number IS NULL
         GROUP BY im.id, im.total_item
    LOOP
        IF r.todo_pagado IS TRUE THEN
            CONTINUE; -- liquidado: trazabilidad conservada, sin deuda
        END IF;
        IF r.n_shares = 0
           OR ABS(ROUND(r.suma_monto, 2) - ROUND(r.total_item, 2)) > 0.01 THEN
            RAISE EXCEPTION 'C9 SHARE_HUERFANO: item % sin reparto válido (shares=%, suma=% vs total=%)',
                r.item_id, r.n_shares, r.suma_monto, r.total_item
                USING ERRCODE = 'C9002';
        END IF;
    END LOOP;

    -- Foto de deuda por cuenta ANTES del claim (para la regla de cierre:
    -- solo cierra lo que ESTA operación liquidó, o lo que ya estaba vacío).
    FOREACH r_cuenta IN ARRAY v_cuentas LOOP
        SELECT COALESCE(SUM(im.total_item), 0) INTO v_rest_items
          FROM public.items_minicomanda im
          JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
         WHERE mm.cuenta_id = r_cuenta
           AND im.seat_number IS NOT NULL;

        SELECT COALESCE(SUM(sh.monto), 0) INTO v_rest_shares
          FROM public.item_comensal_share sh
          JOIN public.items_minicomanda im ON im.id = sh.item_id
          JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
         WHERE mm.cuenta_id = r_cuenta
           AND im.seat_number IS NULL
           AND sh.pagado = FALSE;

        v_deuda_ini_por_cuenta[r_cuenta] :=
            ROUND(v_rest_items, 2) + ROUND(v_rest_shares, 2);
        v_cobrado_por_cuenta[r_cuenta] := 0;
    END LOOP;

    -- ---------------------------------------------------------------
    -- 5) CLAIMS set-based por cuenta (orden determinista por cuenta id).
    --    Items: DELETE..RETURNING. Shares: UPDATE..WHERE pagado=false..RETURNING.
    -- ---------------------------------------------------------------
    FOREACH r_cuenta IN ARRAY v_cuentas LOOP
        v_claim_cuenta := 0;

        -- 5a) Items normales de los asientos solicitados.
        FOR r IN
            DELETE FROM public.items_minicomanda im
            USING public.minicomandas mm
            WHERE im.minicomanda_id = mm.id
              AND mm.cuenta_id = r_cuenta
              AND im.seat_number = ANY(v_seats)
            RETURNING im.id, im.total_item, im.minicomanda_id
        LOOP
            v_items_claim := v_items_claim + 1;
            v_deuda := v_deuda + ROUND(r.total_item, 2);
            v_claim_cuenta := v_claim_cuenta + ROUND(r.total_item, 2);
            IF NOT (r.minicomanda_id = ANY(v_minis)) THEN
                v_minis := v_minis || r.minicomanda_id;
            END IF;
        END LOOP;

        -- 5b) Shares pendientes de los asientos solicitados (ítems compartidos).
        --     RETURNING solo columnas propias; la minicomanda se resuelve por
        --     PK (fila ya bloqueada) para no depender de RETURNING..FROM.
        FOR r IN
            UPDATE public.item_comensal_share sh
               SET pagado = TRUE
              FROM public.items_minicomanda im
              JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
             WHERE sh.item_id = im.id
               AND mm.cuenta_id = r_cuenta
               AND im.seat_number IS NULL
               AND sh.seat_number = ANY(v_seats)
               AND sh.pagado = FALSE
            RETURNING sh.id, sh.monto, sh.item_id
        LOOP
            v_shares_claim := v_shares_claim + 1;
            v_deuda := v_deuda + ROUND(r.monto, 2);
            v_claim_cuenta := v_claim_cuenta + ROUND(r.monto, 2);
            SELECT im.minicomanda_id INTO v_mini_de_item
              FROM public.items_minicomanda im
             WHERE im.id = r.item_id;
            IF NOT (v_mini_de_item = ANY(v_minis)) THEN
                v_minis := v_minis || v_mini_de_item;
            END IF;
        END LOOP;

        v_cobrado_por_cuenta[r_cuenta] :=
            COALESCE(v_cobrado_por_cuenta[r_cuenta], 0) + v_claim_cuenta;
    END LOOP;

    -- ---------------------------------------------------------------
    -- 6) Nivel 2: sin claim no hay derecho de cobro (SIN_CAMBIOS, sin
    --    efectos: hasta aquí solo hubo locks + SELECT).
    -- ---------------------------------------------------------------
    IF v_items_claim = 0 AND v_shares_claim = 0 THEN
        SELECT COUNT(*) INTO v_pendientes
          FROM public.cuentas c
         WHERE c.mesa_id = p_mesa_id AND c.estado = 'ABIERTA';
        RETURN jsonb_build_object(
            'status', 'SIN_CAMBIOS',
            'deuda', 0,
            'recibido', v_recibido,
            'cambio', v_cambio,
            'cuentas_cerradas', '[]'::JSONB,
            'mesa_liberada', false,
            'pendientes_restantes', v_pendientes
        );
    END IF;

    -- ---------------------------------------------------------------
    -- 7) Validación económica desde BD (deuda = lo reclamado).
    --    Un fallo aquí revierte claims + todo (caso I).
    -- ---------------------------------------------------------------
    IF p_metodo_pago = 'efectivo' THEN
        IF ABS((v_recibido - v_deuda) - v_cambio) > 0.01
           OR v_cambio < -0.01 THEN
            RAISE EXCEPTION 'C9 VALIDACION: CAMBIO_INVALIDO (recibido=%, deuda=%, cambio=%)',
                v_recibido, v_deuda, v_cambio USING ERRCODE = 'C9003';
        END IF;
    ELSE -- electronico
        IF ABS(v_recibido - v_deuda) > 0.01 OR ABS(v_cambio) > 0.01 THEN
            RAISE EXCEPTION 'C9 VALIDACION: MONTO_INVALIDO (electronico exige recibido=deuda y cambio=0; recibido=%, deuda=%, cambio=%)',
                v_recibido, v_deuda, v_cambio USING ERRCODE = 'C9003';
        END IF;
    END IF;

    -- ---------------------------------------------------------------
    -- 8) Minicomandas: sin trabajo económico restante -> ENTREGADO,
    --    EXCEPTO DEVUELTA (jamás pasa a ENTREGADO). Solo columnas explícitas.
    -- ---------------------------------------------------------------
    FOR r IN
        SELECT m.id, mm.estado
          FROM UNNEST(v_minis) AS m(id)
          JOIN public.minicomandas mm ON mm.id = m.id
         ORDER BY m.id
    LOOP
        IF r.estado = 'ENTREGADO' OR r.estado = 'DEVUELTA' THEN
            CONTINUE;
        END IF;
        SELECT COUNT(*) INTO v_rest_count
          FROM public.items_minicomanda im
         WHERE im.minicomanda_id = r.id
           AND im.seat_number IS NOT NULL;
        IF v_rest_count > 0 THEN
            CONTINUE; -- queda trabajo de cocina/asientos
        END IF;
        SELECT COALESCE(SUM(sh.monto), 0) INTO v_rest_shares
          FROM public.items_minicomanda im
          JOIN public.item_comensal_share sh ON sh.item_id = im.id
         WHERE im.minicomanda_id = r.id
           AND im.seat_number IS NULL
           AND sh.pagado = FALSE;
        IF v_rest_shares > 0.005 THEN
            CONTINUE; -- quedan participaciones por liquidar
        END IF;
        UPDATE public.minicomandas
           SET estado = 'ENTREGADO',
               fecha_entrega = NOW()
         WHERE id = r.id;
    END LOOP;

    -- ---------------------------------------------------------------
    -- 9) Cuentas: recalcular deuda real desde BD; cerrar solo las que
    --    quedaron sin deuda cobrable Y fueron liquidadas por ESTA operación
    --    (o estaban vacías al bloquear). Escrituras explícitas (C3).
    -- ---------------------------------------------------------------
    FOREACH r_cuenta IN ARRAY v_cuentas LOOP
        SELECT COALESCE(SUM(im.total_item), 0) INTO v_rest_items
          FROM public.items_minicomanda im
          JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
         WHERE mm.cuenta_id = r_cuenta
           AND im.seat_number IS NOT NULL;

        SELECT COALESCE(SUM(sh.monto), 0) INTO v_rest_shares
          FROM public.item_comensal_share sh
          JOIN public.items_minicomanda im ON im.id = sh.item_id
          JOIN public.minicomandas mm ON mm.id = im.minicomanda_id
         WHERE mm.cuenta_id = r_cuenta
           AND im.seat_number IS NULL
           AND sh.pagado = FALSE;

        v_restante := ROUND(v_rest_items, 2) + ROUND(v_rest_shares, 2);
        v_claim_cuenta := COALESCE(v_cobrado_por_cuenta[r_cuenta], 0);

        -- Cierre estricto: sin deuda restante Y (liquidada por esta op
        -- o ya vacía al bloquear, como hace C5). Con deuda restante nunca.
        -- Nunca se cierra una cuenta porque otro la cerró: aquí solo hay
        -- cuentas ABIERTA bloqueadas por esta transacción.
        IF v_restante <= 0.01
           AND (v_claim_cuenta > 0
                OR COALESCE(v_deuda_ini_por_cuenta[r_cuenta], 0) <= 0.01) THEN
            -- Cierre: total_pagado = acumulado previo + deuda reclamada de esta
            -- cuenta por ESTA operación (importe aplicado neto), cambio = 0
            -- (el cambio vive solo en la cabecera de historial).
            UPDATE public.cuentas
               SET estado = 'COBRADA',
                   fecha_cierre = NOW(),
                   total_pagado = ROUND(COALESCE(total_pagado, 0) + v_claim_cuenta, 2),
                   cambio = 0,
                   metodo_pago = p_metodo_pago,
                   referencia_pago = p_referencia
             WHERE id = r_cuenta;
            v_cerradas := v_cerradas || r_cuenta;
        ELSE
            -- Cuenta abierta: se acumula igualmente el aporte económico de esta
            -- operación (sumar 0 es no-op si no reclamó nada de esta cuenta).
            UPDATE public.cuentas
               SET total_acumulado = v_restante,
                   total_pagado = ROUND(COALESCE(total_pagado, 0) + v_claim_cuenta, 2)
             WHERE id = r_cuenta;
        END IF;
    END LOOP;

    -- ---------------------------------------------------------------
    -- 10) Historial: UNA cabecera económica (monto = RECIBIDO, como C5).
    --     Protegida por UNIQUE(idempotency_key) + handler de carrera.
    -- ---------------------------------------------------------------
    IF v_cerradas <> '{}' THEN
        v_cuenta_hist := v_cerradas[1];
    ELSE
        v_cuenta_hist := v_cuentas[1];
    END IF;

    BEGIN
        INSERT INTO public.historial_acciones
            (cuenta_id, mesa_id, mesero_id, accion, descripcion, monto, idempotency_key)
        VALUES
            (v_cuenta_hist, p_mesa_id, p_mesero_id, 'COBRAR_ASIENTOS',
             'C9 cobro atómico asiento(s) ' || array_to_string(v_seats, ', ')
             || '. Deuda: $' || v_deuda::TEXT
             || ', Recibido: $' || v_recibido::TEXT
             || ', Cambio: $' || v_cambio::TEXT
             || ', Método: ' || p_metodo_pago
             || COALESCE(', Ref: ' || p_referencia, '')
             || '. Cuentas cerradas: ' || CASE WHEN v_cerradas = '{}' THEN 'ninguna'
                                                 ELSE array_to_string(v_cerradas, ', ') END,
             v_recibido, p_idempotency_key);
    EXCEPTION WHEN unique_violation THEN
        -- Carrera residual bajo el mismo key: aplicar Nivel 1.
        SELECT c.request_hash, c.resultado
          INTO v_prev_hash, v_prev_result
          FROM public.cobro_idempotencia c
         WHERE c.idempotency_key = p_idempotency_key;
        IF FOUND AND v_prev_hash = v_hash THEN
            -- YA_PROCESADO: mismo JSON económico, status transformado solo en
            -- la respuesta (el registro almacenado NO se modifica).
            RETURN jsonb_set(v_prev_result, '{status}', '"YA_PROCESADO"'::JSONB);
        END IF;
        RAISE EXCEPTION 'C9 DUPLICATE_KEY_CONFLICT: colisión de idempotencia en historial'
            USING ERRCODE = 'C9001';
    END;

    -- ---------------------------------------------------------------
    -- 11) Liberación condicional de mesa (SQL exacto del spec).
    -- ---------------------------------------------------------------
    UPDATE public.mesas
       SET estado = 'LIBRE',
           mesero_activo_id = NULL
     WHERE id = p_mesa_id
       AND NOT EXISTS (
            SELECT 1
              FROM public.cuentas
             WHERE mesa_id = p_mesa_id
               AND estado = 'ABIERTA'
       );

    SELECT COUNT(*) INTO v_pendientes
      FROM public.cuentas c
     WHERE c.mesa_id = p_mesa_id AND c.estado = 'ABIERTA';
    v_liberada := (v_pendientes = 0);

    -- ---------------------------------------------------------------
    -- 12) Resultado + registro de idempotencia (misma transacción).
    -- ---------------------------------------------------------------
    v_resultado := jsonb_build_object(
        'status', 'COBRADO',
        'deuda', v_deuda,
        'recibido', v_recibido,
        'cambio', v_cambio,
        'cuentas_cerradas', COALESCE(
            (SELECT jsonb_agg(x ORDER BY x) FROM UNNEST(v_cerradas) AS x),
            '[]'::JSONB
        ),
        'mesa_liberada', v_liberada,
        'pendientes_restantes', v_pendientes
    );

    INSERT INTO public.cobro_idempotencia (idempotency_key, request_hash, resultado)
    VALUES (p_idempotency_key, v_hash, v_resultado);

    RETURN v_resultado;
END;
$func$;

COMMENT ON FUNCTION public.cobrar_asientos(INT, INT[], NUMERIC, NUMERIC, TEXT, TEXT, INT, TEXT) IS
    'C9: cobro atómico de asientos con advisory lock por mesa, claims set-based e idempotencia doble capa. Ver cabecera del archivo supabase/c9_cobrar_asientos_rpc.sql.';

-- Permisos explícitos: la app usa la anon key. Revocar el default PUBLIC y
-- otorgar solo a los roles de la API. (Ajustar si el proyecto usa otros roles.)
REVOKE ALL ON FUNCTION public.cobrar_asientos(INT, INT[], NUMERIC, NUMERIC, TEXT, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cobrar_asientos(INT, INT[], NUMERIC, NUMERIC, TEXT, TEXT, INT, TEXT) TO anon, authenticated;
