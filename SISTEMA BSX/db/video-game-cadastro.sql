-- ============================================================
-- VIDEO GAME: cadastro por GERENTE (com vários video games)
-- Execute no Supabase ANTES de subir os arquivos.
-- Pode rodar mais de uma vez. Não apaga nada e não muda nenhum valor.
--
-- 1) Os video games ganham o campo "local" (onde a máquina está,
--    ex.: Bar do João). É opcional e só serve para identificar.
-- 2) As consultas no final são só conferência (não alteram nada).
-- ============================================================

ALTER TABLE public.vg_maquinas ADD COLUMN IF NOT EXISTS local text;

NOTIFY pgrst, 'reload schema';

-- Conferência 1: cadastros do video game e quantos video games ativos cada um tem
SELECT e.nome AS empresa, p.nome AS cadastro, p.gerente_nome,
       count(m.id) FILTER (WHERE m.ativo) AS video_games_ativos,
       p.comissoes
  FROM public.vg_pontos p
  JOIN public.empresas e ON e.id = p.empresa_id
  LEFT JOIN public.vg_maquinas m ON m.ponto_id = p.id
 WHERE p.ativo
 GROUP BY e.nome, p.id, p.nome, p.gerente_nome, p.comissoes
 ORDER BY e.nome, p.gerente_nome, p.nome;

-- Conferência 2: gerente com MAIS DE UM cadastro (era por ponto antes).
-- Se aparecer alguma linha, me envie: a comissão desses cadastros é calculada
-- separada, e o certo agora é um cadastro só com todos os video games do gerente.
SELECT e.nome AS empresa, p.gerente_nome, count(*) AS cadastros,
       string_agg(p.nome, ' | ' ORDER BY p.nome) AS nomes
  FROM public.vg_pontos p
  JOIN public.empresas e ON e.id = p.empresa_id
 WHERE p.ativo
 GROUP BY e.nome, p.gerente_id, p.gerente_nome
HAVING count(*) > 1;
