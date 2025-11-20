// ==== DESPESAS ====
// ===== INICIALIZAÇÃO GLOBAL DE DESPESAS =====
// ✅ CARREGAR DESPESAS DO SUPABASE
async function loadDespesas() {
  try {
    const despesas = await window.SupabaseAPI.despesas.getAll();
    window.despesas = despesas.map(d => ({
      // Mapear campos do Supabase para JS
      id: d.id,
      uid: d.uid || d.id,
      ficha: d.ficha || '',
      gerenteNome: d.gerente_nome || '', // gerente_nome → gerenteNome
      info: d.descricao || '', // descricao → info
      valor: Number(d.valor) || 0,
      data: d.data || '',
      periodoIni: d.periodo_ini || '', // periodo_ini → periodoIni
      periodoFim: d.periodo_fim || '', // periodo_fim → periodoFim
      isHidden: d.oculta || false, // oculta → isHidden
      rota: d.rota || '',
      categoria: d.categoria || '',
      obs: d.obs || '',
      editada: d.editada || false
    }));
    console.log('[Despesas] Carregadas do Supabase:', window.despesas.length);
    return window.despesas;
  } catch (error) {
    console.error('[Despesas] Erro ao carregar:', error);
    window.despesas = [];
    return [];
  }
}

// ✅ SALVAR DESPESA NO SUPABASE
async function saveDespesa(despesa) {
  try {
    // Mapear campos do JS para Supabase
    const despesaParaSalvar = {
      uid: despesa.uid || despesa.id,
      ficha: despesa.ficha || '',
      gerenteNome: despesa.gerenteNome || '', // Será convertido para gerente_nome na API
      info: despesa.info || '', // Será convertido para descricao na API
      valor: Number(despesa.valor) || 0,
      data: despesa.data || '',
      periodoIni: despesa.periodoIni || '', // Será convertido para periodo_ini na API
      periodoFim: despesa.periodoFim || '', // Será convertido para periodo_fim na API
      isHidden: despesa.isHidden || false, // Será convertido para oculta na API
      rota: despesa.rota || '',
      categoria: despesa.categoria || '',
      obs: despesa.obs || ''
    };
    
    if (despesa.id) {
      // Atualizar existente
      await window.SupabaseAPI.despesas.updateByUid(despesa.uid, despesaParaSalvar);
    } else {
      // Criar nova
      despesaParaSalvar.uid = window.uid();
      await window.SupabaseAPI.despesas.create(despesaParaSalvar);
    }
    
    // Recarrega lista
    await loadDespesas();
    
    console.log('[Despesas] Salva com sucesso');
  } catch (error) {
    console.error('[Despesas] Erro ao salvar:', error);
    throw error;
  }
}

// Substituir window.saveDesp
window.saveDesp = saveDespesa;

// Helper functions para compatibilidade
function __getDespesas() {
  return window.despesas || [];
}

function __setDespesas(arr) {
  window.despesas = arr;
}

// Inicializa despesas ao carregar
(async function initDespesas() {
  console.log('[Despesas] 🔄 Iniciando carregamento...');
  
  // Aguardar API estar disponível
  let tentativas = 0;
  while (!window.SupabaseAPI?.despesas && tentativas < 20) {
    console.log('[Despesas] ⏳ Aguardando API Supabase...');
    await new Promise(resolve => setTimeout(resolve, 500));
    tentativas++;
  }
  
  if (!window.SupabaseAPI?.despesas) {
    console.error('[Despesas] ❌ API Supabase não disponível!');
    window.despesas = [];
    return;
  }
  
  // Carregar despesas
  await loadDespesas();
  
  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Despesas] 📊 DOM pronto, renderizando...');
      if (typeof renderDespesas === 'function') {
        renderDespesas();
      }
    });
  } else {
    console.log('[Despesas] 📊 DOM já pronto, renderizando...');
    if (typeof renderDespesas === 'function') {
      renderDespesas();
    }
  }
  
  console.log('[Despesas] ✅ Inicialização completa');
})();


(function  ()  {
    'use strict';
  
  // Função de escape segura
  window.escapeHTML = function(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  };
  
  // Função para criar elementos seguros
  window.createSafeElement = function(tag, content, attributes = {}) {
    const elem = document.createElement(tag);
    if (content) elem.textContent = content;
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'onclick' || key.startsWith('on')) {
        // Não permite eventos inline
        console.warn('Eventos inline bloqueados por segurança');
      } else {
        elem.setAttribute(key, String(value));
      }
    });
    return elem;
  };
});

