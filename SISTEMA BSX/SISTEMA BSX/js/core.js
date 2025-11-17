// === Empresa atual e prefixador ===
function EMP(){ return (localStorage.getItem('CURRENT_COMPANY') || 'BSX').toUpperCase(); }
function K(key){ const emp = EMP(); return (String(key).includes('__') ? key : `${emp}__${key}`); }


// Helper JSON seguro
const L = {
  get(key, def = []) {
    try { return JSON.parse(localStorage.getItem(K(key)) || '[]'); }
    catch { return def; }
  },
  set(key, val) {
    localStorage.setItem(K(key), JSON.stringify(val));
  }
};


// ==== Constantes de "banco" ====
  const UKEY = 'bsx_user_v1';

  const IDEAL_RATE = 0.04; // 4%
  const DB_GERENTES   = 'bsx_gerentes_v2';
  const DB_FINANCEIRO = 'bsx_fin_lanc';
  const DB_PREST      = 'bsx_prest_contas_v1';
  const DB_DESPESAS   = 'bsx_despesas_v1';
  const DB_FICHAS     = 'bsx_fichas_v1';
  const DB_FICHA_AREA = 'bsx_ficha_area_v1';
  const DB_VENDAS     = 'bsx_fichas_vendas_v1';
  const DB_COLETORES  = 'bsx_coletores_v1'; 
  const DB_VALES      = 'bsx_vales_v1';    
  /* ===== VALES_CORE_MINI (sem VALES_PERSIST) ===== */
