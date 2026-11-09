-- ============================================================
-- VIDEO GAME: jogo da máquina e troca de ponto / troca de jogo
-- Execute no Supabase ANTES de subir os arquivos.
-- Pode rodar mais de uma vez. Não apaga nada.
--
-- Cada linha de vg_maquinas é uma INSTALAÇÃO: a máquina em um ponto,
-- com um jogo e a leitura de partida (teste do aplicador).
-- Trocar de ponto ou de jogo encerra a instalação atual e abre outra,
-- ligada à anterior por origem_id, começando da nova leitura de partida.
-- ============================================================

ALTER TABLE public.vg_maquinas
  ADD COLUMN IF NOT EXISTS jogo          text,
  ADD COLUMN IF NOT EXISTS origem_id     uuid REFERENCES public.vg_maquinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instalada_em  date,
  ADD COLUMN IF NOT EXISTS retirada_em   date,
  ADD COLUMN IF NOT EXISTS motivo_saida  text;   -- 'troca_ponto' | 'troca_jogo' | 'retirada'

UPDATE public.vg_maquinas SET instalada_em = created_at::date WHERE instalada_em IS NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT m.nome, m.jogo, p.nome AS ponto, m.ativo, m.instalada_em, m.retirada_em, m.motivo_saida
  FROM public.vg_maquinas m
  JOIN public.vg_pontos p ON p.id = m.ponto_id
 ORDER BY m.nome, m.created_at;