// Helpers
function getRotaByFicha(ficha) {
    const rec = (fichas || []).find(f => String(f.ficha) === String(ficha));
    return rec ? rec.area : '';
  }
  function getVendaMesByDespesa(ficha, dataISO, periodoIni, periodoFim) {
    const baseISO = (dataISO || periodoFim || periodoIni || '').slice(0, 10);
    if (!baseISO) return null;
    const [yyyy, mm] = baseISO.split('-').map(Number);
    let prevY = yyyy, prevM = mm - 1;
    if (prevM === 0) { prevM = 12; prevY = yyyy - 1; }
    const prevYM = `${prevY}-${String(prevM).padStart(2,'0')}`;
    return (vendas || []).find(v => String(v.ficha) === String(ficha) && v.ym === prevYM) || null;
  }

  function renderDespesas(){
    const tb = document.getElementById('tbodyDespesas');
    const buscaG = (document.getElementById('despBuscaGerente').value||'').toLowerCase();
    const buscaF = (document.getElementById('despBuscaFicha').value||'').toLowerCase();
    const buscaR = (document.getElementById('despBuscaRota')?.value||'').toLowerCase();
    const de = document.getElementById('despDe').value || '0000-00-00';
    const ate = document.getElementById('despAte').value || '9999-12-31';
    const showHidden = !!document.getElementById('despMostrarOcultas')?.checked;


    // Permissões por perfil
    const CU   = window.currentUser || {};
    const role = (CU.role || CU.perfil || '').toLowerCase();
    
const isAdmin     = !!window.currentUser?.isAdmin || role === 'admin';
const isOperador  = window.currentUser?.isOperador === true || role === 'operador';


// Operador não vê Ideal/Diferença/Status
const hideRestricted = isOperador;

// Botões
const canToggleHide = isAdmin || isOperador; // liberar Ocultar/Desocultar p/ operador e admin
const canDelete     = isAdmin;               // Excluir só admin

// Menu "Opções" igual ao das prestações
function makeDespActionsMenu({ id, isHidden }, { canDelete }){
  const hideLbl = isHidden ? 'Desocultar' : 'Ocultar';
  const delBtn  = canDelete ? `<button class="mi danger" data-desp-act="excluir" data-id="${id}" role="menuitem">Excluir</button>` : '';

  return `
    <div class="desp-acts">
      <span class="desp-dd" data-desp-dd>
        <button class="btn sm" data-desp-dd-toggle data-id="${id}" aria-haspopup="true" aria-expanded="false">
          Opções ▾
        </button>
        <div class="desp-menu" data-desp-dd-menu role="menu">
          <button class="mi" data-desp-act="toggle-hide" data-id="${id}" role="menuitem">${hideLbl}</button>
          <button class="mi" data-desp-act="editar"      data-id="${id}" role="menuitem">Editar</button>
          ${delBtn}
        </div>
      </span>
    </div>
  `;
}


  
    // Quantidade de colunas (para mensagens vazias)
    const colCount = tb?.closest('table')?.querySelectorAll('thead th').length || 12;
  
// 1) Filtra
const list = __getDespesas().filter(r=>{
  if(r.data < de || r.data > ate) return false;
  if(!showHidden && r.isHidden)   return false;

  const nomeG = (r.gerenteNome||'').toLowerCase();
  if (buscaG && nomeG !== buscaG) return false;

  const fichaStr = String(r.ficha||'').toLowerCase();
  if (buscaF && fichaStr !== buscaF) return false;

  const rotaStr = (getRotaByFicha(r.ficha) || '').toLowerCase();
  if (buscaR && rotaStr !== buscaR) return false;

  return true;
});

  
    // 2) Agrupa por ficha
    const groups = new Map();
    for(const r of list){
      // Tratar ficha vazia como "(sem ficha)"
      const key = String(r.ficha || '').trim() || '(sem ficha)';
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
  
    // 3) Ordena fichas
    const fichasOrd = Array.from(groups.keys()).sort((a,b)=> a.localeCompare(b, 'pt-BR', { numeric:true }));
    
    // Helper: venda ref (mês anterior usando a data MAIS RECENTE do grupo)
    function vendaRefMesAnterior(ficha, itens){
      let baseISO = itens.map(x=>x.data||'').filter(Boolean).sort().pop(); // mais recente
      const v = getVendaMesByDespesa(ficha, baseISO, itens[0]?.periodoIni, itens[0]?.periodoFim);
      return {
        vBruta: v ? (Number(v.bruta)||0)   : 0,
        vLiq:   v ? (Number(v.liquida)||0) : 0
      };
    }
  
    const linhas = [];
  
    for(const ficha of fichasOrd){
      const itens = groups.get(ficha).slice().sort((a,b)=> (a.data||'').localeCompare(b.data||''));
      const qtd   = itens.length;
  
      const rota  = getRotaByFicha(ficha) || '(sem rota)';
      const gerentesSet = Array.from(new Set(itens.map(x=> (x.gerenteNome||'(sem gerente)').trim()).filter(Boolean)));
      const gerenteNome = gerentesSet.length <= 1 ? (gerentesSet[0]||'(sem gerente)') : 'Vários';
  
      if(qtd === 1){
        // === 1 despesa → igual antes
        const r = itens[0];
        const venda = getVendaMesByDespesa(r.ficha, r.data, r.periodoIni, r.periodoFim);
        const vBruta  = venda ? (Number(venda.bruta)||0)  : 0;
        const vLiq    = venda ? (Number(venda.liquida)||0): 0;
        const ideal   = vBruta * IDEAL_RATE;
        const valorAj = Number(r.valor)||0;
        const dif     = valorAj - ideal;
        const status  = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');
        const toggleBtn = canToggleHide
  ? `<button type="button" class="btn ${r.isHidden?'secondary':''}" data-toggle-hide="${r.id}">
       ${r.isHidden?'Desocultar':'Ocultar'}
     </button>`
  : '';

const del = canDelete
  ? `<button type="button" class="btn danger" data-del-desp="${r.id}">Excluir</button>`
  : 'n';

      
        const selo = r.isHidden ? '<span class="pill-oculta" title="Esta despesa está oculta">ocultada</span>' : '';
        const difColor = status==='ACIMA' ? '#b91c1c' : (status==='ABAIXO' ? '#2563eb' : '#16a34a');
  
        const infoTxt = `${esc(r.info||'')} — <small class="muted">${fmtDiaMes(r.data)}</small>${selo}`;
        const actions = makeDespActionsMenu({ id:r.id, isHidden:!!r.isHidden }, { canDelete });
        
        linhas.push(`
          <tr class="${r.isHidden?'row-oculta':''}">
            <!-- REMOVIDO: td da Data -->
            <td>${esc(gerenteNome)}</td>
            <td>${esc(rota)}</td>
            <td>${esc(r.ficha||'')}</td>
            <td style="text-align:left">${infoTxt}</td>
            <td>${fmtBRL(valorAj)}</td>
            <td>${hideRestricted ? '' : fmtBRL(ideal)}</td>
            <td style="color:${hideRestricted ? 'inherit' : difColor}">
              ${hideRestricted ? '' : ((dif >= 0 ? '+' : '') + fmtBRL(dif))}
            </td>
            <td>${hideRestricted ? '' : status}</td>
            <td>${fmtBRL(vBruta)}</td>
            <td>${fmtBRL(vLiq)}</td>
            <td>${actions}</td>
          </tr>
        `);
          
      } else {
        // === 2+ despesas → resumo + linhas-filhas abaixo (estilo Excel)
        const totalAjuda = itens.reduce((acc,it)=> acc + (Number(it.valor)||0), 0);
        const { vBruta, vLiq } = vendaRefMesAnterior(ficha, itens);
        const ideal = vBruta * IDEAL_RATE;
        const dif   = totalAjuda - ideal;
        const status  = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');
        const difColor = status==='ACIMA' ? '#b91c1c' : (status==='ABAIXO' ? '#2563eb' : '#16a34a');
      
        const safe = s => String(s||'').replace(/[^\w-]/g,'');
const gNome   = safe(gerenteNome);
const pIni    = safe(itens[0]?.periodoIni);
const pFim    = safe(itens[0]?.periodoFim);
const groupId = `grp-${safe(ficha)}-${gNome}-${pIni}-${pFim}`;
      
        // 1) LINHA RESUMO (Informações = "Total Despesas"; Valor Ajuda = total + link mostrar/ocultar)
        linhas.push(`
          <tr data-group="${groupId}">
            <!-- REMOVIDO: td "—" da Data -->
            <td>${esc(gerenteNome)}</td>
            <td>${esc(rota)}</td>
            <td>${esc(ficha)}</td>
            <td style="text-align:left"><strong>Total Despesas</strong></td>
            <td>
              <span>${fmtBRL(totalAjuda)}</span>
              <button type="button" class="btn-mini-toggle"
                      data-inline-toggle="${groupId}" aria-expanded="false">
                + detalhes
              </button>
            </td>
            <td>${hideRestricted ? '' : fmtBRL(ideal)}</td>
            <td style="color:${hideRestricted ? 'inherit' : difColor}">
              ${hideRestricted ? '' : ((dif >= 0 ? '+' : '') + fmtBRL(dif))}
            </td>
            <td>${hideRestricted ? '' : status}</td>
            <td>${fmtBRL(vBruta)}</td>
            <td>${fmtBRL(vLiq)}</td>
            <td></td>
          </tr>
        `);
        
      
// 2) LINHAS-FILHAS (uma por despesa), inicialmente ocultas
//    Mesma quantidade de colunas do cabeçalho (11 colunas).
for (const it of itens){
  const selo    = it.isHidden ? '<span class="pill-oculta" title="Esta despesa está oculta">ocultada</span>' : '';
  const infoTxt = `${esc(it.info||'')} — <small class="muted">${fmtDiaMes(it.data)}</small>${selo}`;
  const actions = makeDespActionsMenu({ id:it.id, isHidden:!!it.isHidden }, { canDelete });

  linhas.push(`
    <tr class="tr-det" data-parent="${groupId}" style="display:none">
      <td></td>                 <!-- Gerente (vazio para alinhar) -->
      <td></td>                 <!-- Rota    (vazio) -->
      <td></td>                 <!-- Ficha   (vazio) -->
      <td class="td-info-indent" style="text-align:left">${infoTxt}</td>  <!-- Informações + data -->
      <td>${fmtBRL(it.valor)}</td>   <!-- Valor Ajuda -->
      <td></td>                 <!-- Ideal -->
      <td></td>                 <!-- Diferença -->
      <td></td>                 <!-- Status -->
      <td></td>                 <!-- Venda Bruta -->
      <td></td>                 <!-- Venda Líquida -->
      <td>${actions}</td>       <!-- Ações (menu Opções) -->
    </tr>
  `);
}

        }       
  
    tb.innerHTML = linhas.join('');
  
    // Aviso de ocultas (mesma lógica)
    atualizaAvisoOcultas();
  
    function atualizaAvisoOcultas(){
      const avisoEl = document.getElementById('despAvisoOcultas');
      if (!avisoEl) return;
    
      // agora só mostra se houver gerente selecionado
      const gerenteSel = (document.getElementById('despBuscaGerente')?.value || '').trim();
      if (!gerenteSel) {
        avisoEl.classList.add('hidden');
        avisoEl.textContent = '';
        return;
      }
    
      const de = document.getElementById('despDe').value || '0000-00-00';
      const ate = document.getElementById('despAte').value || '9999-12-31';
    
      const hiddenCount = __getDespesas().filter(r=>{
        if(!r.isHidden) return false;
        if(r.data < de || r.data > ate) return false;
        return (r.gerenteNome||'').toLowerCase().includes(gerenteSel.toLowerCase());
      }).length;
    
      if (hiddenCount > 0){
        avisoEl.textContent = `⚠ Este gerente possui ${hiddenCount} despesa(s) ocultada(s) neste período. Marque “Mostrar ocultas” para visualizar.`;
        avisoEl.classList.remove('hidden');
      } else {
        avisoEl.classList.add('hidden');
        avisoEl.textContent = '';
      }
    }    
    }}

    (function bindDespUIFloating(){
      if (window.__despUIFloatingBound) return;
      window.__despUIFloatingBound = true;
    
      const root = document.getElementById('pageDespesas') || document;
    
      function clearOpenFlags(){
        document.querySelectorAll('[data-desp-dd-toggle][data-menu-open="1"]')
          .forEach(b => b.removeAttribute('data-menu-open'));
      }
    
      // Abre/fecha o menu via PORTAL no <body> (sobre a tabela)
      root.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-desp-dd-toggle]');
        if (!btn) return;
        e.preventDefault();
    
        // toggle: se já está aberto, fecha
        if (btn.getAttribute('data-menu-open') === '1'){
          if (typeof closeFloatingMenu === 'function') closeFloatingMenu();
          btn.removeAttribute('data-menu-open');
          return;
        }
    
        // fecha qualquer outro aberto
        clearOpenFlags();
        if (typeof closeFloatingMenu === 'function') closeFloatingMenu();
    
        const id  = btn.getAttribute('data-id');
        const arr = (typeof __getDespesas==='function') ? __getDespesas() : (window.despesas||[]);
        const r   = arr.find(x => [x.id,x.uid,x.key].some(v => String(v)===String(id))) || {};
        const canDelete = !!(window.currentUser?.isAdmin);
        const hideLbl   = (r.isHidden || r.oculto || r.hidden) ? 'Desocultar' : 'Ocultar';
    
        const html = `
          <div>
            <button class="mi" data-desp-act="toggle-hide" data-id="${id}">${hideLbl}</button>
            <button class="mi" data-desp-act="editar" data-id="${id}">Editar</button>
            ${canDelete ? `<button class="mi danger" data-desp-act="excluir" data-id="${id}">Excluir</button>` : ``}
          </div>
        `;
    
        if (window.openFloatingMenu) {
          openFloatingMenu(btn, html);
          btn.setAttribute('data-menu-open','1'); // marca como aberto para o toggle
        } else {
          // fallback antigo (se não tiver o helper carregado)
          btn.closest('[data-desp-dd]')?.classList.toggle('open');
        }
      }, true);
    
      // Clicar fora fecha o menu (e limpa a marca do botão)
      document.addEventListener('click', (e)=>{
        const isToggle = !!e.target.closest('[data-desp-dd-toggle]');
        const inMenu   = !!e.target.closest('.floating-menu');
        if (isToggle || inMenu) return; // não é "fora"
        clearOpenFlags();
        if (typeof closeFloatingMenu==='function') closeFloatingMenu();
      }, true);
    
      // AÇÕES do menu (funciona com o portal)
      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-desp-act]');
        if (!btn) return;
        e.preventDefault();
    
        const act = btn.getAttribute('data-desp-act');
        const id  = btn.getAttribute('data-id');
    
        // fecha o menu e limpa marcações
        clearOpenFlags();
        if (typeof closeFloatingMenu==='function') closeFloatingMenu();
    
        if (act === 'toggle-hide'){
          const arr = __getDespesas();
          const i   = arr.findIndex(x => [x.id,x.uid,x.key].some(v => String(v)===String(id)));
          if (i<0) return alert('Despesa não encontrada.');
          const novo = !(arr[i].isHidden || arr[i].oculto || arr[i].hidden);
          arr[i].isHidden = novo; arr[i].oculto = novo; arr[i].hidden = novo;
          __setDespesas(arr);
          if (typeof saveDesp==='function') saveDesp();
          if (typeof renderDespesas==='function') renderDespesas();
          return;
        }
    
        if (act === 'editar'){
          const fns = ['editDespesa','openDespesaDialog','__desp_openDialog','editarDespesa'];
          for (const fn of fns){ if (typeof window[fn]==='function'){ window[fn](id); break; } }
          return;
        }
    
        if (act === 'excluir'){
          if (!window.currentUser?.isAdmin) { alert('Apenas ADMIN pode excluir.'); return; }
          if (!confirm('Excluir esta despesa?')) return;
          const arr  = __getDespesas();
          const novo = arr.filter(x => ![x.id,x.uid,x.key].some(v => String(v)===String(id)));
          __setDespesas(novo);
          if (typeof saveDesp==='function') saveDesp();
          if (typeof renderDespesas==='function') renderDespesas();
          return;
        }
      }, true);
    
      // Escape também fecha
      document.addEventListener('keydown', (e)=>{
        if (e.key !== 'Escape') return;
        clearOpenFlags();
        if (typeof closeFloatingMenu==='function') closeFloatingMenu();
      }, true);
    })();
    
    
    
  /* ================== DESPESAS: listas de opções dos filtros (encadeadas) ================== */
  function buildDespesasFilterOptions() {
    // Garante que os 3 filtros sejam <select>
    const selG = ensureSelect('despBuscaGerente'); // Gerente
    const selR = ensureSelect('despBuscaRota');    // Rota
    const selF = ensureSelect('despBuscaFicha');   // Ficha
    if (!selG || !selR || !selF) return;
  
    const de  = document.getElementById('despDe').value || '0000-00-00';
    const ate = document.getElementById('despAte').value || '9999-12-31';
  
    // Base: considera despesas no período (visíveis e ocultas)
    const base = (despesas || []).filter(d =>
      d.data >= de && d.data <= ate
    );
    
  
    // Valores atuais (para tentar manter seleção ao recriar opções)
    const curG = selG.value;
    const curR = selR.value;
    const curF = selF.value;
  
    // --- Opções de GERENTE: só quem tem despesa no período ---
    const gerentes = Array.from(new Set(
      base.map(d => (d.gerenteNome || '').trim()).filter(Boolean)
    )).sort((a,b)=> a.localeCompare(b));
  
    selG.innerHTML = [
      `<option value="">Selecione o gerente</option>`,
      ...gerentes.map(n => `<option value="${esc(n)}"${n===curG?' selected':''}>${esc(n)}</option>`)
    ].join('');
  
    // Reaplica seleção se existir; senão, vazio
    if (selG.value && !gerentes.includes(selG.value)) selG.value = '';
  
    // --- Opções de ROTA: dependem do gerente selecionado ---
    const baseR = selG.value
      ? base.filter(d => (d.gerenteNome||'').trim() === selG.value)
      : base;
  
    const rotas = Array.from(new Set(
      baseR.map(d => String(getRotaByFicha(d.ficha) || '').trim()).filter(Boolean)
    )).sort((a,b)=> a.localeCompare(b));
  
    selR.innerHTML = [
      `<option value="">Selecione a rota</option>`,
      ...rotas.map(r => `<option value="${esc(r)}"${r===curR?' selected':''}>${esc(r)}</option>`)
    ].join('');
  
    if (selR.value && !rotas.includes(selR.value)) selR.value = '';
  
    // --- Opções de FICHA: dependem de gerente e rota selecionados ---
    const baseF = baseR.filter(d => {
      if (!selR.value) return true;
      const rota = String(getRotaByFicha(d.ficha) || '').trim();
      return rota === selR.value;
    });
  
    const fichas = Array.from(new Set(
      baseF.map(d => String(d.ficha||'').trim()).filter(Boolean)
    )).sort((a,b)=> a.localeCompare(b, 'pt-BR', { numeric:true }));
  
    selF.innerHTML = [
      `<option value="">Selecione a ficha</option>`,
      ...fichas.map(f => `<option value="${esc(f)}"${f===curF?' selected':''}>${esc(f)}</option>`)
    ].join('');
  
    if (selF.value && !fichas.includes(selF.value)) selF.value = '';
  
    // Handlers (encadeados)
    selG.onchange = ()=>{ buildDespesasFilterOptions(); renderDespesas(); };
    selR.onchange = ()=>{ buildDespesasFilterOptions(); renderDespesas(); };
    selF.onchange = ()=>{ renderDespesas(); };
  }
      // --- BOTÕES DE IMPRESSÃO (substitui o "Exportar CSV" se existir) ---
      (function injectPrintButtons(){
        const csvBtn = document.getElementById('despExport');
        const host = csvBtn?.parentElement || document.querySelector('#pageDespesas') || document.body;
      
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '12px';
        wrap.style.alignItems = 'center';
      
        const btnG = document.createElement('button');
        btnG.id = 'btnPrintGerente';
        btnG.className = 'btn';
        btnG.textContent = 'Imprimir tabela (gerente)';
      
        const btnC = document.createElement('button');
        btnC.id = 'btnPrintComissao';
        btnC.className = 'btn ghost';
        btnC.textContent = 'Imprimir tabela p/ comissão';
      
        wrap.appendChild(btnG);
        wrap.appendChild(btnC);
      
        if (csvBtn) {
          // ✅ opção A: manter o CSV e colocar os novos ao lado
          // csvBtn.insertAdjacentElement('afterend', wrap);
      
          // ✅ opção B: REMOVER o CSV e colocar os novos no lugar
          const parent = csvBtn.parentElement;          // guarda o pai
          const ref = csvBtn.nextSibling;               // guarda a posição
          csvBtn.remove();                               // remove o CSV
          if (ref) parent.insertBefore(wrap, ref); else parent.appendChild(wrap);
        } else {
          host.prepend(wrap);
        }
      })();
      // === AGRUPA PARA IMPRESSÃO (totais por ficha) ===
