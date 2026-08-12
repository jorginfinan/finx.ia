-- ============================================================
-- ADICIONA SUPORTE A ROTA NAS MOVIMENTAÇÕES DE BOBINAS
-- ============================================================
-- Acrescenta `rota` em bobinas_movimentacoes para registrar a rota
-- associada à entrega (vinda do cadastro de fichas → área).
--
-- Seguro re-executar: usa "IF NOT EXISTS".
-- ============================================================

ALTER TABLE public.bobinas_movimentacoes
  ADD COLUMN IF NOT EXISTS rota text;

CREATE INDEX IF NOT EXISTS bob_movs_rota_idx
  ON public.bobinas_movimentacoes(empresa_id, rota)
  WHERE rota IS NOT NULL;

-- Pronto. Recarregue o sistema com Ctrl+Shift+R.
