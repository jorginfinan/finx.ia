// ============================================
// SISTEMA DE SALDO ACUMULADO - SUPABASE
// ============================================
(function() {
    'use strict';
  
    // ===== OBTER SALDO ACUMULADO DE UM GERENTE (SUPABASE) =====
    async function getSaldoCarregar(gerenteId, empresaId) {
      try {
        if (!window.SupabaseAPI?.supabase) {
          console.warn('[Saldo] Supabase não disponível');
          return 0;
        }
  
        const { data, error } = await window.SupabaseAPI.supabase
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
        if (!window.SupabaseAPI?.supabase) {
          throw new Error('Supabase não disponível');
        }
  
        const gerente = (window.gerentes || []).find(g => g.uid === gerenteId);
        const timestamp = new Date().toISOString();
  
        // Verifica se já existe
        const { data: existing } = await window.SupabaseAPI.supabase
          .from('saldo_acumulado')
          .select('*')
          .eq('gerente_id', gerenteId)
          .eq('company', empresaId)
          .maybeSingle();
  
        if (existing) {
          // Atualiza
          const { error } = await window.SupabaseAPI.supabase
            .from('saldo_acumulado')
            .update({
              saldo: valor,
              updated_at: timestamp
            })
            .eq('id', existing.id);
  
          if (error) throw error;
        } else {
          // Insere
          const { error } = await window.SupabaseAPI.supabase
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
    async function calcularComissaoComSaldo(params) {
      const {
        gerenteId,
        empresaId,
        coletas,          // Valor total de coletas
        despesas,         // Valor total de despesas
        comissao,         // Percentual de comissão (10, 20, 30, 40 ou 50)
        saldoAnterior     // Opcional: para visualização sem salvar
      } = params;
  
      // Calcula resultado base (Coletas - Despesas)
      const resultado = coletas - despesas;
  
      // Pega saldo anterior (se não fornecido)
      const saldoCarregar = saldoAnterior !== undefined 
        ? saldoAnterior 
        : await getSaldoCarregar(gerenteId, empresaId);
  
      // ===== REGRA: Comissão 50% = SEM SALDO ACUMULADO =====
      if (comissao >= 50) {
        return {
          coletas,
          despesas,
          resultado,
          saldoCarregarAnterior: 0,
          baseCalculo: resultado,
          comissao: comissao,
          valorComissao: (resultado * comissao) / 100,
          saldoCarregarNovo: 0,
          aPagar: (resultado * comissao) / 100,
          observacao: 'Comissão 50% - sem saldo acumulado'
        };
      }
  
      // ===== REGRA: Comissão 10-40% = COM SALDO ACUMULADO =====
      
      let baseCalculo = 0;
      let novoSaldoCarregar = 0;
      let observacao = '';
  
      // CASO 1: Resultado NEGATIVO
      if (resultado < 0) {
        // Acumula o prejuízo
        novoSaldoCarregar = saldoCarregar + Math.abs(resultado);
        baseCalculo = 0;
        observacao = `Prejuízo de R$ ${Math.abs(resultado).toFixed(2)} acumulado. Total a compensar: R$ ${novoSaldoCarregar.toFixed(2)}`;
      }
      // CASO 2: Resultado POSITIVO mas menor que saldo anterior
      else if (resultado > 0 && resultado <= saldoCarregar) {
        // Abate do saldo, mas não paga comissão
        novoSaldoCarregar = saldoCarregar - resultado;
        baseCalculo = 0;
        observacao = `Resultado de R$ ${resultado.toFixed(2)} compensou parte do saldo. Resta R$ ${novoSaldoCarregar.toFixed(2)} a compensar`;
      }
      // CASO 3: Resultado POSITIVO e maior que saldo anterior
      else if (resultado > 0 && resultado > saldoCarregar) {
        // Zera o saldo e calcula comissão sobre o excedente
        novoSaldoCarregar = 0;
        baseCalculo = resultado - saldoCarregar;
        
        if (saldoCarregar > 0) {
          observacao = `Saldo de R$ ${saldoCarregar.toFixed(2)} compensado. Comissão calculada sobre R$ ${baseCalculo.toFixed(2)}`;
        } else {
          observacao = `Comissão calculada sobre resultado total de R$ ${baseCalculo.toFixed(2)}`;
        }
      }
  
      const valorComissao = (baseCalculo * comissao) / 100;
      const aPagar = resultado < 0 ? resultado : valorComissao;
  
      return {
        coletas,
        despesas,
        resultado,
        saldoCarregarAnterior: saldoCarregar,
        baseCalculo,
        comissao,
        valorComissao,
        saldoCarregarNovo: novoSaldoCarregar,
        aPagar,
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
        comissao: prestacao.comissao
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
        if (!window.SupabaseAPI?.supabase) {
          console.warn('[Saldo] Supabase não disponível');
          return [];
        }
  
        // Busca prestações do Supabase
        const { data: prestacoes, error } = await window.SupabaseAPI.supabase
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
        if (!window.SupabaseAPI?.supabase) {
          return [];
        }
  
        const { data, error } = await window.SupabaseAPI.supabase
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
  
    console.log('✅ Sistema de Saldo Acumulado carregado (Supabase)');
  })();