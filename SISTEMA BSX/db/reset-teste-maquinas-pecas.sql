-- ============================================================
-- RESET DE TESTES — MÁQUINAS + PEÇAS (empresa BSX)
-- ============================================================
-- Apaga: maquinas, maquinas_movimentacoes, maquinas_chips_historico,
--        maquinas_pecas, pecas, pecas_movimentacoes
-- PRESERVA: empresa BSX, usuários, gerentes, fichas, prestações,
--           despesas, vales, vendas e tudo mais.
--
-- ⚠️  ESTA OPERAÇÃO É IRREVERSÍVEL ⚠️
-- Execute no Supabase SQL Editor. Roda dentro de BEGIN/COMMIT —
-- se algo der errado no meio, NADA é apagado.
--
-- Como usar:
--   1) Abra o Supabase Studio → SQL Editor → New Query
--   2) Cole TODO este arquivo
--   3) Clique em RUN
--   4) Leia o relatório (linhas DOIS_PONTOS abaixo) para confirmar
-- ============================================================

BEGIN;

-- ============================================================
-- PASSO 0: pega o ID da empresa BSX (se mudar o nome, ajustar aqui)
-- ============================================================
DO $$
DECLARE
  emp_id uuid;
  c_maquinas             integer;
  c_movs                 integer;
  c_chips                integer;
  c_maq_pecas            integer;
  c_pecas                integer;
  c_pecas_movs           integer;
BEGIN
  SELECT id INTO emp_id FROM public.empresas WHERE nome = 'BSX';

  IF emp_id IS NULL THEN
    RAISE EXCEPTION 'Empresa "BSX" não encontrada. Ajuste o nome neste script.';
  END IF;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'EMPRESA BSX: %', emp_id;
  RAISE NOTICE '======================================================';

  -- ============================================================
  -- CONTAGEM ANTES
  -- ============================================================
  SELECT count(*) INTO c_maquinas    FROM public.maquinas                WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_movs        FROM public.maquinas_movimentacoes  WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_chips       FROM public.maquinas_chips_historico WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_maq_pecas   FROM public.maquinas_pecas          WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_pecas       FROM public.pecas                   WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_pecas_movs  FROM public.pecas_movimentacoes     WHERE empresa_id = emp_id;

  RAISE NOTICE 'ANTES:';
  RAISE NOTICE '  maquinas...................: %', c_maquinas;
  RAISE NOTICE '  maquinas_movimentacoes.....: %', c_movs;
  RAISE NOTICE '  maquinas_chips_historico...: %', c_chips;
  RAISE NOTICE '  maquinas_pecas.............: %', c_maq_pecas;
  RAISE NOTICE '  pecas......................: %', c_pecas;
  RAISE NOTICE '  pecas_movimentacoes........: %', c_pecas_movs;
  RAISE NOTICE '------------------------------------------------------';

  -- ============================================================
  -- DELETES — ORDEM IMPORTA (FILHOS ANTES DE PAIS)
  -- ============================================================

  -- 1) maquinas_pecas (depende de maquinas e pecas)
  DELETE FROM public.maquinas_pecas
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ maquinas_pecas apagadas';

  -- 2) pecas_movimentacoes (depende de pecas, maquinas, maquinas_movimentacoes)
  DELETE FROM public.pecas_movimentacoes
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ pecas_movimentacoes apagadas';

  -- 3) maquinas_chips_historico (depende de maquinas)
  DELETE FROM public.maquinas_chips_historico
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ maquinas_chips_historico apagado';

  -- 4) maquinas_movimentacoes (depende de maquinas)
  DELETE FROM public.maquinas_movimentacoes
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ maquinas_movimentacoes apagadas';

  -- 5) maquinas
  DELETE FROM public.maquinas
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ maquinas apagadas';

  -- 6) pecas
  DELETE FROM public.pecas
   WHERE empresa_id = emp_id;
  RAISE NOTICE '✅ pecas apagadas';

  -- ============================================================
  -- CONTAGEM DEPOIS (todos devem estar em 0)
  -- ============================================================
  SELECT count(*) INTO c_maquinas    FROM public.maquinas                WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_movs        FROM public.maquinas_movimentacoes  WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_chips       FROM public.maquinas_chips_historico WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_maq_pecas   FROM public.maquinas_pecas          WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_pecas       FROM public.pecas                   WHERE empresa_id = emp_id;
  SELECT count(*) INTO c_pecas_movs  FROM public.pecas_movimentacoes     WHERE empresa_id = emp_id;

  RAISE NOTICE '------------------------------------------------------';
  RAISE NOTICE 'DEPOIS:';
  RAISE NOTICE '  maquinas...................: %', c_maquinas;
  RAISE NOTICE '  maquinas_movimentacoes.....: %', c_movs;
  RAISE NOTICE '  maquinas_chips_historico...: %', c_chips;
  RAISE NOTICE '  maquinas_pecas.............: %', c_maq_pecas;
  RAISE NOTICE '  pecas......................: %', c_pecas;
  RAISE NOTICE '  pecas_movimentacoes........: %', c_pecas_movs;
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'RESET CONCLUÍDO';
  RAISE NOTICE '======================================================';
END $$;

-- Se algo der errado acima, troque COMMIT por ROLLBACK e re-execute
-- para abortar sem apagar nada.
COMMIT;

-- ============================================================
-- PRÓXIMO PASSO NO APP
-- ============================================================
-- Após executar:
--   1) Volte ao sistema no navegador
--   2) Pressione Ctrl+Shift+R (recarrega ignorando cache)
--   3) Vá em "Máquinas → Cadastro" — tabela vazia
--   4) Vá em "Máquinas → Estoque" — KPIs zerados
--   5) Vá em "Máquinas → Peças" — catálogo vazio
-- ============================================================
