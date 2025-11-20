// ============================================
// GARANTIR CARREGAMENTO DE GERENTES
// ============================================
(async function garantirGerentes() {
  'use strict';
  
  console.log('[Init] 🔄 Verificando gerentes...');
  
  // Função para carregar gerentes do Supabase
  async function carregarGerentes() {
    try {
      if (!window.SupabaseAPI?.gerentes) {
        console.warn('[Init] ⚠️  SupabaseAPI.gerentes não disponível');
        return false;
      }
      
      const gerentes = await window.SupabaseAPI.gerentes.getAll();
      
      if (!Array.isArray(gerentes) || gerentes.length === 0) {
        console.warn('[Init] ⚠️  Nenhum gerente encontrado');
        return false;
      }
      
      // Mapear para formato esperado pelo sistema
      window.gerentes = gerentes.map(g => ({
        uid: g.uid || g.id,
        id: g.uid || g.id,
        nome: g.nome || '(sem nome)',
        numero: g.numero || '',
        comissao: Number(g.comissao) || 0,
        comissao2: Number(g.comissao2) || 0,
        comissaoModo: g.comissao_modo || g.comissaoModo || 'simples',
        comissaoPorRotaPositiva: g.comissao_por_rota_positiva || false,
        temSegundaComissao: g.tem_segunda_comissao || false,
        baseCalculo: g.base_calculo || g.baseCalculo || 'COLETAS_MENOS_DESPESAS',
        ativo: g.ativo !== false
      }));
      
      console.log(`[Init] ✅ ${window.gerentes.length} gerentes carregados`);
      
      // Dispara evento para avisar que gerentes foram carregados
      document.dispatchEvent(new CustomEvent('gerentes:loaded', { 
        detail: window.gerentes 
      }));
      
      return true;
      
    } catch (error) {
      console.error('[Init] ❌ Erro ao carregar gerentes:', error);
      return false;
    }
  }
  
  // Tentar carregar gerentes (com retry)
  let tentativas = 0;
  const maxTentativas = 10;
  
  async function tentarCarregar() {
    tentativas++;
    
    const sucesso = await carregarGerentes();
    
    if (sucesso) {
      console.log('[Init] 🎉 Gerentes prontos!');
      return true;
    }
    
    if (tentativas < maxTentativas) {
      console.log(`[Init] 🔄 Tentativa ${tentativas}/${maxTentativas}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return tentarCarregar();
    }
    
    console.error('[Init] ❌ Falha ao carregar gerentes após', maxTentativas, 'tentativas');
    return false;
  }
  
  // Iniciar carregamento
  await tentarCarregar();
  
  // Recarregar a cada 30 segundos
  setInterval(async () => {
    await carregarGerentes();
  }, 30000);
  
  // Função global para forçar reload
  window.recarregarGerentes = carregarGerentes;
  
  // Helper para verificar se gerentes estão carregados
  window.gerentesCarregados = function() {
    return Array.isArray(window.gerentes) && window.gerentes.length > 0;
  };
  
})();

// ============================================
// PROTEÇÃO: Não permitir acesso a prestações sem gerentes
// ============================================
(function protegerPrestacoes() {
  'use strict';
  
  // Interceptar navegação para prestações
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href="#prestacoes"], button[data-page="prestacoes"]');
    
    if (link) {
      // Verificar se gerentes estão carregados
      if (!window.gerentesCarregados || !window.gerentesCarregados()) {
        e.preventDefault();
        e.stopPropagation();
        
        alert('⚠️ Aguarde! Carregando gerentes...\n\nTente novamente em alguns segundos.');
        
        console.log('[Proteção] ⚠️  Bloqueou acesso a prestações - gerentes não carregados');
        
        // Tentar carregar novamente
        if (window.recarregarGerentes) {
          window.recarregarGerentes();
        }
        
        return false;
      }
    }
  }, true);
  
  console.log('[Init] 🛡️  Proteção de prestações ativada');
  
})();