// js/auth.js — bridge robusto para o RBAC (UserAuth)
(function(){
  // pega elementos
  var $user = document.getElementById('loginUser');
  var $pass = document.getElementById('loginPass');
  var $btn  = document.getElementById('btnDoLogin');
  var $err  = document.getElementById('loginError');

  // util
  function show(el){ if(!el) return; el.style.display=''; el.classList && el.classList.remove('hidden'); }
  function hide(el){ if(!el) return; el.style.display='none'; el.classList && el.classList.add('hidden'); }

  function toCompat(u){
    if(!u) return null;
    return {
      username: u.username,
      name: u.username,
      role: u.role,
      isAdmin: u.role === 'admin',
      isOperador: u.role === 'operador',
      permissoes: u.perms || u.permissoes || {}
    };
  }

  function pickInitialRoute(){
    var map = window.ROUTE_MAP || {};
    var candidates = [
      (location.hash||'').replace('#','').trim(),
      'inicio','home','dashboard','fin','prest','desp','users'
    ].filter(Boolean);
    for (var i=0;i<candidates.length;i++){
      var k = candidates[i];
      var id = map[k] || k;
      if (document.getElementById(id)) return k;
    }
    // fallback: primeira section
    var first = document.querySelector('section[id^="page"]');
    if (first){
      var id = first.id; // ex.: pageInicio
      var key = id.replace(/^page/,'');
      key = key.charAt(0).toLowerCase() + key.slice(1);
      return key || 'home';
    }
    return 'home';
  }

  function enterApp(cuRaw){
    console.log('[Auth] 1️⃣ Iniciando enterApp...');
    var cu = toCompat(cuRaw);
    if (!cu) {
      console.error('[Auth] ❌ Usuário inválido');
      return;
    }
  
    console.log('[Auth] 2️⃣ Definindo currentUser...');
    window.currentUser = cu;
  
    var badge = document.getElementById('userBadge');
    if (badge) badge.textContent = 'Olá, ' + cu.name;
  
    console.log('[Auth] 3️⃣ Escondendo login / Mostrando app...');
    // esconde login / mostra app
    var loginPage = document.getElementById('loginPage');
    var appPage = document.getElementById('app');
    
    if (loginPage) {
      loginPage.style.display = 'none';
      loginPage.classList.add('hidden');
      console.log('[Auth] ✅ Login escondido');
    }
    
    if (appPage) {
      appPage.style.display = 'block';
      appPage.classList.remove('hidden');
      console.log('[Auth] ✅ App visível');
    }
  
    console.log('[Auth] 4️⃣ Aplicando RBAC...');
    // aplica RBAC na interface
    try { 
      if (window.UserAuth && UserAuth.guard) {
        UserAuth.guard();
        console.log('[Auth] ✅ RBAC aplicado');
      }
    } catch(e){
      console.warn('[Auth] ⚠️ Erro no RBAC:', e);
    }

    console.log('[Auth] 5️⃣ Carregando dados...');
    // ✅ CARREGAMENTOS DO APP (ANTES de navegar)
    try{ if(window.loadAll) loadAll(); }catch(e){ console.warn('loadAll:', e); }
    try{ if(window.loadGerentes) loadGerentes(); }catch(e){ console.warn('loadGerentes:', e); }
    try{ if(window.buildDespesasFilterOptions) buildDespesasFilterOptions(); }catch(e){ console.warn('buildDespesasFilterOptions:', e); }
    try{ if(window.renderGerentes) renderGerentes(); }catch(e){ console.warn('renderGerentes:', e); }
    try{ if(window.fillPcGerentes) fillPcGerentes(); }catch(e){ console.warn('fillPcGerentes:', e); }
    try{ if(window.renderFin) renderFin(); }catch(e){ console.warn('renderFin:', e); }
    
    console.log('[Auth] 6️⃣ Dados carregados, preparando navegação...');

    // ✅ AGUARDA ROTEADOR ESTAR PRONTO ANTES DE NAVEGAR
    var tentativas = 0;
    var maxTentativas = 20;
    
    function navegarParaInicio() {
      tentativas++;
      console.log('[Auth] 🧭 Tentativa', tentativas, 'de navegação...');
      
      var r = pickInitialRoute() || 'inicio';
      console.log('[Auth] Rota escolhida:', r);
      
      if (typeof window.showPage === 'function') {
        console.log('[Auth] ✅ showPage disponível! Navegando para:', r);
        
        try {
          window.showPage(r);
          location.hash = '#' + r;
          console.log('[Auth] ✅ Navegação completa!');
        } catch(e) {
          console.error('[Auth] ❌ Erro ao navegar:', e);
        }
      } else {
        if (tentativas < maxTentativas) {
          console.warn('[Auth] ⏳ showPage não disponível ainda, tentando novamente... (' + tentativas + '/' + maxTentativas + ')');
          setTimeout(navegarParaInicio, 150);
        } else {
          console.error('[Auth] ❌ Timeout: showPage nunca ficou disponível');
          // Fallback: força a rota no hash
          location.hash = '#inicio';
          // Tenta forçar reload
          setTimeout(function() {
            location.reload();
          }, 500);
        }
      }
    }
    
    // ✅ AUMENTA O DELAY PARA DAR TEMPO DO NAV.JS CARREGAR
    console.log('[Auth] 7️⃣ Aguardando 300ms antes de navegar...');
    setTimeout(function() {
      console.log('[Auth] 8️⃣ Iniciando navegação...');
      navegarParaInicio();
    }, 300);
  }

  var logging = false;
  async function doLogin(){
    if (logging) return;
    var u = ($user && $user.value || '').trim().toLowerCase();
    var p = ($pass && $pass.value || '').trim();

    if (!u || !p){
      if ($err){ $err.textContent = 'Informe usuário e senha.'; $err.style.display = 'block'; }
      return;
    }

    logging = true;
    if ($btn){ 
      $btn.disabled = true; 
      $btn.textContent = 'Entrando...';
      $btn.style.opacity = '0.7';
    }
    if ($err) $err.style.display = 'none';

    try{
      if (!window.UserAuth || !UserAuth.login) throw new Error('Módulo de autenticação não carregado');
      var res = await UserAuth.login(u, p);
      if (!res || res.ok !== true){
        if ($err){
          $err.textContent = (res && res.msg) ? res.msg : 'Usuário ou senha inválidos.';
          $err.style.display = 'block';
        }
        return;
      }
      
      // ✅ FEEDBACK VISUAL
      if ($btn) $btn.textContent = 'Carregando...';
      
      var cu = UserAuth.currentUser && UserAuth.currentUser();
      if (!cu){
        if ($err){ $err.textContent = 'Sessão não pôde ser criada.'; $err.style.display = 'block'; }
        return;
      }
      
      // ✅ PEQUENO DELAY PARA GARANTIR QUE TUDO CARREGOU
      await new Promise(function(resolve){ setTimeout(resolve, 100); });
      
      enterApp(cu);
    }catch(e){
      console.error('[auth] erro no login:', e);
      if ($err){ $err.textContent = 'Erro ao tentar entrar. Tente novamente.'; $err.style.display = 'block'; }
    }finally{
      logging = false;
      if ($btn){ 
        $btn.disabled = false; 
        $btn.textContent = 'Entrar';
        $btn.style.opacity = '1';
      }
    }
  }

  // logout global
  window.doLogout = function(){
    try { UserAuth && UserAuth.logout && UserAuth.logout(); } catch(_){}
    window.currentUser = null;
    show(document.getElementById('loginPage'));
    hide(document.getElementById('app'));
    try { history.replaceState({}, '', location.pathname); } catch(_){}
    if ($pass) $pass.value = '';
  };

  // eventos UI
  if ($btn)  $btn.addEventListener('click', doLogin);
  if ($pass) $pass.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  if ($user) $user.addEventListener('input', function(){ if ($err) $err.style.display='none'; });
  if ($pass) $pass.addEventListener('input', function(){ if ($err) $err.style.display='none'; });

  // delegação para qualquer botão "Sair"
  document.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-action="logout"],#btnLogout') : null;
    if (!b) return;
    e.preventDefault();
    window.doLogout();
  });

  // auto-entrar se já houver sessão RBAC
  (function(){
    try{
      var cu = UserAuth && UserAuth.currentUser && UserAuth.currentUser();
      if (cu) enterApp(cu);
    }catch(_){}
  })();

  // limpa sessão legada, caso exista
  try { localStorage.removeItem('bsx_user_v1'); } catch(_){}
})();