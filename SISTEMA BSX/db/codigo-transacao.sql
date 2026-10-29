-- ============================================================
-- CÓDIGOS DE TRANSAÇÃO
--   Código de origem  (nasce ao lançar o pagamento na prestação)
--     REC-BSX-041-261016-K7Q2  → recebimento (gerente → empresa)
--     PAG-BSX-041-261016-K7Q2  → pagamento   (empresa → gerente)
--     MAN-BSX-041-261016-K7Q2  → lançado direto no caixa
--   Código do caixa   (nasce na confirmação)
--     CX-BSX-261016-9F3A
--   Correção de valor: gera um novo código de origem com a diferença;
--   codigo_referencia aponta para o código corrigido.
--
-- Pode rodar mais de uma vez (tudo é IF NOT EXISTS).
-- Também cria as colunas do comprovante, caso ainda não existam.
-- ============================================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS codigo_origem     text,
  ADD COLUMN IF NOT EXISTS codigo_referencia text,   -- código corrigido (quando é uma correção)
  ADD COLUMN IF NOT EXISTS transaction_id    text,
  ADD COLUMN IF NOT EXISTS device            text,
  ADD COLUMN IF NOT EXISTS user_agent        text,
  ADD COLUMN IF NOT EXISTS originator_user   text,
  ADD COLUMN IF NOT EXISTS originator_at     timestamptz,
  ADD COLUMN IF NOT EXISTS originator_device text;

ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS codigo_referencia text,
  ADD COLUMN IF NOT EXISTS originator_user   text,
  ADD COLUMN IF NOT EXISTS originator_at     timestamptz,
  ADD COLUMN IF NOT EXISTS originator_device text;

-- 🔒 Um pagamento da prestação só pode entrar UMA vez no caixa
CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_codigo_origem_unique
  ON public.lancamentos (codigo_origem)
  WHERE codigo_origem IS NOT NULL;

-- 🔒 Código do caixa nunca se repete
CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_transaction_id_unique_idx
  ON public.lancamentos (transaction_id)
  WHERE transaction_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename = 'lancamentos'
   AND indexname IN ('lancamentos_codigo_origem_unique', 'lancamentos_transaction_id_unique_idx');