(function(){
  // chave por empresa (ex.: "BSX__bsx_vales_v1")
  const KEY = () => K(DB_VALES);

  // ler/escrever seguro
  function readVales(){
    try {
      const s = localStorage.getItem(KEY());
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }
  function writeVales(arr){
    try { localStorage.setItem(KEY(), JSON.stringify(Array.isArray(arr)?arr:[])); }
    catch(e){ console.warn('[VALES] erro ao salvar:', e); }
  }

  // estado interno + alias global (window.vales)
  let store = readVales();

  Object.defineProperty(window, 'vales', {
    get(){ return store; },
    set(v){ store = Array.isArray(v) ? v : []; },
    configurable: true
  });

  // salva oficial
  window.saveVales = function(){
    writeVales(store);
  };

  // quando a empresa muda: recarrega e re-renderiza a lista do gerente
  document.addEventListener('empresa:change', ()=>{
    store = readVales();
    try{ renderValesPrestacao?.(); }catch(_){}
  });

  // quando outra aba escrever nessa chave, recarrega
  window.addEventListener('storage', (e)=>{
    // usa seu helper lsKeyEndsWith, se existir
    const match = (typeof lsKeyEndsWith==='function') ? lsKeyEndsWith(e, DB_VALES)
                  : (e?.key === KEY());
    if (match){
      store = readVales();
      try{ renderValesPrestacao?.(); }catch(_){}
    }
  });

  // util de auditoria
  window._valesKey = KEY;
  window._valesAudit = function(){
    const k = KEY();
    const arr = readVales();
    console.table([{empresa: EMP(), chave:k, qtd: arr.length}]);
    return { key:k, qtd:arr.length, sample: arr.slice(0,3) };
  };
})();
 
  const DB_NEG = 'bsx_negativos_v1';
  window.DB_GERENTES = DB_GERENTES;

  Object.assign(window, {
    DB_GERENTES,
    DB_FINANCEIRO,     
    DB_PREST,
    DB_DESPESAS,
    DB_FICHAS,
    DB_FICHA_AREA,
    DB_VENDAS,
    DB_COLETORES,
    DB_VALES,
    DB_NEG,
    IDEAL_RATE
  });
  

  function getNegativoGerente(gerenteId){
    const arr = JSON.parse(localStorage.getItem(K(DB_NEG)) || '[]');
    const row = arr.find(r => String(r.gerenteId) === String(gerenteId));
    return row ? (Number(row.valor)||0) : 0;
  }
  function setNegativoGerente(gerenteId, valor){
    let arr = JSON.parse(localStorage.getItem(K(DB_NEG)) || '[]');
    const i = arr.findIndex(r => String(r.gerenteId) === String(gerenteId));
    const item = { gerenteId: String(gerenteId), valor: Number(valor)||0, updatedAt: new Date().toISOString() };
    if (i > -1) arr[i] = item; else arr.push(item);
    localStorage.setItem(K(DB_NEG), JSON.stringify(arr));
  }
  
  
  
  // ==== Estado ====
  const getCU = () => (window.UserAuth && UserAuth.currentUser && UserAuth.currentUser()) || null;
  const isAdmin = () => { const cu = getCU(); return !!(cu && cu.role === 'admin'); };
  // Permissão: admin pode tudo; operador "erika" pode EDITAR lançamentos
  const canEditLanc   = () => (window.UserAuth && UserAuth.can ? UserAuth.can('financeiro_edit') : isAdmin());
const canDeleteLanc = () => isAdmin();
  let dlgLanc; // diálogo de lançamento (global)
  let gerentes = [];
  let despesas = [];
  let fichas = [];   // [{ficha, area}]
  let vendas = [];   // [{id,ficha,ym,bruta,liquida}]
  let coletoresPadrao = []; // [{id, gerenteId, nome}]
  // ✅ REMOVIDA DECLARAÇÃO DUPLICADA DE vales (já está no sistema acima)
  let prestacaoAtual = { 
    despesas: [], 
    pagamentos: [], 
    coletas: [], 
    vales: [], 
    valeSelec: [], 
    resumo: {},
    valeParcAplicado: [] // controle de parcelas de vale aplicadas nesta edição
  };
  
  let sortState = { key:'data', dir:'desc' };
  
  // na prestação atual:
  prestacaoAtual.coletas = [];
  prestacaoAtual.valeSelec = [];
  prestacaoAtual.valeParcAplicado = [];
  
  // ==== Utils ====
  const fmtBRL = n => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const toISO = (dstr) => {
    if (!dstr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dstr)) return dstr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dstr)) { const [dd,mm,aa] = dstr.split('/'); return `${aa}-${mm}-${dd}`; }
    return dstr;
  };
  function getSelectedGerenteIdsForDespesas(){
    const nomeSel = (document.getElementById('despBuscaGerente')?.value || '').trim().toLowerCase();
    if(!nomeSel) return [];
    const ids = (gerentes||[])
      .filter(g => (g?.nome||'').trim().toLowerCase() === nomeSel)
      .map(g => g.uid)
      .filter(Boolean);
    return ids;
  }
  // transforma "2025-09-20" em "20/09"
  function fmtDiaMes(iso){
    if(!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}`;
  }
  
  
  // ✅ Usa uid do utils.js se disponível, senão cria local
  const uid = (typeof window.uid === 'function') 
    ? window.uid 
    : ()=>'u'+Math.random().toString(36).slice(2,9);
    
  // Data/hora pt-BR para tooltip
  const fmtDateTimeBR = (isoOrDate)=>{
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if(isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  };
  
  // ✅ Usa esc do utils.js se disponível, senão cria local
  const esc = (typeof window.esc === 'function')
    ? window.esc
    : s => String(s ?? '')
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'", '&#39;');
  
  const num = (id)=> Number(document.getElementById(id)?.value)||0;
  
  // ✅ Usa fmtData do utils.js se disponível, senão cria local
  const fmtData = (typeof window.fmtData === 'function')
    ? window.fmtData
    : (iso)=>{ if(!iso) return ''; const [a,m,d]=iso.split('-'); return `${d}/${m}/${a}`; };
    
  function currentYM(){ return new Date().toISOString().slice(0,7); } // AAAA-MM

  // ==== Carregar/salvar bancos ====
  function loadAll(){
    // GERENTES
    try {
      gerentes = JSON.parse(localStorage.getItem(K(DB_GERENTES)) || '[]');
      if (!Array.isArray(gerentes) || !gerentes.length) {
        gerentes = JSON.parse(localStorage.getItem(DB_GERENTES) || '[]'); // legado
      }
    } catch { gerentes = []; }
  

// FINANCEIRO — sempre carrega do banco da empresa atual
try {
  const cur = JSON.parse(localStorage.getItem(DB_FINANCEIRO) || '[]');
  window.lanc = Array.isArray(cur) ? cur.slice() : [];
  // (migrar legados só se estiver vazio)
  if (!window.lanc.length) {
    const legacy = JSON.parse(localStorage.getItem('bsx_financeiro_v4') || '[]');
    const mirror = JSON.parse(localStorage.getItem('lanc') || '[]');
    const seed   = Array.isArray(window.seedLanc) ? window.seedLanc : [];
    const src = (Array.isArray(legacy) && legacy.length) ? legacy
             : (Array.isArray(mirror) && mirror.length) ? mirror
             : seed;
    window.lanc = src.slice();
  }
} catch(_) {
  window.lanc = [];
}


// garante uid e SALVA de volta
(window.lanc || []).forEach(r => { if (!r.uid) r.uid = uid(); });

// torne o save global e único
window.saveLanc = function(){
  try {
    localStorage.setItem(DB_FINANCEIRO, JSON.stringify(window.lanc || []));
  } catch(e){
    console.error('[saveLanc] erro:', e);
  }
};

// se não havia, salva
if (!localStorage.getItem(DB_FINANCEIRO)) {
  window.saveLanc();
}


    // DESPESAS
    try {
      despesas = JSON.parse(localStorage.getItem(K(DB_DESPESAS)) || '[]');
      if (!Array.isArray(despesas)) despesas = [];
    } catch { despesas = []; }

    // FICHAS
    try {
      fichas = JSON.parse(localStorage.getItem(K(DB_FICHAS)) || '[]');
      if (!Array.isArray(fichas)) fichas = [];
    } catch { fichas = []; }

    // VENDAS
    try {
      vendas = JSON.parse(localStorage.getItem(K(DB_VENDAS)) || '[]');
      if (!Array.isArray(vendas)) vendas = [];
    } catch { vendas = []; }

    // COLETORES PADRÃO
    try {
      coletoresPadrao = JSON.parse(localStorage.getItem(K(DB_COLETORES)) || '[]');
      if (!Array.isArray(coletoresPadrao)) coletoresPadrao = [];
    } catch { coletoresPadrao = []; }
  }

  function saveGer(){
    localStorage.setItem(K(DB_GERENTES), JSON.stringify(gerentes || []));
  }
  function saveDesp(){
    localStorage.setItem(K(DB_DESPESAS), JSON.stringify(despesas || []));
  }
  function saveFichas(){
    localStorage.setItem(K(DB_FICHAS), JSON.stringify(fichas || []));
  }
  function saveVendas(){
    localStorage.setItem(K(DB_VENDAS), JSON.stringify(vendas || []));
  }
  function saveColetores(){
    localStorage.setItem(K(DB_COLETORES), JSON.stringify(coletoresPadrao || []));
  }

  window.gerentes = gerentes;
  window.despesas = despesas;
  window.fichas = fichas;
  window.vendas = vendas;
  window.coletoresPadrao = coletoresPadrao;

  window.loadAll = loadAll;
  window.saveGer = saveGer;
  window.saveDesp = saveDesp;
  window.saveFichas = saveFichas;
  window.saveVendas = saveVendas;
  window.saveColetores = saveColetores;
  window.getNegativoGerente = getNegativoGerente;
  window.setNegativoGerente = setNegativoGerente;

  // ==== GERENTES ====
  function loadGerentes(){
    try {
      gerentes = JSON.parse(localStorage.getItem(K(DB_GERENTES)) || '[]');
      if (!Array.isArray(gerentes) || !gerentes.length) {
        gerentes = JSON.parse(localStorage.getItem(DB_GERENTES) || '[]');
      }
      window.gerentes = gerentes;
    } catch { gerentes = []; window.gerentes = []; }
  }

  function renderGerentes(){
    const tb = document.getElementById('tbodyGerentes');
    if (!tb) return;
  
    tb.innerHTML = gerentes.slice().sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).map(g => {
      const c1 = (Number(g.comissao)||0).toFixed(0);
      const c2 = g.temSegundaComissao ? (' + ' + (Number(g.comissao2)||0).toFixed(0) + '%') : '';
      return `<tr data-context="gerentes" data-uid="${g.uid}">
        <td>${esc(g.nome)}</td>
        <td>${esc(g.numero||'')}</td>
        <td>${esc(g.endereco||'')}</td>
        <td>${esc(g.telefone||'')}</td>
        <td>${esc(g.email||'')}</td>
        <td>${c1}%${c2}</td>
        <td>${esc(g.obs||'')}</td>
        <td class="tv-right">
          <button type="button" class="btn btn-gerente-edit" data-edit-ger="${g.uid}">EDITAR</button>
          <button type="button" class="btn danger btn-gerente-del" data-del-ger="${g.uid}">EXCLUIR</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Nenhum gerente cadastrado.</td></tr>';
  
    // (re)bind após render
    tb.querySelectorAll('[data-edit-ger]').forEach(b=>{
      b.addEventListener('click',()=>{
        const id = b.getAttribute('data-edit-ger');
        const g = (gerentes||[]).find(x => String(x.uid||x.id)===String(id));
        if(!g) return;
        const f = document.getElementById('formGerente');
        f.nome.value=g.nome||''; f.numero.value=g.numero||''; f.endereco.value=g.endereco||'';
        f.telefone.value=g.telefone||''; f.email.value=g.email||''; f.obs.value=g.obs||''; f.comissao.value=String(g.comissao||0);
        f.setAttribute('data-editing', g.uid || g.id);
        f.scrollIntoView({behavior:'smooth'});
      });
    });
  
    tb.querySelectorAll('[data-del-ger]').forEach(b=>{
      b.addEventListener('click',()=>{
        const id = b.getAttribute('data-del-ger');
        const g = (gerentes||[]).find(x => String(x.uid||x.id)===String(id));
        if(!g) return;
        if(!currentUser?.isAdmin){ alert('Apenas ADMIN pode excluir.'); return; }
        if(confirm(`Excluir gerente ${g.nome}?`)){
          gerentes = gerentes.filter(x => String(x.uid||x.id)!==String(id));
          saveGer(); renderGerentes(); fillPcGerentes?.();
        }
      });
    });
  }
