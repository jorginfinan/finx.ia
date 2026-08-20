-- ============================================================
-- ADICIONA `emoji` e `ativo` à tabela empresas
-- ============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🏢';

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Índice p/ busca só de ativas
CREATE INDEX IF NOT EXISTS empresas_ativas_idx ON public.empresas(ativo) WHERE ativo = true;

-- Recarrega schema cache imediatamente
NOTIFY pgrst, 'reload schema';
