// js/nav.js – roteador unificado, compatível e estável
(function () {
  // MAPA exato conforme seu menu e suas <section>
  window.ROUTE_MAP = {
    home:'pageInicio', inicio:'pageInicio', dashboard:'pageInicio',
    cad:'pageCadastros', fich:'pageFichas',
    prest:'pagePrestacoes', 'prest-rel':'pagePrestRel', 'prest-fech':'pagePrestFech',
    fin:'pageFinanceiro', desp:'pageDespesas',
    users:'pageUsers', usuarios:'pageUsers','prest-vales':'pagePrestVales',
    historico: 'pageHistorico',
    audit: 'pageHistorico'
  };

  function pageIdFor(key){
    if (!key) return null;
    if (document.getElementById(key)) return key;
    if (window.ROUTE_MAP[key]) return window.ROUTE_MAP[key];
    var guess = 'page' + key.charAt(0).toUpperCase() + key.slice(1);
    if (document.getElementById(guess)) return guess;
    var el = document.querySelector('[data-route="'+key+'"]');
    return el ? el.id : null;
  }

  function hideAll(){
    document.querySelectorAll('section[id^="page"]').forEach(s=>{
      s.classList.add('hidden');
      s.style.display='none';
    });
  }

  function activateMenu(key){
    document.querySelectorAll('.sb-item.active, .sb-subitem.active')
      .forEach(el => el.classList.remove('active'));
    const btn = document.querySelector('.sb-item[data-tab="'+key+'"], .sb-subitem[data-tab="'+key+'"]');
    if (btn) btn.classList.add('active');
  }

  function afterShow(key, id){
    if (key === 'users' || key === 'usuarios' || id === 'pageUsers') {
      try { window.renderUsuariosPage?.(); } catch(_) {}
    }
    const hook = window['onShow_' + id];
    if (typeof hook === 'function') { try{ hook(); }catch(_){} }
    try { window.UserAuth?.guard?.(); } catch(_) {}
  }
  
  const __origAfterShow = afterShow;
  afterShow = function(key, id){
    __origAfterShow(key, id);
    if (key === 'prest-vales' || id === 'pagePrestVales') {
      try { window.vlsInit?.(); } catch(_) {}
    }
  };

  function showPage(key){
    const id = pageIdFor(key);
    if (!id) { console.warn('[router] rota inválida:', key); return; }
  
    const el = document.getElementById(id);
    if (!el) return;
  
    // checa permissão do container alvo
    const need = el.getAttribute('data-perm');
    const can  = !need || (window.UserAuth?.can?.(need) === true);
  
    if (!can) {
      console.warn('[router] acesso negado à rota', key, 'perm:', need);
  
      // acha uma rota de fallback que o usuário pode ver
      const candidates = ['inicio','home','prest','prest-rel','prest-fech','fin','desp','cad','users'];
      const fallback = candidates.find(k => {
        const pid = pageIdFor(k);
        const pel = pid && document.getElementById(pid);
        if (!pel) return false;
        const pneed = pel.getAttribute('data-perm');
        return !pneed || (window.UserAuth?.can?.(pneed) === true);
      }) || 'inicio';
  
      if (fallback !== key) {
        try { history.replaceState({}, '', '#'+fallback); } catch(_){}
        return showPage(fallback);
      }
      return;
    }
  
    // pode: agora sim mostra
    hideAll();
    el.classList.remove('hidden');
    el.style.display = '';
  
    activateMenu(key);
    afterShow(key, id);
    try { history.replaceState({}, '', '#'+key); } catch(_){}
    
    // ===== MOBILE: Fecha sidebar ao navegar para uma página =====
    if (window.innerWidth <= 768) {
      closeMobileSidebar();
    }
  }
  
  window.showPage = window.switchTab = showPage;

  // ===== FUNÇÕES DE CONTROLE DA SIDEBAR MOBILE =====
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (body) body.classList.remove('sb-open');
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (body) body.classList.add('sb-open');
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  }

  // Expor globalmente
  window.toggleSidebar = toggleSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.openMobileSidebar = openMobileSidebar;

  // ===== DELEGAÇÃO DE NAVEGAÇÃO =====
  // Processa cliques em itens com data-tab
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    
    // ✅ CORREÇÃO: Não impede navegação de subitens
    // Se for um subitem OU se não for mobile, apenas navega
    const isSubitem = btn.classList.contains('sb-subitem');
    const isGroup = btn.classList.contains('sb-group');
    
    // Se é um item normal ou subitem, navega normalmente
    if (!isGroup) {
      e.preventDefault();
      showPage(btn.getAttribute('data-tab'));
    }
  });

  // Links com href="#rota"
  document.addEventListener('click', function(e){
    const a = e.target.closest('a[href^="#"]');
    if(!a) return;
    const key = a.getAttribute('href').slice(1);
    if (!key) return;
    e.preventDefault();
    showPage(key);
  });

  // Hashchange
  window.addEventListener('hashchange', function(){
    const key = (location.hash || '').slice(1);
    if (key) showPage(key);
  });

  // Inicial – usa hash ou cai em 'home'
  const initial = (location.hash || '').slice(1) || 'home';
  showPage(initial);
})();