function __groupDespPrintRows(base){
  // agrupa por ficha
  const groups = new Map();
  for (const d of base){
    const k = String(d.ficha || '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }

  const out = [];
  for (const [ficha, itens] of groups.entries()){
    // rota pelo cadastro de fichas
    const rota = getRotaByFicha(ficha) || '—';

    // data mais recente do grupo para referenciar o mês anterior p/ venda
    const baseISO = itens.map(x=>x.data||'').filter(Boolean).sort().pop();
    const venda   = getVendaMesByDespesa(ficha, baseISO, itens[0]?.periodoIni, itens[0]?.periodoFim);
    const vBruta  = venda ? (Number(venda.bruta)||0)   : 0;
    const vLiq    = venda ? (Number(venda.liquida)||0) : 0;

    // totais
    const valorAj = itens.reduce((s,it)=> s + (Number(it.valor)||0), 0);
    const ideal   = vBruta * (typeof IDEAL_RATE==='number' ? IDEAL_RATE : 0);
    const dif     = valorAj - ideal;
    const status  = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');

    out.push({
      rota,
      ficha: String(ficha),
      info: 'Total Despesas',   // sem “+ detalhes”
      valorAj,
      ideal,
      dif,
      status,
      vBruta,
      vLiq
    });
  }
  // ordena por ficha (numérico-aware)
  out.sort((a,b)=> a.ficha.localeCompare(b.ficha, 'pt-BR', {numeric:true}));
  return out;
}


// Retorna despesas do gerente selecionado, no período atual, SEM ocultas,
// respeitando também os filtros de ROTA (área) e FICHA, se estiverem selecionados.
function __getDespesasParaImprimir() {
  const gerenteSel = (document.getElementById('despBuscaGerente')?.value || '').trim();
  if (!gerenteSel) {
    alert('Selecione um gerente antes de imprimir.');
    return null;
  }

  // filtros de período
  const de  = document.getElementById('despDe')?.value || '0000-00-00';
  const ate = document.getElementById('despAte')?.value || '9999-12-31';

  // NOVOS filtros
  const rotaSel  = (document.getElementById('despBuscaRota')?.value || '').trim();   // pode vir vazio
  const fichaSel = (document.getElementById('despBuscaFicha')?.value || '').trim();  // pode vir vazio

  const arr = __getDespesas().filter(d => {
    // gerente (obrigatório)
    if ((d.gerenteNome || '').trim() !== gerenteSel) return false;

    // período
    if (!(d.data >= de && d.data <= ate)) return false;

    // não imprimir ocultas
    if (d.isHidden) return false;

    // rota (se selecionada)
    if (rotaSel) {
      const rota = String(getRotaByFicha(d.ficha) || '').trim();
      if (rota !== rotaSel) return false;
    }

    // ficha (se selecionada)
    if (fichaSel) {
      const fichaStr = String(d.ficha || '').trim();
      if (fichaStr !== fichaSel) return false;
    }

    return true;
  });

  return { gerenteSel, arr, de, ate, rotaSel, fichaSel };
}


// Converte despesas em linhas para impressão
function __mapDespPrintRows(base) {
  return base.map(d => {
    const rota = getRotaByFicha(d.ficha) || '—';
    const venda = getVendaMesByDespesa(d.ficha, d.data, d.periodoIni, d.periodoFim);
    const vBruta = venda ? (Number(venda.bruta) || 0) : 0;
    const vLiq   = venda ? (Number(venda.liquida) || 0) : 0;

    const valorAj = Number(d.valor) || 0;
    const ideal   = vBruta * (typeof IDEAL_RATE === 'number' ? IDEAL_RATE : 0);
    const dif     = valorAj - ideal;
    const status  = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');

    return {
      rota,
      ficha: String(d.ficha || ''),
      info: `${d.info || ''} — ${fmtDiaMes(d.data)}`,
      valorAj,
      ideal,
      dif,
      status,
      vBruta,
      vLiq
    };
  });
}
// === PRINT: agrupa por ficha com DETALHES + TOTAL abaixo
function __mapDespPrintRows_groupedWithTotals(base){
  // agrupa por ficha
  const groups = new Map();
  for (const d of base){
    const k = String(d.ficha || '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }

  const fichasOrd = Array.from(groups.keys())
    .sort((a,b)=> a.localeCompare(b, 'pt-BR', { numeric:true }));

  const rows = [];

  for (const ficha of fichasOrd){
    const itens = groups.get(ficha).slice()
      .sort((a,b)=> String(a.data||'').localeCompare(String(b.data||'')));
    const rota = getRotaByFicha(ficha) || '—';

    if (itens.length === 1){
      // === CASO SINGLE: calcula direto na própria linha
      const it = itens[0];
      const baseISO = it.data || itens[0]?.periodoFim || itens[0]?.periodoIni;
      const venda   = getVendaMesByDespesa(ficha, baseISO, it.periodoIni, it.periodoFim);
      const vBruta  = venda ? (Number(venda.bruta)||0)   : 0;
      const vLiq    = venda ? (Number(venda.liquida)||0) : 0;

      const valorAj = Number(it.valor)||0;
      const ideal   = vBruta * (typeof IDEAL_RATE==='number' ? IDEAL_RATE : 0);
      const dif     = valorAj - ideal;
      const status  = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');

      rows.push({
        __rowType: 'single',            // <<< importante
        rota,
        ficha: String(ficha),
        info: `${it.info || ''} — ${fmtDiaMes(it.data)}`,
        valorAj,
        ideal,
        dif,
        status,
        vBruta,
        vLiq
      });
      continue;
    }

    // === DETALHES (sem cálculos nas linhas-filhas)
    for (const it of itens){
      rows.push({
        __rowType: 'detail',
        rota,
        ficha: String(ficha),
        info: `${it.info || ''} — ${fmtDiaMes(it.data)}`,
        valorAj: Number(it.valor)||0,
        ideal: null,
        dif:   null,
        status: '',
        vBruta: null,
        vLiq:   null
      });
    }

    // === TOTAL (somente quando 2+ despesas)
    const baseISO = itens.map(x=>x.data||'').filter(Boolean).sort().pop();
    const venda   = getVendaMesByDespesa(ficha, baseISO, itens[0]?.periodoIni, itens[0]?.periodoFim);
    const vBruta  = venda ? (Number(venda.bruta)||0)   : 0;
    const vLiq    = venda ? (Number(venda.liquida)||0) : 0;

    const valorAjTot = itens.reduce((s,it)=> s + (Number(it.valor)||0), 0);
    const ideal      = vBruta * (typeof IDEAL_RATE==='number' ? IDEAL_RATE : 0);
    const dif        = valorAjTot - ideal;
    const status     = Math.abs(dif) < 0.005 ? 'IDEAL' : (dif > 0 ? 'ACIMA' : 'ABAIXO');

    rows.push({
      __rowType: 'total',
      rota,
      ficha: String(ficha),
      info: 'Total da ficha',
      valorAj: valorAjTot,
      ideal,
      dif,
      status,
      vBruta,
      vLiq
    });
  }

  return rows;
}

function __calcTotais(rows){
  let ajuda=0, bruta=0, liqui=0;
  for (const r of rows){
    if (r.__rowType === 'detail' || r.__rowType === 'single'){
      ajuda += Number(r.valorAj)||0;         // detalhes e singles contam ajuda
    }
    if (r.__rowType === 'total'  || r.__rowType === 'single'){
      bruta += Number(r.vBruta)||0;          // bruta/liquida em total e single
      liqui += Number(r.vLiq)||0;
    }
  }
  return { ajuda, bruta, liqui };
}


function __buildPrintHTML({ titulo, sub, rows, modo }) {
  const isCom = (modo === 'comissao');
  const totais = __calcTotais(rows);

  const css = `
    <style>
      *{ box-sizing:border-box; }
      body{ margin:0; font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#111827; }
      .head{ padding:16px 20px; border-bottom:1px solid #e5e7eb; }
      .head h1{ margin:0 0 6px 0; font-size:18px; }
      .head small{ color:#6b7280; }
      .tbl-wrap{ padding:16px 20px; }
      table{ width:100%; border-collapse:collapse; table-layout:fixed; }
      thead th{ background:#111827; color:#fff; font-weight:600; padding:10px 8px; text-align:left; }
      tbody td, tfoot td{ border-bottom:1px solid #e5e7eb; padding:8px; vertical-align:top; }
      tfoot td{ font-weight:700; background:#f9fafb; }
      tr.group-total td{ font-weight:700; background:#f9fafb; border-top:2px solid #e5e7eb; }
      .num{ text-align:right; }
      .muted{ color:#6b7280; }
      .red{ color:#b91c1c; }
      .blue{ color:#2563eb; }
      @media print{
        body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .no-print{ display:none !important; }
      }
      .col-rota{ width:110px }
      .col-ficha{ width:90px }
      .col-info{ width:auto }
      .col-num{ width:130px }
      .col-status{ width:100px }
    </style>
  `;

  const head = `
    <div class="head">
      <h1>${titulo}</h1>
      <small class="muted">${sub}</small>
    </div>
  `;

  const thead = isCom
    ? `
      <thead>
        <tr>
          <th class="col-rota">Rota</th>
          <th class="col-ficha">Ficha</th>
          <th class="col-info">Informações</th>
          <th class="col-num">Valor Ajuda</th>
          <th class="col-num">Venda Bruta</th>
        </tr>
      </thead>
    `
    : `
      <thead>
        <tr>
          <th class="col-rota">Rota</th>
          <th class="col-ficha">Ficha</th>
          <th class="col-info">Informações</th>
          <th class="col-num">Valor Ajuda</th>
          <th class="col-num">Ideal</th>
          <th class="col-num">Diferença</th>
          <th class="col-status">Status</th>
          <th class="col-num">Venda Bruta</th>
          <th class="col-num">Venda Líquida</th>
        </tr>
      </thead>
    `;

    const tbody = rows.map(r=>{
          const isTotal  = r.__rowType === 'total';
          const isSingle = r.__rowType === 'single';
          const showCalc = isTotal || isSingle;
          const difTxt   = showCalc ? ((r.dif>=0?'+':'') + fmtBRL(r.dif)) : '—';
          const difCls   = showCalc ? (r.dif>0 ? 'red' : (r.dif<0 ? 'blue' : '')) : '';
          const idealTd  = showCalc ? fmtBRL(r.ideal) : '—';
          const statusTd = showCalc ? esc(r.status||'') : '';
          const vBrutaTd = showCalc ? fmtBRL(r.vBruta||0) : '—';
          const vLiqTd   = showCalc ? fmtBRL(r.vLiq  ||0) : '—';
          const trCls    = isTotal ? 'class="group-total"' : '';
    if (isCom){
      return `
        <tr ${trCls}>
          <td>${esc(r.rota)}</td>
          <td>${esc(r.ficha)}</td>
          <td>${esc(r.info)}</td>
          <td class="num">${fmtBRL(r.valorAj)}</td>
          <td class="num">${vBrutaTd}</td>
        </tr>
      `;
    }
    return `
      <tr ${trCls}>
        <td>${esc(r.rota)}</td>
        <td>${esc(r.ficha)}</td>
        <td>${esc(r.info)}</td>
        <td class="num">${fmtBRL(r.valorAj)}</td>
        <td class="num">${idealTd}</td>
        <td class="num ${difCls}">${difTxt}</td>
        <td>${statusTd}</td>
        <td class="num">${vBrutaTd}</td>
        <td class="num">${vLiqTd}</td>
      </tr>
    `;
  }).join('');

  const tfoot = isCom
    ? `
      <tfoot>
        <tr>
          <td colspan="3" class="num">Totais:</td>
          <td class="num">${fmtBRL(totais.ajuda)}</td>
          <td class="num">${fmtBRL(totais.bruta)}</td>
        </tr>
      </tfoot>
    `
    : `
      <tfoot>
        <tr>
          <td colspan="3" class="num">Totais:</td>
          <td class="num">${fmtBRL(totais.ajuda)}</td>
          <td class="num">—</td>
          <td class="num">—</td>
          <td> </td>
          <td class="num">${fmtBRL(totais.bruta)}</td>
          <td class="num">${fmtBRL(totais.liqui)}</td>
        </tr>
      </tfoot>
    `;

  return `
    <!doctype html><html><head><meta charset="utf-8">${css}</head>
    <body>
      ${head}
      <div class="tbl-wrap">
        <table>
          ${thead}
          <tbody>${tbody}</tbody>
          ${tfoot}
        </table>
      </div>
      <div class="no-print" style="padding:16px 20px;">
        <button onclick="window.print()" class="btn">Imprimir</button>
      </div>
    </body></html>
  `;
}

function __openPrint(html){
  const w = window.open('', '_blank');
  if (!w) { alert('Bloqueador de pop-up ativo. Libere pop-ups para imprimir.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
   w.print(); 
}

// Imprimir tabela (gerente)
// ——— UNIFICADO: Tabela do Gerente (totais por ficha)
document.getElementById('btnPrintGerente')?.addEventListener('click', ()=>{
  const base = __getDespesasParaImprimir(); if (!base) return;
  const rows = __mapDespPrintRows_groupedWithTotals(base.arr);
  if (rows.length === 0){ alert('Nada para imprimir para este gerente no período selecionado.'); return; }

  const titulo = base.gerenteSel || '—';
  const sub = `Despesas — Cálculo Vendedores<br>` + 
             `Período ${ fmtDMY(base.de) } a ${ fmtDMY(base.ate) }`;
  const html = __buildPrintHTML({ titulo, sub, rows, modo:'gerente' }); 
  __openPrint(html);
});

// ——— UNIFICADO: Tabela para Comissão (totais por ficha)
document.getElementById('btnPrintComissao')?.addEventListener('click', ()=>{
  const base = __getDespesasParaImprimir(); if (!base) return;
  const rows = __mapDespPrintRows_groupedWithTotals(base.arr);
  if (rows.length === 0){ alert('Nada para imprimir para este gerente no período selecionado.'); return; }

  const titulo = base.gerenteSel || '—';
  const sub = `Despesas para Comissão<br>` + 
             `Período ${ fmtDMY(base.de) } a ${ fmtDMY(base.ate) }`;  
  const html = __buildPrintHTML({ titulo, sub, rows, modo:'comissao' }); // usa colunas reduzidas (Valor Ajuda + Bruta)
  __openPrint(html);
});

function fmtDMY(iso){
  if (!iso || iso === '0000-00-00') return '—';
  const [y,m,d] = String(iso).split('-');
  if (!y || !m || !d) return '—';
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
}

function __getDespesas(){
  try { if (typeof despesas !== 'undefined' && Array.isArray(despesas)) return despesas; } catch(_) {}
  return Array.isArray(window.despesas) ? window.despesas : [];
}
function __setDespesas(novo){
  try { if (typeof despesas !== 'undefined') { despesas = novo; return; } } catch(_) {}
  window.despesas = novo;
  try {
       if (typeof DB_DESPESAS !== 'undefined') {
         localStorage.setItem(DB_DESPESAS, JSON.stringify(novo));
       }
     } catch(e){}
    }

function ensureSelect(id, placeholder){
  const el = document.getElementById(id);
  if (!el) return null;
  if (el.tagName?.toLowerCase() === 'select') return el;

  const sel = document.createElement('select');
  sel.id = id;
  sel.className = el.className || '';
  sel.style.cssText = el.style?.cssText || '';
  el.replaceWith(sel);
  return sel;
}


// ============================================
// ✅ EVENT LISTENERS PARA MENU DROPDOWN
// ============================================

// 1️⃣ Abrir/Fechar Menu Dropdown "Opções"
if (!window.__despDropdownBound) {
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-desp-dd-toggle]');
    
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      
      const dropdown = toggle.closest('[data-desp-dd]');
      const menu = dropdown?.querySelector('[data-desp-dd-menu]');
      
      if (menu) {
        const isOpen = menu.classList.contains('show');
        
        // Fecha todos os menus abertos
        document.querySelectorAll('[data-desp-dd-menu].show').forEach(m => {
          m.classList.remove('show');
          const btn = m.closest('[data-desp-dd]')?.querySelector('[data-desp-dd-toggle]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
        
        // Abre/fecha o menu clicado
        if (!isOpen) {
          menu.classList.add('show');
          toggle.setAttribute('aria-expanded', 'true');
        }
      }
      return;
    }
    
    // Fecha menus ao clicar fora
    if (!e.target.closest('[data-desp-dd]')) {
      document.querySelectorAll('[data-desp-dd-menu].show').forEach(m => {
        m.classList.remove('show');
        const btn = m.closest('[data-desp-dd]')?.querySelector('[data-desp-dd-toggle]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
  }, true);
  
  window.__despDropdownBound = true;
}

// 2️⃣ Processar Ações do Menu (Toggle Hide, Editar, Excluir)
if (!window.__despMenuActionsBound) {
  document.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-desp-act]');
    if (!actionBtn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const action = actionBtn.getAttribute('data-desp-act');
    const id = actionBtn.getAttribute('data-id');
    
    // Fecha o menu
    const menu = actionBtn.closest('[data-desp-dd-menu]');
    if (menu) {
      menu.classList.remove('show');
      const btn = menu.closest('[data-desp-dd]')?.querySelector('[data-desp-dd-toggle]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    
    const arr = __getDespesas();
    const idx = arr.findIndex(x => String(x.id) === String(id) || String(x.uid) === String(id));
    
    if (idx === -1) {
      alert('Despesa não encontrada.');
      return;
    }
    
    // TOGGLE HIDE
    if (action === 'toggle-hide') {
      arr[idx].isHidden = !arr[idx].isHidden;
      __setDespesas(arr);
      await saveDespesa(arr[idx]);
      renderDespesas();
    }
    
    // EDITAR
    else if (action === 'editar') {
      console.log('[Despesas] Editar:', arr[idx]);
      alert('Função de editar em desenvolvimento.');
      // TODO: Implementar modal de edição
    }
    
    // EXCLUIR
    else if (action === 'excluir') {
      if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
      
      try {
        const uid = arr[idx].uid || arr[idx].id;
        
        // Remove do array local
        const novo = arr.filter(x => String(x.id) !== String(id) && String(x.uid) !== String(id));
        __setDespesas(novo);
        
        // Remove do Supabase
        await window.SupabaseAPI.despesas.deleteByUid(uid);
        
        alert('Despesa excluída com sucesso!');
        renderDespesas();
      } catch (error) {
        console.error('[Despesas] Erro ao excluir:', error);
        alert('Erro ao excluir despesa: ' + error.message);
      }
    }
  }, true);
  
  window.__despMenuActionsBound = true;
}


// Delegação global para expandir/contrair grupos (não depende do render)
if (!window.__despInlineGroupBound) {
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-inline-toggle]');
    if (!btn) return;

    e.preventDefault();

    const groupId = btn.getAttribute('data-inline-toggle');
    const open = btn.getAttribute('aria-expanded') === 'true';

    document.querySelectorAll(`.tr-det[data-parent="${groupId}"]`)
      .forEach(tr => tr.style.display = open ? 'none' : 'table-row');

    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.textContent = open ? '+ detalhes' : '- detalhes';
  }, true);
  window.__despInlineGroupBound = true;
}

// Ações admin: Ocultar/Desocultar e Excluir (botões antigos - manter compatibilidade)
if (!window.__despAdminActionsBound) {
  document.addEventListener('click', async (e)=>{
    // Toggle ocultar/desocultar
    const hideBtn = e.target.closest('button[data-toggle-hide]');
    if (hideBtn) {
      e.preventDefault();
      e.stopPropagation();

      const id  = hideBtn.getAttribute('data-toggle-hide');
      const arr = __getDespesas();
      const idx = arr.findIndex(x => String(x.id) === String(id));

      if (idx === -1) {
        console.warn('[DESPESAS] id não encontrado para ocultar:', id, arr.map(x=>x.id));
        alert('Não foi possível localizar esta despesa para ocultar/exibir.');
        return;
      }

      arr[idx].isHidden = !arr[idx].isHidden;
      __setDespesas(arr);
      await saveDespesa(arr[idx]);
      renderDespesas();
      return;
    }

    // Excluir
    const delBtn = e.target.closest('button[data-del-desp]');
    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();

      const id  = delBtn.getAttribute('data-del-desp');
      if (!confirm('Excluir despesa?')) return;

      const arr  = __getDespesas();
      const idx = arr.findIndex(x => String(x.id) === String(id));

      if (idx === -1) {
        console.warn('[DESPESAS] id não encontrado para excluir:', id, arr.map(x=>x.id));
        alert('Não foi possível localizar esta despesa para excluir.');
        return;
      }

      try {
        const uid = arr[idx].uid || arr[idx].id;
        
        // Remove do array
        const novo = arr.filter(x => String(x.id) !== String(id));
        __setDespesas(novo);
        
        // Remove do Supabase
        await window.SupabaseAPI.despesas.deleteByUid(uid);
        
        renderDespesas();
      } catch (error) {
        console.error('[DESPESAS] Erro ao excluir:', error);
        alert('Erro ao excluir: ' + error.message);
      }
    }
  }, true);
  window.__despAdminActionsBound = true;
}
// ====== Modo seleção de ocultar por grupo (Total Despesas) ======
if (!window.__despGroupHideBound) {
  // guarda grupos que estão em "modo seleção"
  const selMode = new Set();

  // cria (ou retorna) o mini-painel de ações logo abaixo da linha do grupo
  function ensurePanel(groupId){
    // se já existir, retorna
    let row = document.querySelector(`tr[data-ocultar-panel="${groupId}"]`);
    if (row) return row;

    // acha a linha do grupo
    const grp = document.querySelector(`tr[data-group="${groupId}"]`);
    if (!grp) return null;

    // monta uma linha que ocupa a tabela toda (colspan = nº de colunas do thead)
    const colCount = grp.closest('table')?.querySelectorAll('thead th').length || 12;
    row = document.createElement('tr');
    row.setAttribute('data-ocultar-panel', groupId);
    row.innerHTML = `
      <td colspan="${colCount}" style="background:#f9fafb; padding:8px 12px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <strong>Selecionar despesas para ocultar</strong>
          <button type="button" class="btn sm" data-ocultar-aplicar="${groupId}">Aplicar</button>
          <button type="button" class="btn ghost sm" data-ocultar-cancel="${groupId}">Cancelar</button>
          <button type="button" class="btn ghost sm" data-ocultar-all="${groupId}">Selecionar todos</button>
          <small style="color:#6b7280">Marque as caixas “ocultar” nas linhas abaixo e clique em Aplicar.</small>
        </div>
      </td>
    `;
    grp.insertAdjacentElement('afterend', row);
    return row;
  }

  // garante que as linhas-filhas estejam expandidas
  function expandDetails(groupId){
    const btn = document.querySelector(`[data-inline-toggle="${groupId}"]`);
    if (btn && btn.getAttribute('aria-expanded') !== 'true'){
      // simula clique do "+ detalhes"
      btn.click();
    }
  }

  // entra/saí do modo seleção para um grupo
  function setSelectionMode(groupId, on){
    const checkLabels = document.querySelectorAll(`.tr-det[data-parent="${groupId}"] label.sel-hide`);
    checkLabels.forEach(lab => lab.classList.toggle('hidden', !on));
    if (on) {
      selMode.add(groupId);
      ensurePanel(groupId)?.classList.remove('hidden');
      expandDetails(groupId);
    } else {
      selMode.delete(groupId);
      document.querySelector(`tr[data-ocultar-panel="${groupId}"]`)?.classList.add('hidden');
      // desmarca tudo
      document.querySelectorAll(`input[type="checkbox"][data-sel-group="${groupId}"]`)
        .forEach(chk => chk.checked = false);
    }
  }

  document.addEventListener('click', async (e)=>{
    // 3.1 — Entrar no modo seleção
    const btnGroup = e.target.closest('[data-ocultar-grupo]');
    if (btnGroup){
      e.preventDefault();
      const groupId = btnGroup.getAttribute('data-ocultar-grupo');
      const isOn = selMode.has(groupId);
      setSelectionMode(groupId, !isOn);
      return;
    }

    // 3.2 — Selecionar todos
    const btnAll = e.target.closest('[data-ocultar-all]');
    if (btnAll){
      e.preventDefault();
      const groupId = btnAll.getAttribute('data-ocultar-all');
      const checks = document.querySelectorAll(`input[type="checkbox"][data-sel-group="${groupId}"]`);
      const allChecked = [...checks].every(c => c.checked);
      checks.forEach(c => c.checked = !allChecked);
      return;
    }

    // 3.3 — Cancelar (sai do modo)
    const btnCancel = e.target.closest('[data-ocultar-cancel]');
    if (btnCancel){
      e.preventDefault();
      const groupId = btnCancel.getAttribute('data-ocultar-cancel');
      setSelectionMode(groupId, false);
      return;
    }

    // 3.4 — Aplicar (marca isHidden=true nas selecionadas)
    const btnApply = e.target.closest('[data-ocultar-aplicar]');
    if (btnApply){
      e.preventDefault();
      const groupId = btnApply.getAttribute('data-ocultar-aplicar');
      const ids = [...document.querySelectorAll(`input[type="checkbox"][data-sel-group="${groupId}"]:checked`)]
                    .map(chk => chk.getAttribute('data-sel-id'));

      if (ids.length === 0){
        alert('Nenhuma despesa selecionada.');
        return;
      }

      const arr = __getDespesas();
      let changed = 0;
      
      for (const id of ids) {
        const i = arr.findIndex(x => String(x.id) === String(id));
        if (i > -1 && !arr[i].isHidden) { 
          arr[i].isHidden = true; 
          changed++;
          
          // Salva no Supabase
          try {
            await saveDespesa(arr[i]);
          } catch (error) {
            console.error('[Despesas] Erro ao ocultar:', error);
          }
        }
      }

      if (changed > 0){
        __setDespesas(arr);
      }

      // re-render e volta ao modo normal
      renderDespesas();
      setTimeout(()=> setSelectionMode(groupId, false), 0);
    }
  }, true);

  window.__despGroupHideBound = true;
}

['despDe','despAte'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change', ()=>{
    buildDespesasFilterOptions();
    renderDespesas();
  });
});

// Event listeners para filtros
['despBuscaGerente', 'despBuscaFicha', 'despBuscaRota'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderDespesas);
});

