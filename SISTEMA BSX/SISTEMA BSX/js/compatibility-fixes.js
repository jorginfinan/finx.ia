// ============================================
// CORREÇÃO DE FUNÇÕES FALTANTES
// ============================================
// Adicione este script DEPOIS do data-system.js

(function() {
  'use strict';

  // ============================================
  // CORREÇÃO PARA DESPESAS.JS
  // ============================================
  
  // Função saveDespesas que estava faltando
  window.saveDespesas = async function() {
    console.log('✅ Despesas salvas automaticamente no Supabase');
    // No novo sistema, não precisa salvar manualmente
    // Tudo é salvo automaticamente ao criar/editar
  };

  // ============================================
  // CORREÇÃO PARA GERENTES
  // ============================================
  
  // Se a função loadGerentes original não funcionar
  const originalLoadGerentes = window.loadGerentes;
  window.loadGerentes = async function() {
    console.log('📂 Carregando gerentes do Supabase...');
    
    try {
      // Usa o novo sistema
      if (window.GerentesDB) {
        const gerentes = await window.GerentesDB.getAll();
        window.gerentes = gerentes;
        console.log('✅ Gerentes carregados:', gerentes.length);
        return gerentes;
      }
      
      // Fallback para o método antigo
      if (originalLoadGerentes) {
        return originalLoadGerentes();
      }
      
      // Se nada funcionar, retorna array vazio
      window.gerentes = [];
      return [];
      
    } catch (error) {
      console.error('❌ Erro ao carregar gerentes:', error);
      window.gerentes = [];
      return [];
    }
  };

  // ============================================
  // CORREÇÃO PARA USERS
  // ============================================
  
  // Garante que UserAuth.list sempre retorna array
  if (window.UserAuth && window.UserAuth.list) {
    const originalList = window.UserAuth.list;
    window.UserAuth.list = async function() {
      try {
        let result = await originalList();
        
        // Se não for array, converte
        if (!Array.isArray(result)) {
          console.warn('UserAuth.list não retornou array, convertendo...');
          return [];
        }
        
        return result;
      } catch (error) {
        console.error('Erro em UserAuth.list:', error);
        return [];
      }
    };
  }

  // ============================================
  // CORREÇÃO PARA O LOGIN
  // ============================================
  
  // Adiciona função de fallback para localStorage
  window.loadUsers = function() {
    try {
      const stored = localStorage.getItem('APP_USERS_V3');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.error('Erro ao carregar usuários do localStorage:', error);
      return [];
    }
  };

  // ============================================
  // FUNÇÃO AUXILIAR PARA DEBUG
  // ============================================
  
  window.debugSystem = function() {
    console.group('🔍 Debug do Sistema');
    console.log('Supabase configurado?', !!window.db);
    console.log('UserAuth disponível?', !!window.UserAuth);
    console.log('GerentesDB disponível?', !!window.GerentesDB);
    console.log('DespesasDB disponível?', !!window.DespesasDB);
    console.log('Gerentes carregados?', window.gerentes?.length || 0);
    console.log('Usuário atual?', window.currentUser);
    console.groupEnd();
  };

  console.log('✅ Correções de compatibilidade aplicadas!');
  console.log('💡 Use debugSystem() para verificar o status');
  
})();