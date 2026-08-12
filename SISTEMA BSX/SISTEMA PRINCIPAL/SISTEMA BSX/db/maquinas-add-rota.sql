-- ============================================================
-- ADICIONA SUPORTE A ROTA NAS MÁQUINAS
-- ============================================================
-- Acrescenta:
--   - maquinas.rota_atual                -> rota associada à máquina hoje
--   - maquinas_movimentacoes.rota        -> rota no momento do evento (snapshot)
--
-- Seguro re-executar: usa "IF NOT EXISTS".
-- ============================================================

ALTER TABLE public.maquinas
  ADD COLUMN IF NOT EXISTS rota_atual text;

ALTER TABLE public.maquinas_movimentacoes
  ADD COLUMN IF NOT EXISTS rota text;

CREATE INDEX IF NOT EXISTS maquinas_rota_atual_idx
  ON public.maquinas(empresa_id, rota_atual)
  WHERE rota_atual IS NOT NULL;

-- Pronto. Recarregue o sistema com Ctrl+Shift+R.
