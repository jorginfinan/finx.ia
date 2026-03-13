// ============================================
// PRESTAÇÕES SUPABASE V2 - ESTRUTURA ADAPTADA
// ============================================

(function() {
  'use strict';
  
  const DB_PREST_LOCAL = window.DB_PREST || 'bsx_prest_contas_v1';
  const DB_EMPRESA_KEY = `${window.getCompany ? window.getCompany() : 'BSX'}__${DB_PREST_LOCAL}`;
  
  // ============================================
  // FUNÇÕES DE SUPABASE
  // ============================================
  
  async function getEmpresaId() {
    const nomeEmpresa = window.getCompany ? window.getCompany() : 'BSX';
    
    try {
      const { data, error } = await window.SupabaseAPI.client
        .from('empresas')
        .select('id')
        .eq('nome', nomeEmpresa)
        .single();
      
      if (error) throw error;
      return data?.id || null;
    } catch(e) {
      console.error('[Prestações] Erro ao buscar empresa:', e);
      return null;
    }
  }
  
  // ============================================
  // CONVERTER FORMATO LOCAL → SUPABASE
  // ============================================
  
  function converterParaSupabase(prestacao) {
    const resumo = prestacao.resumo || {};
    
    return {
      uid: prestacao.id,
      gerente_id: prestacao.gerenteId,
      gerente_nome: prestacao.gerenteNome,
      periodo: `${prestacao.ini} a ${prestacao.fim}`,
      periodo_ini: prestacao.ini,
      periodo_fim: prestacao.fim,
      data: prestacao.fim || prestacao.ini,
      status: prestacao.fechado ? 'fechada' : 'aberta',
      // Valores numéricos extraídos
      coletas: Number(resumo.coletas) || 0,
      despesas: Number(resumo.despesas) || 0,
      vales: Number(resumo.totalVales) || 0,
      comissao_percentual: Number(resumo.perc) || 0,
      base_calculo: Number(resumo.baseComissao) || 0,
      valor_comissao: Number(resumo.comissaoVal) || 0,
      saldo_carregar_anterior: Number(prestacao.saldoInfo?.saldoCarregarAnterior) || 0,
      saldo_carregar_novo: Number(prestacao.saldoInfo?.saldoCarregarNovo) || 0,
      a_pagar: Number(resumo.aPagar) || 0,
      observacoes: prestacao.saldoInfo?.observacao || null,
      fechada: prestacao.fechado || false,
      // Dados completos em JSONB — despesas NÃO são salvas aqui,
      // vivem exclusivamente na tabela despesas (fonte de verdade única)
      dados: {
        coletas: prestacao.coletas || [],
        despesas: [],
        pagamentos: prestacao.pagamentos || [],
        vales: prestacao.vales || [],
        valesSel: prestacao.valesSel || [],
        resumo: prestacao.resumo || {},
        saldoInfo: prestacao.saldoInfo || null,
        valeParcAplicado: prestacao.valeParcAplicado || []
      },
      pago: prestacao.pagamentos || [],
      created_at: new Date().toISOString()
    };
  }
  
  // ============================================
  // CONVERTER FORMATO SUPABASE → LOCAL
  // ============================================
  
  function converterParaLocal(registro) {
    const dados = registro.dados || {};
    
    return {
      id: registro.uid,
      gerenteId: registro.gerente_id,
      gerenteNome: registro.gerente_nome,
      ini: registro.periodo_ini,
      fim: registro.periodo_fim,
      coletas: dados.coletas || [],
      despesas: dados.despesas || [],
      pagamentos: dados.pagamentos || registro.pago || [],
      vales: dados.vales || [],
      valesSel: dados.valesSel || [],
      resumo: dados.resumo || {},
      saldoInfo: dados.saldoInfo || null,
      valeParcAplicado: dados.valeParcAplicado || [],
      fechado: registro.fechada || false
    };
  }
  
  // ============================================
  // SALVAR PRESTAÇÃO NO SUPABASE
  // ============================================
  
  async function salvarPrestacaoSupabase(prestacao) {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) throw new Error('Empresa não encontrada');
      
      // Converte para estrutura do Supabase
      const payload = converterParaSupabase(prestacao);
      payload.empresa_id = empresaId;
      
      // Verifica se já existe
      const { data: existing } = await window.SupabaseAPI.client
        .from('prestacoes')
        .select('id')
        .eq('uid', prestacao.id)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      
      if (existing) {
        // Atualiza
        const { data, error } = await window.SupabaseAPI.client
          .from('prestacoes')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        console.log('✅ Prestação atualizada no Supabase:', prestacao.id);
        return data;
      } else {
        // Insere
        const { data, error } = await window.SupabaseAPI.client
          .from('prestacoes')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        console.log('✅ Prestação salva no Supabase:', prestacao.id);
        return data;
      }
    } catch(e) {
      console.error('[Prestações] Erro ao salvar no Supabase:', e);
      throw e;
    }
  }
  
  // ============================================
  // CARREGAR PRESTAÇÕES DO SUPABASE
  // ============================================
  
  async function carregarPrestacoesSupabase() {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return [];
      
      const { data, error } = await window.SupabaseAPI.client
        .from('prestacoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('periodo_fim', { ascending: false });
      
      if (error) throw error;
      
      // Converte para formato local
      return (data || []).map(converterParaLocal);
    } catch(e) {
      console.error('[Prestações] Erro ao carregar do Supabase:', e);
      return [];
    }
  }
  
  // ============================================
  // DELETAR PRESTAÇÃO DO SUPABASE
  // ============================================
  
  async function deletarPrestacaoSupabase(uid) {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) throw new Error('Empresa não encontrada');
      
      const { error } = await window.SupabaseAPI.client
        .from('prestacoes')
        .delete()
        .eq('uid', uid)
        .eq('empresa_id', empresaId);
      
      if (error) throw error;
      console.log('✅ Prestação deletada do Supabase:', uid);
      return true;
    } catch(e) {
      console.error('[Prestações] Erro ao deletar do Supabase:', e);
      throw e;
    }
  }
  
  // ============================================
  // MIGRAÇÃO DO LOCALSTORAGE PARA SUPABASE
  // ============================================
  
  async function migrarPrestacoesParaSupabase() {
    try {
      console.log('🔄 Iniciando migração de prestações...');
      
      // Carrega do localStorage com chave da empresa
      const prestsLocal = JSON.parse(localStorage.getItem(DB_EMPRESA_KEY) || '[]');
      
      if (!Array.isArray(prestsLocal) || prestsLocal.length === 0) {
        console.log('📭 Nenhuma prestação para migrar');
        return { sucesso: 0, erros: 0 };
      }
      
      console.log(`📦 Encontradas ${prestsLocal.length} prestações no localStorage`);
      
      let sucesso = 0;
      let erros = 0;
      
      for (const prest of prestsLocal) {
        try {
          await salvarPrestacaoSupabase(prest);
          sucesso++;
        } catch(e) {
          console.error('❌ Erro ao migrar prestação:', prest.id, e);
          erros++;
        }
      }
      
      console.log(`✅ Migração concluída! Sucesso: ${sucesso}, Erros: ${erros}`);
      
      if (erros === 0) {
        console.log('🎉 Todas as prestações foram migradas com sucesso!');
        console.log('💡 Agora as prestações estarão disponíveis em todos os dispositivos!');
      }
      
      return { sucesso, erros, total: prestsLocal.length };
    } catch(e) {
      console.error('[Prestações] Erro na migração:', e);
      throw e;
    }
  }
  
  // ============================================
  // SUBSTITUIR FUNÇÕES GLOBAIS
  // ============================================
  
  // Salvar prestação — somente Supabase
  window.salvarPrestacaoGlobal = async function(prestacao) {
    try {
      await salvarPrestacaoSupabase(prestacao);
      return true;
    } catch(e) {
      console.error('[Prestações] Erro ao salvar:', e);
      throw e;
    }
  };
  
  // Carregar prestações — somente Supabase
  window.carregarPrestacoesGlobal = async function() {
    try {
      return await carregarPrestacoesSupabase();
    } catch(e) {
      console.error('[Prestações] Erro ao carregar do Supabase:', e);
      return [];
    }
  };
  
  // Deletar prestação — somente Supabase
  window.deletarPrestacaoGlobal = async function(uid) {
    try {
      await deletarPrestacaoSupabase(uid);
      return true;
    } catch(e) {
      console.error('[Prestações] Erro ao deletar:', e);
      throw e;
    }
  };
  
  // ============================================
  // EXPORTAR API
  // ============================================
  
  window.PrestacoesSupabase = {
    salvar: salvarPrestacaoSupabase,
    carregar: carregarPrestacoesSupabase,
    deletar: deletarPrestacaoSupabase,
    migrar: migrarPrestacoesParaSupabase
  };
  
  console.log('✅ Módulo Prestações Supabase V2 carregado!');
  console.log('📌 Use: await window.PrestacoesSupabase.migrar()');
  
})();