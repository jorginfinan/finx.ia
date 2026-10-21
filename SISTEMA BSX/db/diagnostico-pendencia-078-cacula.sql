-- ============================================================
-- DIAGNÓSTICO (SOMENTE LEITURA) — pagamento do 078 CAÇULA que não
-- apareceu em "A confirmar" no Financeiro.
-- Não altera nada. Rode no SQL Editor e copie o resultado.
--
-- Seções do resultado:
--   1) Pagamentos gravados nas 3 últimas prestações do 078
--   2) À pagar / Restam de cada prestação
--   3) Pendências criadas para essas prestações
--   4) Travas (UIDs já confirmados/descartados)
--   5) Lançamentos do 078 no caixa (últimos 14 dias)
--   6) Índices da tabela pendencias (para saber se uid é único)
-- ============================================================

secao,prestacao,data,forma_tipo,valor,obs_status,detalhe
1) PAGAMENTO NA PRESTAÇÃO,2026-09-28 a 2026-10-04,2026-10-06,PIX,1225.45,,pag_id=muwpyp3x_ltamdif6s_a | prest_uid=muv8tbqo_voinzjg16_13 | salva em 12/10 01:21
1) PAGAMENTO NA PRESTAÇÃO,2026-10-05 a 2026-10-11,2026-10-14,PIX,1768.6,,pag_id=mv8ircy3_bpfskdhu9_5 | prest_uid=mv58lv28_yp3gwmoif_w | salva em 19/10 09:01
1) PAGAMENTO NA PRESTAÇÃO,2026-10-12 a 2026-10-18,2026-10-19,DIVIDA_PAGA,37096,PIX,pag_id=mvi3hxeq_1hkajipcu_4 | prest_uid=mvf7tgvg_4tkokmtlh_v | salva em 21/10 12:43
1) PAGAMENTO NA PRESTAÇÃO,2026-10-12 a 2026-10-18,2026-10-20,DIVIDA_PAGA,30,PIX,pag_id=mvi3seph_kcu2c0g5r_1 | prest_uid=mvf7tgvg_4tkokmtlh_v | salva em 21/10 12:43
2) RESUMO DA PRESTAÇÃO,2026-10-12 a 2026-10-18,null,aPagar / restam,-37126.3 / -0.3000000000029104,ABERTA,prest_uid=mvf7tgvg_4tkokmtlh_v
2) RESUMO DA PRESTAÇÃO,2026-10-05 a 2026-10-11,null,aPagar / restam,1768.5960000000002 / -0.003999999999678039,FECHADA,prest_uid=mv58lv28_yp3gwmoif_w
2) RESUMO DA PRESTAÇÃO,2026-09-28 a 2026-10-04,null,aPagar / restam,1225.4715 / 0.021500000000060027,FECHADA,prest_uid=muv8tbqo_voinzjg16_13
4) TRAVA (já confirmada/descartada),2026-10-05 a 2026-10-11,null,null,null,"empresa=BSX | por ",P:mv58lv28_yp3gwmoif_w|D:2026-10-14|V:1768.60|F:PIX
4) TRAVA (já confirmada/descartada),2026-10-12 a 2026-10-18,null,null,null,"empresa=BSX | por ",DIVPAG:mvf7tgvg_4tkokmtlh_v:mvi3hxeq_1hkajipcu_4:37096
4) TRAVA (já confirmada/descartada),2026-10-05 a 2026-10-11,null,null,null,"empresa=BSX | por ",prest:mv58lv28_yp3gwmoif_w:mv8ircy3_bpfskdhu9_5:2026-10-14:1768.6
4) TRAVA (já confirmada/descartada),2026-09-28 a 2026-10-04,null,null,null,"empresa=BSX | por ",P:muv8tbqo_voinzjg16_13|D:2026-10-06|V:1225.45|F:PIX
4) TRAVA (já confirmada/descartada),2026-09-28 a 2026-10-04,null,null,null,"empresa=BSX | por ",prest:muv8tbqo_voinzjg16_13:muwpyp3x_ltamdif6s_a:2026-10-06:1225.45
5) LANÇAMENTO NO CAIXA,null,2026-10-14,RECEBIDO / PIX,1768.60,Prestação de contas (ENTRADA) | empresa=BSX,erika
5) LANÇAMENTO NO CAIXA,null,2026-10-19,PAGO / PIX,37096.00,Prestação de contas (SAÍDA) | empresa=BSX,erika
6) ÍNDICES DA TABELA pendencias,null,null,null,null,pendencias_pkey,CREATE UNIQUE INDEX pendencias_pkey ON public.pendencias USING btree (id)
6) ÍNDICES DA TABELA pendencias,null,null,null,null,pendencias_uid_key,CREATE UNIQUE INDEX pendencias_uid_key ON public.pendencias USING btree (uid)
6) ÍNDICES DA TABELA pendencias,null,null,null,null,idx_pendencias_company,CREATE INDEX idx_pendencias_company ON public.pendencias USING btree (company)
6) ÍNDICES DA TABELA pendencias,null,null,null,null,idx_pendencias_uid,CREATE INDEX idx_pendencias_uid ON public.pendencias USING btree (uid)
6) ÍNDICES DA TABELA pendencias,null,null,null,null,idx_pendencias_status,CREATE INDEX idx_pendencias_status ON public.pendencias USING btree (status)