try { document.dispatchEvent(new Event('router:ready')); } catch(_) {}

// ==== Toggle de grupos da sidebar (Cadastros, Prestações etc.) ====
document.addEventListener('click', function (e) {
  const gbtn = e.target.closest?.('.sb-item.sb-group');
  if (!gbtn) return;

  // ✅ IMPORTANTE: Para propagação no mobile E desktop
  e.preventDefault();
  e.stopPropagation();

  const key = gbtn.getAttribute('data-group');
  const sub = document.querySelector('.sb-sub[data-sub="' + key + '"]');
  if (!sub) return;

  const expanded = gbtn.getAttribute('aria-expanded') === 'true';
  gbtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  sub.hidden = expanded; // true = esconde, false = mostra
  
  // Adiciona classe visual
  if (expanded) {
    gbtn.classList.remove('open');
  } else {
    gbtn.classList.add('open');
  }
});

// Quando navegar para uma subpágina, garanta que o grupo esteja aberto
function __ensureGroupOpenFor(key){
  const subItem = document.querySelector('.sb-subitem[data-tab="'+key+'"]');
  if (!subItem) return;
  const sub = subItem.closest('.sb-sub');
  if (!sub) return;
  if (sub.hidden) sub.hidden = false;
  const groupKey = sub.getAttribute('data-sub');
  const gbtn = document.querySelector('.sb-item.sb-group[data-group="'+groupKey+'"]');
  if (gbtn) {
    gbtn.setAttribute('aria-expanded','true');
    gbtn.classList.add('open');
  }
}

// Hook na navegação existente
const __origShowPage = window.showPage;
window.showPage = function(key){
  __origShowPage(key);
  __ensureGroupOpenFor(key);
};

// ===== CONTROLE DO OVERLAY E MENU TOGGLE MOBILE =====
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('menuToggle') || document.getElementById('sbOpen');
  const sbClose = document.getElementById('sbClose');
  const overlay = document.getElementById('overlay');
  const sidebar = document.getElementById('sidebar');

  // Botão de toggle do menu
  if (menuToggle) {
    menuToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleSidebar();
    });
  }

  // Botão X fecha o menu
  if (sbClose) {
    sbClose.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.closeMobileSidebar();
    });
  }

  // Clique no overlay fecha o menu
  if (overlay) {
    overlay.addEventListener('click', function() {
      window.closeMobileSidebar();
    });
  }

  // Clique no backdrop (área escura) fecha o menu
  document.addEventListener('click', function(e) {
    const body = document.body;
    if (!body.classList.contains('sb-open')) return;
    
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    
    if (!sidebar || !menuToggle) return;
    
    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedMenuToggle = menuToggle.contains(e.target);
    
    if (!clickedInsideSidebar && !clickedMenuToggle) {
      window.closeMobileSidebar();
    }
  });
});

// ===== MANTÉM ESTADO DOS SUBMENUS AO REDIMENSIONAR =====
let resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    // Se mudou de mobile para desktop, limpa os estados mobile
    if (window.innerWidth > 768) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('visible');
    }
  }, 250);
});

// ===== LOG PARA DEBUG =====
console.log('[nav.js] ✅ Sistema de navegação carregado');
console.log('[nav.js] Rotas:', Object.keys(window.ROUTE_MAP));