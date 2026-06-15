-- ============================================================
-- DEFINE SALDO ACUMULADO — 078 CAÇULA = R$ 2.590,68
-- ============================================================
-- Gerente : 078 CAÇULA
-- ID      : dff49af3-336e-41fa-9f2f-b86ddd96c307
-- Empresa : BSX (b61cf5cb-e232-44b1-87b2-951adf7ea14c)
-- Saldo   : 2590.68
--
-- O script:
--   1) confirma que o gerente existe e tem tem_saldo_acumulado=true
--   2) mostra o saldo atual (se existir)
--   3) faz UPDATE se já houver registro, ou INSERT se não houver
--   4) mostra o saldo final pra conferência
--
-- Roda dentro de BEGIN/COMMIT: se algo falhar nada é salvo.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_gerente_id  uuid := 'dff49af3-336e-41fa-9f2f-b86ddd96c307';
  v_empresa_id  uuid := 'b61cf5cb-e232-44b1-87b2-951adf7ea14c';
  v_saldo_novo  numeric := 2590.68;
  v_gerente_rec record;
  v_existing_id uuid;
  v_saldo_antes numeric;
BEGIN
  -- 1) Confere se o gerente existe e tem a flag de saldo acumulado
  SELECT id, nome, tem_saldo_acumulado, empresa_id
    INTO v_gerente_rec
    FROM public.gerentes
   WHERE id = v_gerente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gerente com id % não encontrado.', v_gerente_id;
  END IF;

  IF v_gerente_rec.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Gerente % pertence à empresa %, não à %.',
      v_gerente_rec.nome, v_gerente_rec.empresa_id, v_empresa_id;
  END IF;

  IF NOT v_gerente_rec.tem_saldo_acumulado THEN
    RAISE WARNING 'Gerente % NÃO tem flag tem_saldo_acumulado=true. O saldo será salvo, mas o sistema só usa quando a flag está ativa.',
      v_gerente_rec.nome;
  END IF;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'Gerente: %', v_gerente_rec.nome;
  RAISE NOTICE 'Saldo a definir: R$ %', to_char(v_saldo_novo, 'FM999G999G990D00');
  RAISE NOTICE '------------------------------------------------------';

  -- 2) Checa saldo existente
  SELECT id, saldo
    INTO v_existing_id, v_saldo_antes
    FROM public.saldo_acumulado
   WHERE gerente_id = v_gerente_id
     AND empresa_id = v_empresa_id
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Saldo ANTES: R$ % (registro id=%)',
      to_char(COALESCE(v_saldo_antes, 0), 'FM999G999G990D00'), v_existing_id;
    UPDATE public.saldo_acumulado
       SET saldo = v_saldo_novo
     WHERE id = v_existing_id;
    RAISE NOTICE '✅ UPDATE aplicado';
  ELSE
    RAISE NOTICE 'Nenhum registro anterior — INSERT';
    INSERT INTO public.saldo_acumulado (gerente_id, empresa_id, saldo, created_at)
    VALUES (v_gerente_id, v_empresa_id, v_saldo_novo, now());
    RAISE NOTICE '✅ INSERT aplicado';
  END IF;

  -- 3) Conferência final
  SELECT saldo INTO v_saldo_antes
    FROM public.saldo_acumulado
   WHERE gerente_id = v_gerente_id
     AND empresa_id = v_empresa_id;

  RAISE NOTICE '------------------------------------------------------';
  RAISE NOTICE 'Saldo DEPOIS: R$ %', to_char(COALESCE(v_saldo_antes, 0), 'FM999G999G990D00');
  RAISE NOTICE '======================================================';
END $$;

COMMIT;

-- ============================================================
-- Após executar:
--   1) Volte ao sistema → Ctrl+Shift+R
--   2) Abra uma nova prestação de contas para 078 CAÇULA
--   3) O saldo de R$ 2.590,68 deve aparecer como "Saldo acumulado anterior"
-- ============================================================
