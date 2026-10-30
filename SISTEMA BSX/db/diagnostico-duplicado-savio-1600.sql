-- ============================================================
-- DIAGNÓSTICO (SOMENTE LEITURA) — R$ 1.600,00 do Sávio duplicado no caixa
-- Não altera nada. Rode no SQL Editor e envie o resultado (print ou texto).
--
-- Seções:
--   1) Lançamentos de R$ 1.600 do Sávio no caixa (com códigos, quem, quando, dispositivo)
--   2) Pagamentos de R$ 1.600 gravados nas prestações do Sávio (com código e movimentos)
--   3) Pendências (fila do caixa) dessas prestações
--   4) Travas (UIDs já confirmados/descartados) dessas prestações e desses códigos
-- ============================================================

WITH ger AS (
  SELECT '%s_vio%'::text AS padrao          -- pega "Sávio" e "Savio"
),
prest AS (
  SELECT p.uid, p.periodo_ini::text AS ini, p.periodo_fim::text AS fim,
         p.fechada, p.dados::jsonb AS dados
    FROM public.prestacoes p, ger
   WHERE p.gerente_nome ILIKE ger.padrao
     AND p.periodo_fim::date >= current_date - 45
),
pags AS (
  SELECT pr.*, pg
    FROM prest pr
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pr.dados->'pagamentos', '[]'::jsonb)) pg
)
SELECT '1) LANÇAMENTO NO CAIXA'                                   AS secao,
       l.data::text                                               AS data,
       l.status || ' / ' || COALESCE(l.forma, '')                 AS tipo,
       l.valor::text                                              AS valor,
       COALESCE(l.codigo_origem, '(sem código de origem)')
         || ' | caixa: ' || COALESCE(l.transaction_id, '—')
         || COALESCE(' | corrige ' || l.codigo_referencia, '')    AS codigos,
       'por ' || COALESCE(l.created_by, '?')
         || ' em ' || to_char(l.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI:SS')
         || COALESCE(' | ' || NULLIF(l.device, ''), '')
         || ' | ' || COALESCE(l.categoria, '')
         || ' | uid=' || l.uid                                    AS detalhe
  FROM public.lancamentos l, ger
 WHERE l.gerente ILIKE ger.padrao
   AND round(l.valor::numeric, 2) = 1600
   AND l.data::date >= current_date - 45

UNION ALL
SELECT '2) PAGAMENTO NA PRESTAÇÃO',
       pg->>'data',
       pg->>'forma',
       pg->>'valor',
       COALESCE(pg->>'codigo', '(sem código)')
         || COALESCE(' | movimentos: ' || (pg->'codigos')::text, '')
         || COALESCE(' | substituídos: ' || (pg->'substituidos')::text, ''),
       'prest ' || ini || ' a ' || fim || CASE WHEN fechada THEN ' (fechada)' ELSE ' (aberta)' END
         || ' | pag_id=' || COALESCE(pg->>'id', '?') || ' | prest_uid=' || uid
         || COALESCE(' | lançado por ' || (pg->>'lancadoPor') || ' em ' || (pg->>'lancadoEm'), '')
  FROM pags
 WHERE round((pg->>'valor')::numeric, 2) = 1600

UNION ALL
SELECT '3) PENDÊNCIA (fila do caixa)',
       pe.data::text,
       pe.tipo_caixa || ' / ' || COALESCE(pe.forma, ''),
       pe.valor_original::text,
       pe.uid || COALESCE(' | alt ' || pe.alt_uid, ''),
       'status ' || pe.status || ' | empresa ' || COALESCE(pe.company, '?') || ' | prest_uid=' || pr.uid
  FROM public.pendencias pe
  JOIN prest pr ON pe.prestacao_id::text = pr.uid

UNION ALL
SELECT '4) TRAVA (confirmado/descartado)',
       NULL, NULL, NULL,
       pc.uid,
       'empresa ' || COALESCE(pc.company, '?') || ' | por ' || COALESCE(pc.confirmed_by, '')
  FROM public.pendencias_confirmadas pc
 WHERE EXISTS (SELECT 1 FROM prest pr WHERE pc.uid LIKE '%' || pr.uid || '%')
    OR pc.uid IN (
         SELECT m->>'codigo'
           FROM pags
           CROSS JOIN LATERAL jsonb_array_elements(
             COALESCE(pg->'codigos', '[]'::jsonb) || COALESCE(pg->'substituidos', '[]'::jsonb)) m
       )

ORDER BY 1, 2 NULLS LAST;
