// ===== SYNC MANAGER - Sincronização em Tempo Real =====
(function SyncManager() {
  'use strict';
  
  // BroadcastChannel para comunicação entre abas (mais rápido que storage events)
  let channel;
  try {
    channel = new BroadcastChannel('bsx_sync');
  } catch(e) {
    console.warn('BroadcastChannel não suportado, usando apenas storage events');
  }
  
  // Debounce para evitar múltiplos renders
  const debounceMap = new Map();
  
  function debounce(key, fn, delay = 100) {
    if (debounceMap.has(key)) {
      clearTimeout(debounceMap.get(key));
    }
    
    const timeout = setTimeout(() => {
      fn();
      debounceMap.delete(key);
    }, delay);
    
    debounceMap.set(key, timeout);
  }
  
  // Registra mudanças e notifica outras abas
  function notifyChange(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: Date.now(),
      tabId: getTabId()
    };
    
    // Envia via BroadcastChannel (se disponível)
    if (channel) {
      try {
        channel.postMessage(message);
      } catch(e) {
        console.warn('Erro ao enviar via BroadcastChannel:', e);
      }
    }
    
    // Dispara evento local também
    window.dispatchEvent(new CustomEvent('bsx:sync', { detail: message }));
  }
  
  // ID único para esta aba
  function getTabId() {
    if (!window.__bsxTabId) {
      window.__bsxTabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    }
    return window.__bsxTabId;
  }
  
  // Escuta mensagens de outras abas
  if (channel) {
    channel.addEventListener('message', (event) => {
      const message = event.data;
      
      // Ignora mensagens da própria aba
      if (message.tabId === getTabId()) return;
      
      handleSyncMessage(message);
    });
  }
  
  // Escuta storage events (fallback e para navegadores sem BroadcastChannel)
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.newValue) return;
    
    // Detecta qual tipo de dado mudou
    let type = null;
    
    if (e.key.includes('gerentes')) type = 'gerentes';
    else if (e.key.includes('prest') || e.key === 'DB_PREST') type = 'prestacoes';
    else if (e.key.includes('fin_lanc') || e.key.includes('financeiro')) type = 'financeiro';
    else if (e.key.includes('despesas')) type = 'despesas';
    else if (e.key.includes('vales')) type = 'vales';
    else if (e.key.includes('fichas')) type = 'fichas';
    
    if (type) {
      handleSyncMessage({ type, data: {}, source: 'storage' });
    }
  });
  
  // Processa mensagens de sincronização
  function handleSyncMessage(message) {
    const { type, data } = message;
    
    console.log('📡 Sincronização recebida:', type);
    
    switch(type) {
      case 'gerentes':
        syncGerentes();
        break;
      case 'prestacoes':
        syncPrestacoes();
        break;
      case 'financeiro':
        syncFinanceiro();
        break;
      case 'despesas':
        syncDespesas();
        break;
      case 'vales':
        syncVales();
        break;
      case 'fichas':
        syncFichas();
        break;
    }
  }
  
  // ===== FUNÇÕES DE SINCRONIZAÇÃO =====
  
  function syncGerentes() {
    debounce('gerentes', () => {
      try {
        // Recarrega gerentes
        if (typeof window.loadGerentes === 'function') {
          window.loadGerentes();
        }
        
        // Atualiza todas as interfaces que usam gerentes
        if (typeof window.renderGerentes === 'function') {
          window.renderGerentes();
        }
        
        if (typeof window.fillPcGerentes === 'function') {
          window.fillPcGerentes();
        }
        
        // Atualiza seletores de gerente
        const selectors = document.querySelectorAll('[data-gerente-select]');
        selectors.forEach(select => {
          const currentValue = select.value;
          if (typeof window.fillPcGerentes === 'function') {
            window.fillPcGerentes();
          }
          select.value = currentValue;
        });
        
        console.log('✅ Gerentes sincronizados');
      } catch(e) {
        console.error('Erro ao sincronizar gerentes:', e);
      }
    });
  }
  
  function syncPrestacoes() {
    debounce('prestacoes', () => {
      try {
        // Atualiza lista de prestações
        if (typeof window.renderRelPrestacoes === 'function') {
          window.renderRelPrestacoes();
        }
        
        if (typeof window.renderPrestFechadas === 'function') {
          window.renderPrestFechadas();
        }
        
        if (typeof window.__syncAbertasMirror === 'function') {
          window.__syncAbertasMirror();
        }
        
        console.log('✅ Prestações sincronizadas');
      } catch(e) {
        console.error('Erro ao sincronizar prestações:', e);
      }
    });
  }
  
  function syncFinanceiro() {
    debounce('financeiro', () => {
      try {
        // Recarrega dados do financeiro
        if (window.lanc && Array.isArray(window.lanc)) {
          const key = 'bsx_fin_lanc';
          try {
            const raw = localStorage.getItem(key);
            window.lanc = raw ? JSON.parse(raw) : [];
          } catch(e) {
            console.error('Erro ao recarregar financeiro:', e);
          }
        }
        
        // Atualiza interface
        if (typeof window.renderFin === 'function') {
          window.renderFin();
        }
        
        if (typeof window.renderFinPendencias === 'function') {
          window.renderFinPendencias();
        }
        
        console.log('✅ Financeiro sincronizado');
      } catch(e) {
        console.error('Erro ao sincronizar financeiro:', e);
      }
    });
  }
  
  function syncDespesas() {
    debounce('despesas', () => {
      try {
        // Recarrega despesas
        if (window.despesas && Array.isArray(window.despesas)) {
          const key = 'bsx_despesas_v1';
          try {
            const raw = localStorage.getItem(key);
            window.despesas = raw ? JSON.parse(raw) : [];
          } catch(e) {
            console.error('Erro ao recarregar despesas:', e);
          }
        }
        
        // Atualiza interface
        if (typeof window.renderDespesas === 'function') {
          window.renderDespesas();
        }
        
        console.log('✅ Despesas sincronizadas');
      } catch(e) {
        console.error('Erro ao sincronizar despesas:', e);
      }
    });
  }
  
  function syncVales() {
    debounce('vales', () => {
      try {
        // Recarrega vales
        if (typeof window.__valesReload === 'function') {
          window.__valesReload();
        }
        
        // Atualiza interfaces
        if (typeof window.renderValesPrestacao === 'function') {
          window.renderValesPrestacao();
        }
        
        if (typeof window.vlsRenderTabela === 'function') {
          window.vlsRenderTabela();
        }
        
        console.log('✅ Vales sincronizados');
      } catch(e) {
        console.error('Erro ao sincronizar vales:', e);
      }
    });
  }
  
  function syncFichas() {
    debounce('fichas', () => {
      try {
        // Atualiza fichas se houver função
        if (typeof window.renderFichas === 'function') {
          window.renderFichas();
        }
        
        console.log('✅ Fichas sincronizadas');
      } catch(e) {
        console.error('Erro ao sincronizar fichas:', e);
      }
    });
  }
  
  // ===== API PÚBLICA =====
  
  window.SyncManager = {
    // Notifica que um tipo de dado mudou
    notify: notifyChange,
    
    // Força sincronização manual
    sync: function(type) {
      if (type) {
        handleSyncMessage({ type, data: {} });
      } else {
        // Sincroniza tudo
        syncGerentes();
        syncPrestacoes();
        syncFinanceiro();
        syncDespesas();
        syncVales();
        syncFichas();
      }
    },
    
    // Registra callback customizado
    on: function(type, callback) {
      window.addEventListener('bsx:sync', (e) => {
        if (e.detail.type === type) {
          callback(e.detail.data);
        }
      });
    }
  };
  
  console.log('✅ Sync Manager inicializado');
})();