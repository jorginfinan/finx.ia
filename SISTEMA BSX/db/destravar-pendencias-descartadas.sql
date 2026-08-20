-- ============================================================
-- DESTRAVA UIDs bloqueados na tabela pendencias_confirmadas
-- ============================================================
-- Contexto: descartes antigos gravavam o UID em `pendencias_confirmadas`,
-- o que fazia o sistema NÃO recriar aquela pendência mesmo depois de
-- excluir o lançamento e re-lançar o pagamento na prestação.
--
-- Este script mostra os UIDs bloqueados e permite:
--   • Opção A: limpar TODOS os UIDs marcados (recomendado se você acabou
--              de fazer a correção do bug)
--   • Opção B: limpar só os UIDs de um gerente específico
--
-- ⚠️  IRREVERSÍVEL — dentro de BEGIN/COMMIT, se algo falhar nada é apagado.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_total    integer;
  v_bsx      integer;
  v_betplay  integer;
BEGIN
  SELECT count(*)                        INTO v_total    FROM public.pendencias_confirmadas;
  SELECT count(*) FILTER (WHERE company = 'BSX')      INTO v_bsx     FROM public.pendencias_confirmadas;
  SELECT count(*) FILTER (WHERE company = 'BETPLAY')  INTO v_betplay FROM public.pendencias_confirmadas;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'UIDs em pendencias_confirmadas (ANTES):';
  RAISE NOTICE '  Total.....: %', v_total;
  RAISE NOTICE '  BSX.......: %', v_bsx;
  RAISE NOTICE '  BETPLAY...: %', v_betplay;
  RAISE NOTICE '------------------------------------------------------';
END $$;

-- ============================================================
-- OPÇÃO A (Recomendada): limpa TODOS os UIDs marcados
-- Assim qualquer pendência pode ser recriada / re-lançada.
-- Descomente as 2 linhas abaixo se quiser essa opção.
-- ============================================================
-- DELETE FROM public.pendencias_confirmadas;
-- SELECT '✅ TODOS os UIDs travados foram limpos' AS resultado;

-- ============================================================
-- OPÇÃO B: limpa só os UIDs relacionados ao 021 Eduardo Sousa
-- (o UID contém prestacao_id + pag_id — não dá pra filtrar por gerente
--  diretamente, então filtramos por prestações desse gerente)
-- ============================================================
DELETE FROM public.pendencias_confirmadas
 WHERE uid IN (
   SELECT pc.uid
     FROM public.pendencias_confirmadas pc
    WHERE EXISTS (
      SELECT 1
        FROM public.prestacoes p
       WHERE p.gerente_nome ILIKE '%021%eduardo%sousa%'
         AND pc.uid LIKE 'DIVPAG:' || p.uid || ':%'
    )
 );

DO $$
DECLARE
  v_total    integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.pendencias_confirmadas;
  RAISE NOTICE 'UIDs em pendencias_confirmadas (DEPOIS): %', v_total;
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'DESTRAVAMENTO CONCLUÍDO';
  RAISE NOTICE '======================================================';
END $$;

COMMIT;

-- ============================================================
-- APÓS EXECUTAR:
--   1) Vá em Prestações → abra a prestação do 021 Eduardo Sousa
--   2) Se necessário, remova o pagamento DIVIDA_PAGA e recadastre
--   3) Salve a prestação
--   4) A pendência será recriada com a company correta (BetPlay)
--   5) Vá para o caixa da BetPlay → confirme o pagamento
-- ============================================================
