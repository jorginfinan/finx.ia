// ============================================
// PRESTAÇÕES SUPABASE - MIGRAÇÃO E SYNC
// ============================================

(function() {
  'use strict';
  
  const DB_PREST_LOCAL = 'bsx_prestacoes_v1';
  
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
  // SALVAR PRESTAÇÃO NO SUPABASE
  // ============================================
  
  async function salvarPrestacaoSupabase(prestacao) {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) throw new Error('Empresa não encontrada');
      
      // Prepara dados para o Supabase
      const payload = {
        uid: prestacao.id,
        gerente_id: prestacao.gerenteId,
        gerente_nome: prestacao.gerenteNome,
        empresa_id: empresaId,
        data_inicio: prestacao.ini,
        data_fim: prestacao.fim,
        coletas: prestacao.coletas || [],
        despesas: prestacao.despesas || [],
        pagamentos: prestacao.pagamentos || [],
        vales: prestacao.vales || [],
        resumo: prestacao.resumo || {},
        saldo_info: prestacao.saldoInfo || null,
        vale_parc_aplicado: prestacao.valeParcAplicado || [],
        fechado: prestacao.fechado || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
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
        .order('data_fim', { ascending: false });
      
      if (error) throw error;
      
      // Converte para formato local
      return (data || []).map(p => ({
        id: p.uid,
        gerenteId: p.gerente_id,
        gerenteNome: p.gerente_nome,
        ini: p.data_inicio,
        fim: p.data_fim,
        coletas: p.coletas || [],
        despesas: p.despesas || [],
        pagamentos: p.pagamentos || [],
        vales: p.vales || [],
        valesSel: [],
        resumo: p.resumo || {},
        saldoInfo: p.saldo_info || null,
        valeParcAplicado: p.vale_parc_aplicado || [],
        fechado: p.fechado || false
      }));
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
      
      // Carrega do localStorage
      const prestsLocal = JSON.parse(localStorage.getItem(DB_PREST_LOCAL) || '[]');
      
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
        console.log('💡 Você pode limpar o localStorage depois com: localStorage.removeItem("bsx_prestacoes_v1")');
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
  
  // Salvar prestação (substitui localStorage)
  window.salvarPrestacaoGlobal = async function(prestacao) {
    try {
      // Salva no Supabase
      await salvarPrestacaoSupabase(prestacao);
      
      // Também salva no localStorage como backup
      const arr = JSON.parse(localStorage.getItem(DB_PREST_LOCAL) || '[]');
      const idx = arr.findIndex(p => p.id === prestacao.id);
      
      if (idx > -1) {
        arr[idx] = prestacao;
      } else {
        arr.push(prestacao);
      }
      
      localStorage.setItem(DB_PREST_LOCAL, JSON.stringify(arr));
      
      return true;
    } catch(e) {
      console.error('[Prestações] Erro ao salvar:', e);
      throw e;
    }
  };
  
  // Carregar prestações (carrega do Supabase)
  window.carregarPrestacoesGlobal = async function() {
    try {
      const prestacoes = await carregarPrestacoesSupabase();
      
      // Atualiza localStorage como cache
      localStorage.setItem(DB_PREST_LOCAL, JSON.stringify(prestacoes));
      
      return prestacoes;
    } catch(e) {
      console.error('[Prestações] Erro ao carregar, usando localStorage:', e);
      return JSON.parse(localStorage.getItem(DB_PREST_LOCAL) || '[]');
    }
  };
  
  // Deletar prestação
  window.deletarPrestacaoGlobal = async function(uid) {
    try {
      // Deleta do Supabase
      await deletarPrestacaoSupabase(uid);
      
      // Deleta do localStorage
      const arr = JSON.parse(localStorage.getItem(DB_PREST_LOCAL) || '[]');
      const filtered = arr.filter(p => p.id !== uid);
      localStorage.setItem(DB_PREST_LOCAL, JSON.stringify(filtered));
      
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
  
  console.log('✅ Módulo Prestações Supabase carregado!');
  console.log('📌 Use: window.PrestacoesSupabase.migrar() para migrar');
  
})();