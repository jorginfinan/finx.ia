-- ============================================================
-- Adiciona coluna transaction_id à tabela lancamentos
-- Serve como identificador único humano-legível de cada movimento
-- do caixa, útil para auditoria e detecção de duplicatas.
-- ============================================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS transaction_id text;

-- Índice para busca rápida por transação
CREATE INDEX IF NOT EXISTS lancamentos_transaction_id_idx
  ON public.lancamentos(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Constraint única (previne duplicação mesmo em falha do lock)
ALTER TABLE public.lancamentos
  DROP CONSTRAINT IF EXISTS lancamentos_transaction_id_unique;
ALTER TABLE public.lancamentos
  ADD CONSTRAINT lancamentos_transaction_id_unique UNIQUE (transaction_id);

NOTIFY pgrst, 'reload schema';
