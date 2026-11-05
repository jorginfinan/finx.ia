-- ============================================================
-- VIDEO GAME: quantidade livre de comissões por ponto
-- Execute no Supabase ANTES de subir os arquivos.
-- Pode rodar mais de uma vez. Não apaga nada.
--
-- As comissões passam a ficar em uma lista por ponto, sempre
-- calculadas sobre o resultado (soma de todos os video games).
-- O que já estava cadastrado nas 3 colunas antigas é copiado.
-- As leituras já salvas guardam os próprios percentuais e não mudam.
-- ============================================================

ALTER TABLE public.vg_pontos ADD COLUMN IF NOT EXISTS comissoes jsonb;

UPDATE public.vg_pontos p
   SET comissoes = COALESCE((
         SELECT jsonb_agg(jsonb_build_object('nome', c.nome, 'pct', c.pct) ORDER BY c.ordem)
           FROM (VALUES (1, p.comissao1_nome, p.comissao1_pct),
                        (2, p.comissao2_nome, p.comissao2_pct),
                        (3, p.comissao3_nome, p.comissao3_pct)) AS c(ordem, nome, pct)
          WHERE c.pct > 0
       ), '[]'::jsonb)
 WHERE p.comissoes IS NULL;

UPDATE public.vg_pontos SET base_comissao = 'saldo' WHERE base_comissao <> 'saldo';

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT nome, comissoes FROM public.vg_pontos ORDER BY nome;
