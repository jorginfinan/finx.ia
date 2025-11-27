// ============================================
// SISTEMA DE SALDO ACUMULADO - SUPABASE
// VERSÃO CORRIGIDA - Suporta 2ª comissão e base COLETAS
// ============================================
(function() {
    'use strict';
  
    // ===== OBTER SALDO ACUMULADO DE UM GERENTE (SUPABASE) =====
    async function getSaldoCarregar(gerenteId, empresaId) {
      try {
        if (!window.SupabaseAPI?.client) {
          console.warn('[Saldo] Supabase não disponível');
          return 0;
        }
  
        const { data, error } = await window.SupabaseAPI.client
          .from('saldo_acumulado')
          .select('saldo')
          .eq('gerente_id', gerenteId)
          .eq('company', empresaId)
          .maybeSingle();
  
        if (error) {
          console.warn('[Saldo] Erro ao buscar:', error);
          return 0;
        }
  
        return data?.saldo || 0;
      } catch(e) {
        console.warn('[Saldo] Erro:', e);
        return 0;
      }
    }
  
    // ===== SALVAR SALDO ACUMULADO (SUPABASE) =====
    async function setSaldoCarregar(gerenteId, empresaId, valor) {
      try {
        if (!window.SupabaseAPI?.client) {
          throw new Error('Supabase não disponível');
        }
  
        const gerente = (window.gerentes || []).find(g => g.uid === gerenteId);
        const timestamp = new Date().toISOString();
  
        // Verifica se já existe
        const { data: existing } = await window.SupabaseAPI.client
          .from('saldo_acumulado')
          .select('*')
          .eq('gerente_id', gerenteId)
          .eq('company', empresaId)
          .maybeSingle();
  
        if (existing) {
          // Atualiza
          const { error } = await window.SupabaseAPI.client
            .from('saldo_acumulado')
            .update({
              saldo: valor,
              updated_at: timestamp
            })
            .eq('id', existing.id);
  
          if (error) throw error;
        } else {
          // Insere
          const { error } = await window.SupabaseAPI.client
            .from('saldo_acumulado')
            .insert([{
              gerente_id: gerenteId,
              gerente_nome: gerente?.nome || 'Desconhecido',
              company: empresaId,
              saldo: valor,
              created_at: timestamp,
              updated_at: timestamp
            }]);
  
          if (error) throw error;
        }
  
        // Dispara evento
        window.dispatchEvent(new CustomEvent('saldo:atualizado', {
          detail: { gerenteId, empresa: empresaId, saldo: valor }
        }));
  
        return { ok: true };
      } catch(e) {
        console.error('[Saldo] Erro ao salvar:', e);
        return { ok: false, error: e.message };
      }
    }
  
    // ===== CALCULAR COMISSÃO COM SALDO ACUMULADO =====
    // ✅ VERSÃO CORRIGIDA: Suporta segunda comissão e diferentes bases de cálculo
    async function calcularComissaoComSaldo(params) {
      const {
        gerenteId,
        empresaId,
        coletas,          // Valor total de coletas
        despesas,         // Valor total de despesas
        comissao,         // Percentual de comissão (10, 20, 30, 40 ou 50)
        comissao2,        // ✅ NOVO: Segunda comissão (opcional)
        saldoAnterior,    // Opcional: para visualização sem salvar
        baseCalculo       // ✅ NOVO: 'COLETAS' ou 'COLETAS_MENOS_DESPESAS'
      } = params;
  
      // Calcula resultado base (Coletas - Despesas)
      const resultado = coletas - despesas;
  
      // Pega saldo anterior (se não fornecido)
      const saldoCarregar = saldoAnterior !== undefined 
        ? saldoAnterior 
        : await getSaldoCarregar(gerenteId, empresaId);
  
      // ===== REGRA: Comissão 50% = SEM SALDO ACUMULADO =====
      if (comissao >= 50) {
        const valorComissaoCalc = (resultado * comissao) / 100;
        return {
          coletas,
          despesas,
          resultado,
          resultadoFinal: resultado - valorComissaoCalc,
          saldoCarregarAnterior: 0,
          baseCalculo: resultado,
          comissao: comissao,
          valorComissao: valorComissaoCalc,
          valorComissao2: 0,
          saldoCarregarNovo: 0,
          aPagar: resultado - valorComissaoCalc,
          observacao: 'Comissão 50% - sem saldo acumulado'
        };
      }
  
      // ===== REGRA: Comissão 10-40% = COM SALDO ACUMULADO =====
      
      let baseParaComissao = 0;
      let novoSaldoCarregar = 0;
      let observacao = '';
  
      // CASO 1: Resultado NEGATIVO
      if (resultado < 0) {
        // Acumula o prejuízo
        novoSaldoCarregar = saldoCarregar + Math.abs(resultado);
        baseParaComissao = 0;
        observacao = `Prejuízo de R$ ${Math.abs(resultado).toFixed(2)} acumulado. Total a compensar: R$ ${novoSaldoCarregar.toFixed(2)}`;
      }
      // CASO 2: Resultado POSITIVO mas menor ou igual ao saldo anterior
      else if (resultado > 0 && resultado <= saldoCarregar) {
        // Abate do saldo, mas não paga comissão
        novoSaldoCarregar = saldoCarregar - resultado;
        baseParaComissao = 0;
        observacao = `Resultado de R$ ${resultado.toFixed(2)} compensou parte do saldo. Resta R$ ${novoSaldoCarregar.toFixed(2)} a compensar`;
      }
      // CASO 3: Resultado POSITIVO e maior que saldo anterior
      else if (resultado > 0 && resultado > saldoCarregar) {
        // Zera o saldo e calcula comissão sobre o excedente
        novoSaldoCarregar = 0;
        baseParaComissao = resultado - saldoCarregar;
        
        if (saldoCarregar > 0) {
          observacao = `Saldo de R$ ${saldoCarregar.toFixed(2)} compensado. Comissão calculada sobre R$ ${baseParaComissao.toFixed(2)}`;
        } else {
          observacao = `Comissão calculada sobre resultado total de R$ ${baseParaComissao.toFixed(2)}`;
        }
      }
  
      // ===== CÁLCULO DAS COMISSÕES =====
      let valorComissaoCalc = 0;
      let valorComissao2Calc = 0;
      let resultadoFinal = resultado;
      
      const perc2 = Number(comissao2) || 0;
      
      if (baseParaComissao > 0) {
        // 1ª Comissão sobre a base (após abater saldo)
        valorComissaoCalc = (baseParaComissao * comissao) / 100;
        
        // 2ª Comissão (se existir) - sobre o que sobra após a 1ª
        if (perc2 > 0) {
          const apos1aComissao = baseParaComissao - valorComissaoCalc;
          if (apos1aComissao > 0) {
            valorComissao2Calc = (apos1aComissao * perc2) / 100;
            resultadoFinal = apos1aComissao - valorComissao2Calc;
          } else {
            valorComissao2Calc = 0;
            resultadoFinal = apos1aComissao;
          }
        } else {
          // Sem segunda comissão
          resultadoFinal = baseParaComissao - valorComissaoCalc;
        }
      } else {
        // Sem base para comissão = sem comissão
        valorComissaoCalc = 0;
        valorComissao2Calc = 0;
        resultadoFinal = resultado; // Mantém o valor (pode ser negativo)
      }
  
      return {
        coletas,
        despesas,
        resultado,
        resultadoFinal,
        saldoCarregarAnterior: saldoCarregar,
        baseCalculo: baseParaComissao,
        comissao,
        valorComissao: valorComissaoCalc,
        valorComissao2: valorComissao2Calc,
        saldoCarregarNovo: novoSaldoCarregar,
        aPagar: resultadoFinal,
        observacao
      };
    }
  
    // ===== SALVAR PRESTAÇÃO COM SALDO =====
    async function salvarPrestacaoComSaldo(prestacao) {
      const calculo = await calcularComissaoComSaldo({
        gerenteId: prestacao.gerenteId,
        empresaId: prestacao.empresaId || window.getCompany(),
        coletas: prestacao.coletas,
        despesas: prestacao.despesas,
        comissao: prestacao.comissao,
        comissao2: prestacao.comissao2 || 0
      });
  
      // Salva o novo saldo a carregar
      await setSaldoCarregar(
        prestacao.gerenteId, 
        prestacao.empresaId || window.getCompany(), 
        calculo.saldoCarregarNovo
      );
  
      // Adiciona informações de cálculo à prestação
      prestacao.saldoCarregarAnterior = calculo.saldoCarregarAnterior;
      prestacao.baseCalculo = calculo.baseCalculo;
      prestacao.valorComissao = calculo.valorComissao;
      prestacao.valorComissao2 = calculo.valorComissao2;
      prestacao.saldoCarregarNovo = calculo.saldoCarregarNovo;
      prestacao.aPagar = calculo.aPagar;
      prestacao.observacao = calculo.observacao;
  
      // Auditoria
      if (window.AuditLog) {
        try {
          await window.AuditLog.log('prestacao_salva_com_saldo', {
            gerente: prestacao.gerenteNome,
            periodo: prestacao.periodo,
            resultado: calculo.resultado,
            saldoAnterior: calculo.saldoCarregarAnterior,
            saldoNovo: calculo.saldoCarregarNovo,
            aPagar: calculo.aPagar
          });
        } catch(e) {
          console.warn('[Saldo] Erro ao registrar auditoria:', e);
        }
      }
  
      return calculo;
    }
  
    // ===== VISUALIZAR HISTÓRICO DE SALDO =====
    async function getHistoricoSaldo(gerenteId, empresaId) {
      try {
        if (!window.SupabaseAPI?.client) {
          console.warn('[Saldo] Supabase não disponível');
          return [];
        }
  
        // Busca prestações do Supabase
        const { data: prestacoes, error } = await window.SupabaseAPI.client
          .from('prestacoes')
          .select('*')
          .eq('gerente_id', gerenteId)
          .eq('company', empresaId)
          .order('data', { ascending: false })
          .limit(50);
  
        if (error) {
          console.warn('[Saldo] Erro ao buscar histórico:', error);
          return [];
        }
  
        if (!prestacoes || !prestacoes.length) {
          return [];
        }
  
        return prestacoes.map(p => ({
          data: p.data || p.created_at,
          periodo: p.periodo,
          coletas: p.coletas || 0,
          despesas: p.despesas || 0,
          resultado: (p.coletas || 0) - (p.despesas || 0),
          saldoAnterior: p.saldo_anterior || 0,
          saldoNovo: p.saldo_novo || 0,
          baseCalculo: p.base_calculo || 0,
          valorComissao: p.valor_comissao || 0,
          aPagar: p.a_pagar || 0
        }));
      } catch(e) {
        console.error('[Saldo] Erro ao buscar histórico:', e);
        return [];
      }
    }
  
    // ===== RESETAR SALDO (ADMIN APENAS) =====
    async function resetarSaldo(gerenteId, empresaId) {
      if (window.UserAuth?.currentUser()?.role !== 'admin') {
        return { ok: false, error: 'Apenas administradores podem resetar saldo' };
      }
  
      const result = await setSaldoCarregar(gerenteId, empresaId, 0);
      
      if (result.ok && window.AuditLog) {
        try {
          await window.AuditLog.log('saldo_resetado', {
            gerenteId,
            empresaId
          });
        } catch(e) {
          console.warn('[Saldo] Erro ao registrar auditoria:', e);
        }
      }
  
      return result;
    }
  
    // ===== LISTAR TODOS OS SALDOS =====
    async function listarSaldos(empresaId) {
      try {
        if (!window.SupabaseAPI?.client) {
          return [];
        }
  
        const { data, error } = await window.SupabaseAPI.client
          .from('saldo_acumulado')
          .select('*')
          .eq('company', empresaId)
          .order('gerente_nome');
  
        if (error) {
          console.warn('[Saldo] Erro ao listar:', error);
          return [];
        }
  
        return data || [];
      } catch(e) {
        console.error('[Saldo] Erro ao listar saldos:', e);
        return [];
      }
    }
  
    // ===== EXPORTAR API =====
    window.SaldoAcumulado = {
      calcular: calcularComissaoComSaldo,
      getSaldo: getSaldoCarregar,
      setSaldo: setSaldoCarregar,
      salvarPrestacao: salvarPrestacaoComSaldo,
      getHistorico: getHistoricoSaldo,
      resetar: resetarSaldo,
      listar: listarSaldos
    };
  
    console.log('✅ Sistema de Saldo Acumulado carregado (Supabase) - v2.0');
  })();