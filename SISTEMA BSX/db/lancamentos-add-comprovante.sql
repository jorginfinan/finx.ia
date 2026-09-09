-- ============================================================
-- Adiciona metadados de auditoria em lancamentos e pendencias
-- para gerar comprovantes (extrato bancário) de cada movimentação.
-- ============================================================

-- LANÇAMENTOS: dispositivo, user agent, quem originou a movimentação (na prestação)
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS device            text,   -- 'mobile' | 'desktop' | 'tablet' (do confirmador)
  ADD COLUMN IF NOT EXISTS user_agent        text,   -- UA curta do confirmador
  ADD COLUMN IF NOT EXISTS originator_user   text,   -- usuário que lançou o pagamento na prestação
  ADD COLUMN IF NOT EXISTS originator_at     timestamptz,
  ADD COLUMN IF NOT EXISTS originator_device text;

-- PENDÊNCIAS: propaga os metadados desde a criação
ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS originator_user   text,
  ADD COLUMN IF NOT EXISTS originator_at     timestamptz,
  ADD COLUMN IF NOT EXISTS originator_device text;

NOTIFY pgrst, 'reload schema';
