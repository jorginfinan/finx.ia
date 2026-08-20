-- ============================================================
-- CORREÇÃO — Move pendências/lançamentos do 021 Eduardo Sousa
-- que ficaram na empresa errada (BSX) para a empresa correta (BetPlay)
-- ============================================================
-- Rode este script no Supabase SQL Editor.
-- Ele mostra o que vai mover antes de mover (dentro de BEGIN/COMMIT).
-- Usa comparação por NOME do gerente para funcionar independente do
-- tipo da coluna gerente_id (que pode ser text ou uuid).
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_ger_nome     text;
  v_emp_correta  text;
  v_pend_cnt     integer;
  v_lanc_cnt     integer;
BEGIN
  -- 1) Descobre o gerente e a empresa correta pelo nome parcial
  SELECT g.nome, e.nome
    INTO v_ger_nome, v_emp_correta
    FROM public.gerentes g
    JOIN public.empresas e ON e.id = g.empresa_id
   WHERE g.nome ILIKE '%021%eduardo%sousa%'
   LIMIT 1;

  IF v_ger_nome IS NULL THEN
    RAISE EXCEPTION 'Gerente 021 Eduardo Sousa não encontrado. Ajuste o WHERE.';
  END IF;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'Gerente encontrado: %', v_ger_nome;
  RAISE NOTICE 'Empresa correta: %', v_emp_correta;
  RAISE NOTICE '------------------------------------------------------';

  -- 2) Conta pendências desse gerente na empresa ERRADA (por nome)
  SELECT count(*) INTO v_pend_cnt
    FROM public.pendencias
   WHERE gerente ILIKE '%021%eduardo%sousa%'
     AND company <> v_emp_correta;

  -- 3) Conta lançamentos desse gerente na empresa ERRADA
  SELECT count(*) INTO v_lanc_cnt
    FROM public.lancamentos
   WHERE gerente ILIKE '%021%eduardo%sousa%'
     AND company <> v_emp_correta;

  RAISE NOTICE 'Pendências na empresa errada: %', v_pend_cnt;
  RAISE NOTICE 'Lançamentos na empresa errada: %', v_lanc_cnt;
  RAISE NOTICE '------------------------------------------------------';

  -- 4) Move pendências
  IF v_pend_cnt > 0 THEN
    UPDATE public.pendencias
       SET company = v_emp_correta
     WHERE gerente ILIKE '%021%eduardo%sousa%'
       AND company <> v_emp_correta;
    RAISE NOTICE '✅ % pendência(s) movida(s) para %', v_pend_cnt, v_emp_correta;
  END IF;

  -- 5) Move lançamentos
  IF v_lanc_cnt > 0 THEN
    UPDATE public.lancamentos
       SET company = v_emp_correta
     WHERE gerente ILIKE '%021%eduardo%sousa%'
       AND company <> v_emp_correta;
    RAISE NOTICE '✅ % lançamento(s) movido(s) para %', v_lanc_cnt, v_emp_correta;
  END IF;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'CORREÇÃO CONCLUÍDA';
  RAISE NOTICE '======================================================';
END $$;

COMMIT;

-- ============================================================
-- Para conferir depois:
-- ============================================================
-- SELECT company, count(*) FROM public.pendencias
--  WHERE gerente ILIKE '%021%eduardo%sousa%' GROUP BY company;
-- SELECT company, count(*) FROM public.lancamentos
--  WHERE gerente ILIKE '%021%eduardo%sousa%' GROUP BY company;
