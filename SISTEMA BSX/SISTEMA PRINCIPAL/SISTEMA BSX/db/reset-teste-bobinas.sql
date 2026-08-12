-- ============================================================
-- RESET DE TESTES — BOBINAS (empresa BSX)
-- ============================================================
-- Apaga TODAS as movimentações de bobinas e zera o saldo atual,
-- mas PRESERVA a configuração da bobina (nome, estoque_mínimo,
-- preço de custo, fornecedor padrão).
--
-- Se quiser apagar TAMBÉM a configuração (a linha em "bobinas"),
-- descomente o trecho marcado no final.
--
-- ⚠️  ESTA OPERAÇÃO É IRREVERSÍVEL ⚠️
-- Roda dentro de BEGIN/COMMIT — se algo der errado, NADA é apagado.
-- ============================================================

BEGIN;

DO $$
DECLARE
  emp_id     uuid;
  c_movs     integer;
  c_bobinas  integer;
  saldo_antes integer;
BEGIN
  SELECT id INTO emp_id FROM public.empresas WHERE nome = 'BSX';

  IF emp_id IS NULL THEN
    RAISE EXCEPTION 'Empresa "BSX" não encontrada.';
  END IF;

  -- CONTAGEM ANTES
  SELECT count(*) INTO c_movs    FROM public.bobinas_movimentacoes WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_bobinas FROM public.bobinas               WHERE empresa_id = emp_id;
  SELECT COALESCE(sum(estoque_atual), 0) INTO saldo_antes
    FROM public.bobinas WHERE empresa_id = emp_id;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'EMPRESA BSX: %', emp_id;
  RAISE NOTICE 'ANTES:';
  RAISE NOTICE '  bobinas_movimentacoes...: %', c_movs;
  RAISE NOTICE '  bobinas (config)........: %', c_bobinas;
  RAISE NOTICE '  saldo total atual.......: %', saldo_antes;
  RAISE NOTICE '------------------------------------------------------';

  -- 1) Apaga TODAS as movimentações de bobinas da empresa
  DELETE FROM public.bobinas_movimentacoes
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ bobinas_movimentacoes apagadas';

  -- 2) Zera o saldo da bobina (mantém nome, mínimo, preço, fornecedor)
  UPDATE public.bobinas
     SET estoque_atual = 0
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ saldo de bobinas zerado (config preservada)';

  -- ============================================================
  -- OPCIONAL: apagar TAMBÉM a configuração da bobina.
  -- Descomente as 3 linhas abaixo se quiser zerar absolutamente tudo.
  -- Na próxima vez que abrir a página, o sistema recria uma bobina
  -- padrão automaticamente (nome "Bobina térmica", mínimo 10).
  -- ============================================================
  -- DELETE FROM public.bobinas
  --  WHERE empresa_id = emp_id;
  -- RAISE NOTICE '✅ bobinas (config) também apagadas';

  -- CONTAGEM DEPOIS
  SELECT count(*) INTO c_movs    FROM public.bobinas_movimentacoes WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_bobinas FROM public.bobinas               WHERE empresa_id = emp_id;
  SELECT COALESCE(sum(estoque_atual), 0) INTO saldo_antes
    FROM public.bobinas WHERE empresa_id = emp_id;

  RAISE NOTICE '------------------------------------------------------';
  RAISE NOTICE 'DEPOIS:';
  RAISE NOTICE '  bobinas_movimentacoes...: %', c_movs;
  RAISE NOTICE '  bobinas (config)........: %', c_bobinas;
  RAISE NOTICE '  saldo total atual.......: %', saldo_antes;
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'RESET DE BOBINAS CONCLUÍDO';
  RAISE NOTICE '======================================================';
END $$;

COMMIT;

-- ============================================================
-- Após executar:
--   1) Volte ao sistema no navegador
--   2) Ctrl+Shift+R (recarrega sem cache)
--   3) Vá em "Máquinas → Bobinas — Lançamentos" — saldo zerado
--   4) Vá em "Máquinas → Bobinas — Controle" — tabelas vazias
-- ============================================================
