-- ============================================================
-- DIAGNÓSTICO: meses antigos sumindo do caixa (ex.: setembro vazio)
-- Só consulta (SELECT). Não altera nada.
--
-- Causa: o sistema buscava os lançamentos do caixa numa consulta só, e o
-- Supabase devolve no máximo 1000 linhas por consulta. Como vinham os mais
-- recentes primeiro, tudo que passava dos 1000 (os meses mais antigos)
-- ficava de fora da tela, mas continuava salvo no banco.
-- ============================================================

-- 1) Total de lançamentos por empresa.
--    Acima de 1000 = essa empresa estava com meses antigos faltando na tela.
SELECT company,
       count(*) AS total_lancamentos
  FROM public.lancamentos
 GROUP BY company
 ORDER BY company;

-- 2) Lançamentos por mês e empresa: setembro deve aparecer aqui com os dados intactos.
SELECT company,
       left(data::text, 7) AS mes,
       count(*)            AS lancamentos,
       sum(CASE WHEN status = 'RECEBIDO' THEN valor ELSE 0 END) AS recebido,
       sum(CASE WHEN status = 'PAGO'     THEN valor ELSE 0 END) AS pago
  FROM public.lancamentos
 GROUP BY company, left(data::text, 7)
 ORDER BY company, mes;

-- 3) A partir de que data a tela antiga cortava, por empresa
--    (data do 1000º lançamento mais recente; antes dela nada aparecia).
SELECT company,
       (SELECT l2.data
          FROM public.lancamentos l2
         WHERE l2.company = l.company
         ORDER BY l2.data DESC
         OFFSET 999 LIMIT 1) AS tela_antiga_cortava_antes_de
  FROM public.lancamentos l
 GROUP BY company
 ORDER BY company;
