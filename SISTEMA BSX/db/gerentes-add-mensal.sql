-- ============================================================
-- ADICIONA SUPORTE A PRESTAÇÃO MENSAL EM GERENTES
-- ============================================================
-- Padrão = false (semanal, como hoje).
-- Marque manualmente os gerentes que fazem prestação mensal.
-- ============================================================

ALTER TABLE public.gerentes
  ADD COLUMN IF NOT EXISTS mensal boolean NOT NULL DEFAULT false;

-- Índice parcial para busca rápida dos mensais
CREATE INDEX IF NOT EXISTS gerentes_mensal_idx
  ON public.gerentes(empresa_id)
  WHERE mensal = true;

-- Força o PostgREST a recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';

-- Pronto. Recarregue o sistema com Ctrl+Shift+R.