// Mostra empresa atual em algum badge
document.addEventListener('DOMContentLoaded', ()=>{
  const b = document.getElementById('companyBadge');
  if (b && window.getCompany) b.textContent = getCompany(); // do shim
});

// Re-render quando a empresa muda (pós-reload)
document.addEventListener('empresa:change', ()=>{
  try{ loadAll(); }catch(_){}
  try{ renderHome?.(); renderFin?.(); UserAuth?.guard?.(); }catch(_){}
});

  
  // ❌ REMOVIDO: Event listener duplicado de formGerente
  // O handler correto está em gerentes.js com todas as validações e lógica completa
  // Este listener estava causando salvamentos duplicados
  
      
/* ===== Floating menu util ===== */
(function(){
  let portal = null, anchor = null;

  function close(){
    if (portal) portal.remove();
    portal = null; anchor = null;
    document.removeEventListener('click', onDoc, true);
    window.removeEventListener('scroll', onRepos, true);
    window.removeEventListener('resize', onRepos, true);
  }
  function onDoc(e){
    if (!portal) return;
    if (!portal.contains(e.target) && !anchor.contains(e.target)) close();
  }
  function onRepos(){ if (portal && anchor) position(anchor, portal); }

  function position(btn, menu){
    const r  = btn.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
  
    // mede após inserido no DOM
    const w = menu.offsetWidth  || 220;
    const h = menu.offsetHeight || 120;
  
    // Preferência: abaixo e alinhado à esquerda do botão
    let left = r.left;
    let top  = r.bottom + 8;
  
    // Se estourar na direita, alinha pelo lado direito do botão
    if (left + w > vw - 8) left = Math.max(8, r.right - w);
  
    // Se estourar embaixo, abre pra cima
    if (top + h > vh - 8)  top = Math.max(8, r.top - h - 8);
  
    // Se ainda sobrar pouco espaço na esquerda, cola na margem
    if (left < 8) left = 8;
  
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }
  

  // API pública
  window.openFloatingMenu = function(btn, content){
    close();
    portal = document.createElement('div');
    portal.className = 'floating-menu';
    if (content instanceof HTMLElement) portal.appendChild(content);
    else portal.innerHTML = String(content || '');
    document.body.appendChild(portal);
    anchor = btn;
    // posiciona após estar no DOM
    position(btn, portal);

    // listeners
    setTimeout(()=>{
      document.addEventListener('click', onDoc, true);
      window.addEventListener('scroll', onRepos, true);
      window.addEventListener('resize', onRepos, true);
    }, 0);
    function onKey(e){ if(e.key === 'Escape'){ close(); } }
    document.addEventListener('keydown', onKey, true);
    
    // ...e dentro de close():
    document.removeEventListener('keydown', onKey, true);
    
    return portal;
  };
  window.closeFloatingMenu = close;
})();
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('[data-action="logout"],#btnLogout');
  if (!b) return;
  e.preventDefault();
  if (window.doLogout) { try{ window.doLogout(); } catch(_){} }
  else if (window.UserAuth && UserAuth.logout) { try{ UserAuth.logout(); } catch(_){} }
});
// ==== REACTIVIDADE GLOBAL (refresh ao salvar) ====
(function(){
  // canal entre abas (ignora se não existir)
  const BUS = ('BroadcastChannel' in window) ? new BroadcastChannel('finxia_bus_v1') : null;

  // dispara evento local + entre abas
  function emitChange(key, value){
    const payload = {
      type: 'db:change',
      key,                   // chave completa (com prefixo da empresa)
      shortKey: String(key||'').split('__').pop(), // ex.: 'bsx_fin_lanc'
      ts: Date.now()
    };
    try { document.dispatchEvent(new CustomEvent('db:change', { detail: payload })); } catch(_){}
    try { window.dispatchEvent(new CustomEvent('db:change', { detail: payload })); } catch(_){}
    try { BUS && BUS.postMessage(payload); } catch(_){}
  }

  // --- wrap do jset (NOSSO helper) ---
  const __jset = window.jset; // guarda a original
  window.jset = function(key, val){
    const full = K(key);
    __jset(key, val);         // escreve
    emitChange(full, val);    // avisa
  };

  // --- wrap defensivo do localStorage.setItem (p/ quem grava direto) ---
  const __lsSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k, v){
    __lsSet(k, v);
    emitChange(k, v);
  };

  // mensagens cruzadas entre abas
  BUS && (BUS.onmessage = (e)=>{
    if (!e?.data || e.data.type!=='db:change') return;
    document.dispatchEvent(new CustomEvent('db:change', { detail: e.data }));
  });

  // === O que atualizar quando qualquer banco muda ===
  const INTEREST = new Set([
    K(DB_FINANCEIRO),
    K(DB_DESPESAS),
    K(DB_GERENTES),
    K(DB_PREST),
    K(DB_FICHAS),
    K(DB_VENDAS),
    K(DB_VALES),
    K(DB_COLETORES),
  ]);

  // pequeno debounce para não repintar 100x
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  const refreshAll = debounce(()=>{
    // recarrega caches
    try{ loadAll?.(); }catch(_){}
    // módulos
    try{ renderFin?.(); }catch(_){}
    try{ renderDespesas?.(); }catch(_){}
    try{ renderGerentes?.(); }catch(_){}
    try{ buildDespesasFilterOptions?.(); }catch(_){}
    // prestações
    try{
      pcRender?.(); pcRenderColetas?.(); pgRender?.(); pcDesenharCanvas?.();
      pcUpdateTotals?.(); pcCalcular?.();
    }catch(_){}
    // relatórios / dashboard (se existirem)
    try{ renderRelatorios?.(); }catch(_){}
    try{ dashboardRender?.(); }catch(_){}
    // RBAC/visibilidade
    try{ UserAuth?.guard?.(); }catch(_){}
  }, 80);

  // mesmo TAB
  document.addEventListener('db:change', (ev)=>{
    const k = ev?.detail?.key || '';
    if (INTEREST.has(k)) refreshAll();
  });

  // outras abas (evento nativo do storage)
  window.addEventListener('storage', (e)=>{
    if (INTEREST.has(e.key)) refreshAll();
  });

  // trocar empresa também deve repintar tudo
  document.addEventListener('empresa:change', refreshAll);
})();