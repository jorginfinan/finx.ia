-- ============================================================
-- DIAGNÓSTICO: lançamentos faltando no caixa da BSXTV (video game)
-- Só consulta (SELECT). Não altera nada.
-- Rode cada bloco e me mande o resultado.
-- ============================================================

-- 1) Total do caixa da BSXTV, separado por modalidade (JB = antes do video game).
--    Total acima de 1000 = mesma causa do "setembro vazio": a tela antiga só trazia
--    os 1000 mais recentes (corrigido no js/financeiro.js).
SELECT company,
       modalidade,
       count(*)  AS lancamentos,
       min(data) AS primeiro,
       max(data) AS ultimo
  FROM public.lancamentos
 WHERE upper(company) LIKE '%TV%'
 GROUP BY company, modalidade
 ORDER BY company, modalidade;

-- 2) Nomes de empresa gravados no caixa (procura variações como "BSX TV" ou "bsxtv")
SELECT company, count(*) AS lancamentos
  FROM public.lancamentos
 GROUP BY company
 ORDER BY company;

-- 3) Lançamentos da BSXTV por mês
SELECT left(data::text, 7) AS mes,
       modalidade,
       count(*) AS lancamentos
  FROM public.lancamentos
 WHERE company = 'BSXTV'
 GROUP BY 1, 2
 ORDER BY 1, 2;

-- 4) Códigos da BSXTV com trava de "já tratado" mas SEM lançamento no caixa.
--    Cada linha é um pagamento que saiu da fila e não está no caixa: ou foi removido
--    de propósito (botão de remover pendência, que grava o nome de quem removeu)
--    ou se perdeu no caminho. "SUBSTITUIDO:..." = trocado por um código novo (normal).
SELECT pc.uid, pc.company, pc.confirmed_by
  FROM public.pendencias_confirmadas pc
 WHERE (pc.uid LIKE 'REC-BSXTV-%' OR pc.uid LIKE 'PAG-BSXTV-%')
   AND NOT EXISTS (SELECT 1 FROM public.lancamentos l WHERE l.codigo_origem = pc.uid)
 ORDER BY pc.uid;

-- 5) Pendências da BSXTV ainda na fila (não confirmadas ainda, por isso fora do caixa)
SELECT uid, gerente, valor_confirm, tipo_caixa, data, modalidade, company
  FROM public.pendencias
 WHERE status = 'PENDENTE'
   AND upper(company) LIKE '%TV%'
 ORDER BY data;
