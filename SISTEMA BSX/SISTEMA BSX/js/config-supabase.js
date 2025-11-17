// ============================================
// ARQUIVO 1: CONFIGURAÇÃO DO SUPABASE
// ============================================
// INSTRUÇÕES:
// 1. Salve este arquivo como: js/config-supabase.js
// 2. Substitua YOUR_SUPABASE_URL e YOUR_SUPABASE_KEY pelos seus valores
// ============================================

(function() {
  'use strict';
  
  // ⚠️ IMPORTANTE: Cole aqui suas credenciais do Supabase
  // Você encontra em: Supabase Dashboard → Settings → API
  
  const SUPABASE_URL = 'https://ttdwmbwiapkjbjbepeza.supabase.co';  
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjg4NDgsImV4cCI6MjA3ODkwNDg0OH0.NZxm-ZQbQFVceO6yUABKAIj7XY7qN6RXSLi-8NF-BAw';  // ← Sua Anon Key

  // Cria o cliente Supabase
  if (!window.supabase) {
    console.error('❌ ERRO: Supabase não carregado!');
    console.error('Adicione no HTML antes dos scripts:');
    console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }

  // Inicializa o cliente
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Função helper para pegar a empresa atual
  window.getEmpresaAtual = async function() {
    const nomeEmpresa = window.getCompany ? window.getCompany() : 'BSX';
    
    // Busca o ID da empresa
    const { data } = await window.db
      .from('empresas')
      .select('id')
      .eq('nome', nomeEmpresa)
      .single();
    
    return data?.id || null;
  };

  // Função helper para pegar o usuário atual
  window.getUsuarioAtual = function() {
    try {
      const user = window.UserAuth?.currentUser?.();
      return {
        id: user?.id || null,
        nome: user?.username || 'Sistema',
        role: user?.role || 'operador'
      };
    } catch(e) {
      return { id: null, nome: 'Sistema', role: 'operador' };
    }
  };

  console.log('✅ Supabase configurado com sucesso!');
  console.log('📊 Use window.db para acessar o banco');
  
})();