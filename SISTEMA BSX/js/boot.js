// ============================================
// boot.js - VERSÃO CORRIGIDA E OTIMIZADA
// ============================================
(function() {
  'use strict';
  
  // Gerenciador de eventos global para prevenir memory leaks
  const EventManager = {
    listeners: [],
    
    add(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      this.listeners.push({ target, event, handler, options });
      return handler;
    },
    
    remove(target, event, handler) {
      const index = this.listeners.findIndex(l => 
        l.target === target && l.event === event && l.handler === handler
      );
      if (index > -1) {
        target.removeEventListener(event, handler);
        this.listeners.splice(index, 1);
      }
    },
    
    cleanup() {
      console.log('Limpando ' + this.listeners.length + ' event listeners...');
      this.listeners.forEach(({ target, event, handler, options }) => {
        try {
          target.removeEventListener(event, handler, options);
        } catch(e) {
          console.warn('Erro ao limpar listener:', e);
        }
      });
      this.listeners = [];
    }
  };
  
  // Expor globalmente
  window.eventManager = EventManager;
  
  // Aguarda módulos críticos antes de inicializar
  function waitForCriticalModules(callback) {
    const required = [
      { 
        name: 'Utils', 
        check: () => typeof window.esc === 'function' && typeof window.uid === 'function'
      },
      { 
        name: 'Empresa', 
        check: () => typeof window.getCompany === 'function'
      },
      { 
        name: 'Gerentes Array', 
        check: () => Array.isArray(window.gerentes) || window.gerentes === undefined
      }
    ];
    
    let attempts = 0;
    const maxAttempts = 50;
    
    function check() {
      const missing = required.filter(r => !r.check());
      
      if (missing.length === 0) {
        console.log('[Boot] ✅ Todos os módulos críticos prontos');
        callback();
        return;
      }
      
      attempts++;
      
      if (attempts >= maxAttempts) {
        console.warn('[Boot] ⚠️ Timeout aguardando módulos:', 
          missing.map(m => m.name).join(', '));
        console.warn('[Boot] Continuando inicialização mesmo assim...');
        callback();
        return;
      }
      
      if (attempts % 10 === 0) {
        console.log('[Boot] Aguardando módulos:', missing.map(m => m.name).join(', '));
      }
      
      setTimeout(check, 100);
    }
    
    check();
  }
  
  // Auto-entrada se já logado (RBAC)
  function initAuth() {
    const cu = window.UserAuth?.currentUser?.() || null;
    if (!cu) return;
    
    window.currentUser = {
      username: cu.username,
      name: cu.username,
      role: cu.role,
      isAdmin: cu.role === 'admin',
      perms: cu.perms || {}
    };
    
    const lp = document.getElementById('loginPage');
    if (lp) lp.style.display = 'none';
    
    const app = document.getElementById('app');
    if (app) app.style.display = 'block';
    
    try { 
      window.UserAuth?.guard?.();
      loadInitialData();
    } catch(e) {
      console.error('Erro na inicialização:', e);
    }
    
    navigateToInitialRoute();
  }
  
  // Carregamentos iniciais otimizados
  function loadInitialData() {
    const loaders = [
      { fn: 'loadAll', critical: false },
      { fn: 'loadGerentes', critical: true },
      { fn: 'buildDespesasFilterOptions', critical: false },
      { fn: 'renderGerentes', critical: false },
      { fn: 'fillPcGerentes', critical: false }
    ];
    
    loaders.forEach(({ fn, critical }) => {
      try {
        if (typeof window[fn] === 'function') {
          window[fn]();
        }
      } catch(e) {
        if (critical) {
          console.error(`Erro crítico em ${fn}:`, e);
        } else {
          console.warn(`Erro em ${fn}:`, e);
        }
      }
    });
  }
  
  // Navegação inicial
  function navigateToInitialRoute() {
    const initial = (location.hash || '').replace('#','') || 'inicio';
    try {
      if (typeof window.showPage === 'function') {
        window.showPage(initial);
      } else if (typeof window.switchTab === 'function') {
        window.switchTab(initial);
      } else {
        location.hash = '#' + initial;
      }
    } catch(e) {
      console.error('Erro na navegação inicial:', e);
      location.hash = '#inicio';
    }
  }
  
  // Sidebar compacta com persistência
  function initSidebarCompact() {
    const STORAGE_KEY = 'ui_sidebar_compact';
    const btn = document.getElementById('btnToggleSidebar');
    if (!btn) return;
    
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      document.body.classList.add('sidebar-compact');
    }
    
    const handler = function() {
      document.body.classList.toggle('sidebar-compact');
      const isCompact = document.body.classList.contains('sidebar-compact');
      localStorage.setItem(STORAGE_KEY, isCompact ? '1' : '0');
      updateSidebarLabel(btn, isCompact);
    };
    
    EventManager.add(btn, 'click', handler);
    updateSidebarLabel(btn, document.body.classList.contains('sidebar-compact'));
  }
  
  function updateSidebarLabel(btn, isCompact) {
    const label = btn.querySelector('.label');
    if (label) {
      label.textContent = isCompact ? 'Expandir' : 'Compactar';
    }
    btn.title = isCompact ? 'Expandir menu' : 'Compactar menu';
    btn.setAttribute('aria-label', btn.title);
  }
  
  // Mobile drawer otimizado
  function initMobileDrawer() {
    const btnOpen = document.getElementById('sbOpen');
    const btnClose = document.getElementById('sbClose');
    const sidebar = document.getElementById('sidebar');
    if (!btnOpen || !sidebar) return;
    
    const open = () => {
      document.body.classList.add('sb-open');
      sidebar.classList.add('open');
    };
    
    const close = () => {
      document.body.classList.remove('sb-open');
      sidebar.classList.remove('open');
    };
    
    EventManager.add(btnOpen, 'click', open);
    if (btnClose) EventManager.add(btnClose, 'click', close);
    
    const outsideClickHandler = (e) => {
      if (!document.body.classList.contains('sb-open')) return;
      if (!sidebar.contains(e.target) && !btnOpen.contains(e.target)) {
        close();
      }
    };
    
    EventManager.add(document, 'click', outsideClickHandler);
    EventManager.add(document, 'keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    
    const sbNav = document.getElementById('sbNav');
    if (sbNav) {
      EventManager.add(sbNav, 'click', (e) => {
        if (e.target.closest('.sb-item, .sb-subitem')) {
          close();
        }
      });
    }
  }
  
  // Drag scroll otimizado
  function initDragScroll() {
    const sub = document.querySelector('.submenu');
    if (!sub) return;
    
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    
    const handlers = {
      mousedown(e) {
        isDown = true;
        sub.classList.add('dragging');
        startX = e.pageX - sub.offsetLeft;
        scrollLeft = sub.scrollLeft;
      },
      mouseleave() {
        isDown = false;
        sub.classList.remove('dragging');
      },
      mouseup() {
        isDown = false;
        sub.classList.remove('dragging');
      },
      mousemove(e) {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - sub.offsetLeft;
        const walk = (x - startX) * 2;
        sub.scrollLeft = scrollLeft - walk;
      }
    };
    
    Object.entries(handlers).forEach(([event, handler]) => {
      EventManager.add(sub, event, handler);
    });
  }
  
  // Reagir a mudanças de empresa
  function setupEmpresaListeners() {
    const handler = debounce(() => {
      console.log('🏢 Empresa mudou, recarregando dados...');
      try {
        window.UserAuth?.guard?.();
        window.fillPcGerentes?.();
        window.buildDespesasFilterOptions?.();
        window.renderDespesas?.();
        window.renderRelPrestacoes?.();
        window.renderPrestFechadas?.();
        window.renderResultado?.();
        window.renderGerentes?.();
      } catch(e) {
        console.error('Erro ao recarregar após mudança de empresa:', e);
      }
    }, 300);
    
    EventManager.add(document, 'empresa:change', handler);
  }
  
  // Utilitário debounce
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // Wire de eventos de formulários
  function wireFormEvents() {
    const forms = [
      { id: 'btnPcAddDespesa', fn: 'addDespesa' },
      { id: 'btnPcSalvar', fn: 'salvarPrestacao' },
      { id: 'btnColAdd', fn: 'addColetor' },
      { id: 'btnPcSalvarColetores', fn: 'salvarColetoresPadrao' },
      { id: 'btnNovo', fn: 'abrirDialogLanc' },
      { id: 'salvarLanc', fn: 'salvarLancamento' }
    ];
    
    forms.forEach(({ id, fn }) => {
      const elem = document.getElementById(id);
      if (elem && typeof window[fn] === 'function') {
        EventManager.add(elem, 'click', (e) => {
          e.preventDefault();
          try {
            window[fn]();
          } catch(err) {
            console.error(`Erro em ${fn}:`, err);
          }
        });
      }
    });
    
    const formGerente = document.getElementById('formGerente');
    if (formGerente && typeof window.salvarGerente === 'function') {
      EventManager.add(formGerente, 'submit', (e) => {
        e.preventDefault();
        try {
          window.salvarGerente(e);
        } catch(err) {
          console.error('Erro ao salvar gerente:', err);
        }
      });
    }
  }
  
  // Login success handler
  function setupLoginListener() {
    EventManager.add(document, 'auth:login', () => {
      const lp = document.getElementById('loginPage');
      const app = document.getElementById('app');
      
      if (lp) lp.style.display = 'none';
      if (app) app.style.display = 'block';
      
      const initial = (location.hash || '').slice(1) || 'home';
      if (typeof window.showPage === 'function') {
        window.showPage(initial);
      }
      
      document.dispatchEvent(new Event('app:ready'));
    });
  }
  
  // LiveSync otimizado
  function setupLiveSync() {
    const bc = window.BroadcastChannel ? new BroadcastChannel('bsx-sync') : null;
    
    const syncHandlers = {
      'bsx_vales_v1': ['renderValesPrestacao', 'pgRender'],
      'bsx_despesas_v1': ['buildDespesasFilterOptions', 'renderDespesas'],
      'bsx_prest_contas_v1': ['renderRelPrestacoes', 'renderPrestFechadas'],
      'bsx_gerentes_v2': ['loadGerentes', 'fillPcGerentes', 'renderGerentes']
    };
    
    function handleChange(key) {
      if (!key) return;
      
      Object.entries(syncHandlers).forEach(([dbKey, functions]) => {
        if (key.includes(dbKey)) {
          functions.forEach(fn => {
            try {
              if (typeof window[fn] === 'function') {
                window[fn]();
              }
            } catch(e) {
              console.warn(`Erro em ${fn}:`, e);
            }
          });
        }
      });
    }
    
    EventManager.add(window, 'storage', (e) => handleChange(e.key));
    
    if (bc) {
      bc.onmessage = (ev) => handleChange(ev.data?.key);
      
      window.bxNotifyChange = function(key) {
        try {
          handleChange(key);
          bc.postMessage({ key });
        } catch(e) {
          console.warn('bxNotifyChange error:', e);
        }
      };
    }
  }
  
  // Cleanup ao sair
  function setupCleanup() {
    EventManager.add(window, 'beforeunload', () => {
      console.log('🧹 Limpando recursos antes de sair...');
      EventManager.cleanup();
    });
  }
  
  // ✅ FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
  function init() {
    console.log('🚀 Aguardando módulos críticos...');
    
    waitForCriticalModules(function() {
      console.log('🚀 Inicializando sistema...');
      
      initAuth();
      initSidebarCompact();
      initMobileDrawer();
      initDragScroll();
      setupEmpresaListeners();
      wireFormEvents();
      setupLoginListener();
      setupLiveSync();
      setupCleanup();
      
      // Força sincronização de pendências
      setTimeout(function() {
        if (typeof window.syncPendenciasFromPrest === 'function') {
          try {
            window.syncPendenciasFromPrest();
            console.log('[Boot] ✅ Pendências sincronizadas');
          } catch(e) {
            console.warn('[Boot] Erro ao sincronizar pendências:', e);
          }
        }
      }, 500);
      
      console.log('✅ Sistema inicializado com sucesso!');
    });
  }
  
  // ✅ EXECUTA A INICIALIZAÇÃO
  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM já está pronto, executa imediatamente
    init();
  }
  
})();
