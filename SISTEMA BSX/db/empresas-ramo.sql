-- ============================================================
-- RAMO DA EMPRESA: JB, Video game (VG) ou Futebol
-- Execute no Supabase ANTES de subir os arquivos.
-- Pode rodar mais de uma vez. Não apaga nada.
--
-- Todas as empresas ficam como JB (o que já funciona hoje),
-- e a BSXTV passa a ser Video game.
-- ============================================================

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ramo text NOT NULL DEFAULT 'JB';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_ramo_check') THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_ramo_check CHECK (ramo IN ('JB', 'VG', 'FUTEBOL'));
  END IF;
END $$;

UPDATE public.empresas SET ramo = 'VG' WHERE upper(nome) = 'BSXTV';

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT nome, ramo, ativo FROM public.empresas ORDER BY nome;
