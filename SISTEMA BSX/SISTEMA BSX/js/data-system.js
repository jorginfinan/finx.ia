// ============================================
// ARQUIVO 2: NOVO SISTEMA DE DADOS (SUBSTITUI localStorage)
// ============================================
// INSTRUÇÕES:
// 1. Salve este arquivo como: js/data-system.js
// 2. Este arquivo substitui TODAS as chamadas de localStorage
// ============================================

(function() {
  'use strict';

  // ============================================
  // SISTEMA DE GERENTES
  // ============================================
  
  window.GerentesDB = {
    // BUSCAR TODOS OS GERENTES
    async getAll() {
      try {
        const empresaId = await window.getEmpresaAtual();
        const { data, error } = await window.db
          .from('gerentes')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('nome');
        
        if (error) throw error;
        
        // Converte para o formato que o sistema espera
        window.gerentes = (data || []).map(g => ({
          uid: g.uid,
          nome: g.nome,
          tipo: g.tipo,
          comissao: g.comissao,
          telefone: g.telefone,
          endereco: g.endereco,
          observacoes: g.observacoes,
          ativo: g.ativo
        }));
        
        return window.gerentes;
      } catch (error) {
        console.error('❌ Erro ao buscar gerentes:', error);
        window.gerentes = [];
        return [];
      }
    },

    // CRIAR NOVO GERENTE
    async create(gerente) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        // Gera um UID único se não tiver
        if (!gerente.uid) {
          gerente.uid = 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        const { data, error } = await window.db
          .from('gerentes')
          .insert([{
            uid: gerente.uid,
            nome: gerente.nome,
            tipo: gerente.tipo || 'NORMAL',
            comissao: gerente.comissao || 10,
            telefone: gerente.telefone || '',
            endereco: gerente.endereco || '',
            observacoes: gerente.observacoes || '',
            ativo: gerente.ativo !== false,
            empresa_id: empresaId
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao criar gerente:', error);
        throw error;
      }
    },

    // ATUALIZAR GERENTE
    async update(uid, dados) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        const { data, error } = await window.db
          .from('gerentes')
          .update(dados)
          .eq('uid', uid)
          .eq('empresa_id', empresaId)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao atualizar gerente:', error);
        throw error;
      }
    },

    // DELETAR GERENTE
    async delete(uid) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        const { error } = await window.db
          .from('gerentes')
          .delete()
          .eq('uid', uid)
          .eq('empresa_id', empresaId);
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return true;
      } catch (error) {
        console.error('❌ Erro ao deletar gerente:', error);
        return false;
      }
    }
  };

  // ============================================
  // SISTEMA DE DESPESAS
  // ============================================
  
  window.DespesasDB = {
    // BUSCAR TODAS AS DESPESAS
    async getAll() {
      try {
        const empresaId = await window.getEmpresaAtual();
        const { data, error } = await window.db
          .from('despesas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('data', { ascending: false });
        
        if (error) throw error;
        
        // Converte para o formato que o sistema espera
        window.despesas = (data || []).map(d => ({
          uid: d.uid,
          data: d.data,
          gerente: d.gerente_id,
          gerenteNome: d.gerente_nome,
          rota: d.rota,
          ficha: d.ficha,
          descricao: d.descricao,
          valor: d.valor,
          tipo: d.tipo,
          observacao: d.observacao,
          oculta: d.oculta
        }));
        
        return window.despesas;
      } catch (error) {
        console.error('❌ Erro ao buscar despesas:', error);
        window.despesas = [];
        return [];
      }
    },

    // CRIAR NOVA DESPESA
    async create(despesa) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        // Gera um UID único se não tiver
        if (!despesa.uid) {
          despesa.uid = 'd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        const { data, error } = await window.db
          .from('despesas')
          .insert([{
            uid: despesa.uid,
            data: despesa.data,
            gerente_id: despesa.gerente,
            gerente_nome: despesa.gerenteNome,
            rota: despesa.rota || '',
            ficha: despesa.ficha || '',
            descricao: despesa.descricao,
            valor: despesa.valor,
            tipo: despesa.tipo || 'DESPESA',
            observacao: despesa.observacao || '',
            oculta: despesa.oculta || false,
            empresa_id: empresaId
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao criar despesa:', error);
        throw error;
      }
    },

    // ATUALIZAR DESPESA
    async update(uid, dados) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        const { data, error } = await window.db
          .from('despesas')
          .update(dados)
          .eq('uid', uid)
          .eq('empresa_id', empresaId)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao atualizar despesa:', error);
        throw error;
      }
    },

    // DELETAR DESPESA
    async delete(uid) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        const { error } = await window.db
          .from('despesas')
          .delete()
          .eq('uid', uid)
          .eq('empresa_id', empresaId);
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return true;
      } catch (error) {
        console.error('❌ Erro ao deletar despesa:', error);
        return false;
      }
    }
  };

  // ============================================
  // SISTEMA DE PRESTAÇÕES
  // ============================================
  
  window.PrestacoesDB = {
    // BUSCAR TODAS AS PRESTAÇÕES
    async getAll() {
      try {
        const empresaId = await window.getEmpresaAtual();
        const { data, error } = await window.db
          .from('prestacoes')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('data', { ascending: false });
        
        if (error) throw error;
        
        // Converte para o formato que o sistema espera
        window.prestacoes = (data || []).map(p => ({
          uid: p.uid,
          data: p.data,
          periodo: p.periodo,
          gerenteId: p.gerente_id,
          gerenteNome: p.gerente_nome,
          coletas: p.coletas,
          despesas: p.despesas,
          resultado: p.resultado,
          comissao: p.comissao,
          valorComissao: p.valor_comissao,
          aPagar: p.a_pagar,
          saldoAnterior: p.saldo_anterior,
          saldoNovo: p.saldo_novo,
          baseCalculo: p.base_calculo,
          observacao: p.observacao,
          status: p.status
        }));
        
        return window.prestacoes;
      } catch (error) {
        console.error('❌ Erro ao buscar prestações:', error);
        window.prestacoes = [];
        return [];
      }
    },

    // CRIAR NOVA PRESTAÇÃO
    async create(prestacao) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        // Gera um UID único se não tiver
        if (!prestacao.uid) {
          prestacao.uid = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        const { data, error } = await window.db
          .from('prestacoes')
          .insert([{
            uid: prestacao.uid,
            data: prestacao.data,
            periodo: prestacao.periodo,
            gerente_id: prestacao.gerenteId,
            gerente_nome: prestacao.gerenteNome,
            coletas: prestacao.coletas || 0,
            despesas: prestacao.despesas || 0,
            resultado: prestacao.resultado || 0,
            comissao: prestacao.comissao || 10,
            valor_comissao: prestacao.valorComissao || 0,
            a_pagar: prestacao.aPagar || 0,
            saldo_anterior: prestacao.saldoAnterior || 0,
            saldo_novo: prestacao.saldoNovo || 0,
            base_calculo: prestacao.baseCalculo || 0,
            observacao: prestacao.observacao || '',
            status: prestacao.status || 'aberta',
            empresa_id: empresaId
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao criar prestação:', error);
        throw error;
      }
    },

    // ATUALIZAR PRESTAÇÃO
    async update(uid, dados) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        const { data, error } = await window.db
          .from('prestacoes')
          .update(dados)
          .eq('uid', uid)
          .eq('empresa_id', empresaId)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao atualizar prestação:', error);
        throw error;
      }
    }
  };

  // ============================================
  // SISTEMA FINANCEIRO
  // ============================================
  
  window.FinanceiroDB = {
    // BUSCAR TODOS OS LANÇAMENTOS
    async getAll() {
      try {
        const empresaId = await window.getEmpresaAtual();
        const { data, error } = await window.db
          .from('financeiro')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('data', { ascending: false });
        
        if (error) throw error;
        
        // Converte para o formato que o sistema espera
        window.lanc = (data || []).map(l => ({
          id: l.uid,
          data: l.data,
          tipo: l.tipo,
          categoria: l.categoria,
          descricao: l.descricao,
          valor: l.valor,
          formaPagamento: l.forma_pagamento,
          obs: l.observacao
        }));
        
        return window.lanc;
      } catch (error) {
        console.error('❌ Erro ao buscar lançamentos:', error);
        window.lanc = [];
        return [];
      }
    },

    // CRIAR NOVO LANÇAMENTO
    async create(lancamento) {
      try {
        const empresaId = await window.getEmpresaAtual();
        
        // Gera um UID único se não tiver
        const uid = lancamento.id || 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const { data, error } = await window.db
          .from('financeiro')
          .insert([{
            uid: uid,
            data: lancamento.data,
            tipo: lancamento.tipo,
            categoria: lancamento.categoria || '',
            descricao: lancamento.descricao,
            valor: lancamento.valor,
            forma_pagamento: lancamento.formaPagamento || 'DINHEIRO',
            observacao: lancamento.obs || '',
            empresa_id: empresaId
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza a lista local
        await this.getAll();
        
        return data;
      } catch (error) {
        console.error('❌ Erro ao criar lançamento:', error);
        throw error;
      }
    }
  };

  // ============================================
  // INICIALIZAÇÃO AUTOMÁTICA
  // ============================================
  
  window.initDataSystem = async function() {
    console.log('🔄 Carregando dados do Supabase...');
    
    try {
      // Carrega todos os dados
      await Promise.all([
        window.GerentesDB.getAll(),
        window.DespesasDB.getAll(),
        window.PrestacoesDB.getAll(),
        window.FinanceiroDB.getAll()
      ]);
      
      console.log('✅ Dados carregados com sucesso!');
      
      // Dispara evento para indicar que os dados estão prontos
      document.dispatchEvent(new Event('data:ready'));
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    }
  };

  // ============================================
  // SUBSTITUIR FUNÇÕES ANTIGAS DE localStorage
  // ============================================
  
  // Substitui a função jget (que usava localStorage)
  window.jget = function(key, defaultValue) {
    console.warn('⚠️ jget() está obsoleto. Use o novo sistema de dados.');
    
    // Retorna dados da memória para compatibilidade
    switch(key) {
      case 'bsx_gerentes_v2':
        return window.gerentes || defaultValue || [];
      case 'bsx_despesas_v1':
        return window.despesas || defaultValue || [];
      case 'bsx_prest_contas_v1':
        return window.prestacoes || defaultValue || [];
      case 'bsx_fin_lanc':
        return window.lanc || defaultValue || [];
      default:
        return defaultValue;
    }
  };

  // Substitui a função jset (que usava localStorage)
  window.jset = function(key, value) {
    console.warn('⚠️ jset() está obsoleto. Use o novo sistema de dados.');
    
    // Para compatibilidade, apenas atualiza a variável global
    switch(key) {
      case 'bsx_gerentes_v2':
        window.gerentes = value;
        break;
      case 'bsx_despesas_v1':
        window.despesas = value;
        break;
      case 'bsx_prest_contas_v1':
        window.prestacoes = value;
        break;
      case 'bsx_fin_lanc':
        window.lanc = value;
        break;
    }
  };

  console.log('✅ Sistema de dados Supabase carregado!');
  console.log('📊 Use: GerentesDB, DespesasDB, PrestacoesDB, FinanceiroDB');
  
})();