document.getElementById('despMostrarOcultas')?.addEventListener('change', ()=>{
  renderDespesas();
});

document.addEventListener('DOMContentLoaded', () => {
  const tbl = document.querySelector('#pageDespesas table');
  if (tbl && tbl.parentElement) {
    tbl.parentElement.classList.add('desp-table-wrap');
  }
  
  buildDespesasFilterOptions();
  renderDespesas();
});

// ============================================
// FORÇAR RENDERIZAÇÃO AO ABRIR PÁGINA DESPESAS
// ============================================
(function observarPaginaDespesas() {
  // Observer para detectar quando página despesas fica visível
  const observer = new MutationObserver(() => {
    const pageDespesas = document.getElementById('pageDespesas');
    if (pageDespesas && pageDespesas.style.display !== 'none') {
      console.log('[Despesas] 👁️ Página visível, renderizando...');
      
      if (typeof buildDespesasFilterOptions === 'function') {
        buildDespesasFilterOptions();
      }
      
      if (typeof renderDespesas === 'function') {
        renderDespesas();
      }
    }
  });
  
  // Observar mudanças no body
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  // Também escutar hash changes (se usa navegação por hash)
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#despesas') {
      console.log('[Despesas] 🔗 Navegou para #despesas');
      setTimeout(() => {
        if (typeof buildDespesasFilterOptions === 'function') {
          buildDespesasFilterOptions();
        }
        if (typeof renderDespesas === 'function') {
          renderDespesas();
        }
      }, 100);
    }
  });
  
  // Escutar evento customizado de navegação (se existir)
  document.addEventListener('page:change', (e) => {
    if (e.detail?.page === 'despesas') {
      console.log('[Despesas] 📄 Evento page:change para despesas');
      setTimeout(() => {
        if (typeof buildDespesasFilterOptions === 'function') {
          buildDespesasFilterOptions();
        }
        if (typeof renderDespesas === 'function') {
          renderDespesas();
        }
      }, 100);
    }
  });
  
  console.log('[Despesas] 👁️ Observer de página ativado');
})();