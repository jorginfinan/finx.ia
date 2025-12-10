// ==== FINANCEIRO (versão enxuta com delegação única) ====
/* === Persistência forte do Financeiro (autossalvar + travar window.lanc) === */
// ===== VERIFICAÇÃO E AGUARDO DE DEPENDÊNCIAS =====
(function waitForDeps() {
  const required = ['esc', 'uid', 'jget', 'jset'];
  const missing = required.filter(fn => typeof window[fn] === 'undefined');
  
  if (missing.length > 0) {
    console.warn('[Financeiro] Aguardando dependências:', missing.join(', '));
    setTimeout(waitForDeps, 100);
    return;
  }
  
  console.log('[Financeiro] ✅ Dependências OK, carregando módulo...');
  
  // Continua com o carregamento do módulo
  initFinanceiro();
})();

function initFinanceiro() {

(function persistFin(){
  const LS_KEY = 'bsx_fin_lanc';

  const load = () => {
    // Carrega do localStorage inicialmente (síncrono)
    // O Supabase será carregado depois de forma assíncrona
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }
    catch { return []; }
  };

  const persist = (arr) => {
    try {
      const json = JSON.stringify(arr || []);
      // chave oficial
      localStorage.setItem('bsx_fin_lanc', json);
      // espelho (legado)
      localStorage.setItem('lanc', json);
      // 🔧 backup SEMPRE igual ao estado atual (mesmo vazio)
      localStorage.setItem('bsx_fin_lanc_bak', json);
    } catch(_) {}
  };

  // ===== FUNÇÕES DE PERMISSÃO =====
window.canEditLanc = window.canEditLanc || function() {
  try {
    if (window.currentUser?.isAdmin) return true;
    if (window.IS_ADMIN) return true;
    // Adicione outras verificações de permissão aqui
    return true; // temporário: permite edição para todos
  } catch(_) {
    return true; // fallback seguro
  }
};

window.canDeleteLanc = window.canDeleteLanc || function() {
  try {
    if (window.currentUser?.isAdmin) return true;
    if (window.IS_ADMIN) return true;
    return false; // apenas admin pode deletar
  } catch(_) {
    return false;
  }
};

// ===== FUNÇÃO PARA CARREGAR DADOS DO FINANCEIRO =====
window.getFinanceiro = window.getFinanceiro || function() {
  return window.lanc || [];
};
  
// Se (e só se) a chave estiver ausente/corrompida, restaura.
// Vazio [] é um estado válido e NÃO deve restaurar.
(function finSelfHeal(){
  try{
    const curRaw = localStorage.getItem('bsx_fin_lanc');
    let cur = null, parseOk = true;
    if (curRaw != null) {
      try { cur = JSON.parse(curRaw); } catch(_) { parseOk = false; }
    }

    const precisaRestaurar = (curRaw == null) || !parseOk || (!Array.isArray(cur) && curRaw !== '[]');

    if (precisaRestaurar) {
      const mirrorRaw = localStorage.getItem('lanc');
      const bakRaw    = localStorage.getItem('bsx_fin_lanc_bak');
      const mirror = mirrorRaw ? JSON.parse(mirrorRaw) : null;
      const bak    = bakRaw    ? JSON.parse(bakRaw)    : null;
      const toUse  = Array.isArray(mirror) ? mirror
                    : Array.isArray(bak)    ? bak
                    : [];
      localStorage.setItem('bsx_fin_lanc', JSON.stringify(toUse));
    }
  }catch(_){}
})();

  

  // array “real” usado pelo proxy
  const backing = load();

  // proxy que salva a cada mudança (indices, length, etc.)
  const prox = new Proxy(backing, {
    set(target, prop, value){
      target[prop] = value;
      persist(target);
      return true;
    },
    deleteProperty(target, prop){
      delete target[prop];
      persist(target);
      return true;
    }
  });


  window.saveLanc = function () {
    try {
      const arr = Array.isArray(window.lanc) ? window.lanc : [];
      const json = JSON.stringify(arr);
      // Mantém localStorage como backup
      localStorage.setItem('bsx_fin_lanc', json);
      localStorage.setItem('lanc', json);
      if (arr.length) localStorage.setItem('bsx_fin_lanc_bak', json);
    } catch (_) {}
  };

})();

// ===== Fonte ÚNICA dos lançamentos do Financeiro =====
(function fixLancSource(){
  // carrega do localStorage se existir
  if (!Array.isArray(window.lanc)) {
    try{
      const cache = JSON.parse(localStorage.getItem('bsx_fin_lanc') || '[]');
      window.lanc = Array.isArray(cache) ? cache : [];
    } catch(_){ window.lanc = []; }
  }
  if (typeof lanc !== 'undefined' && Array.isArray(lanc) && lanc !== window.lanc
       && ((window.lanc?.length || 0) === 0)) {
     window.lanc = lanc;
   }
  // função de salvar
  window.saveLanc = window.saveLanc || function(){
    try {
      localStorage.setItem('bsx_fin_lanc', JSON.stringify(window.lanc)); // chave oficial
      // 🔔 Notifica sincronização (sem depender de novoLanc)
      if (typeof window.SyncManager !== 'undefined') {
        window.SyncManager.notify('financeiro', { changed: true });
      }
    } catch(_) {}
  };


})();

/* ===== Bootstrap Financeiro ===== */
window.sortState = window.sortState || { key: 'data', dir: 'desc' };

if (!Array.isArray(window.lanc)) {
  try {
    const cache = JSON.parse(localStorage.getItem('bsx_fin_lanc') || '[]');
    window.lanc = Array.isArray(cache) ? cache : [];
  } catch (_) {
    window.lanc = [];
  }
}
window.saveLanc = window.saveLanc || function () {
  try { localStorage.setItem('bsx_fin_lanc', JSON.stringify(window.lanc)); } catch(_) {}
};

/* dá uid a quem não tem (1x) */
(function ensureUids(){
  let changed = false;
  window.lanc.forEach(r=>{
    if (!r.uid) { r.uid = r.id || r.key || (crypto?.randomUUID?.() || String(Date.now()+Math.random())); changed = true; }
  });
  if (changed) window.saveLanc?.();
})();



// === Utils extras ===
const LSK_FIN_SORT   = 'bsx_fin_sort_v1';
const LSK_FIN_FILTER = 'bsx_fin_filter_v1';

// ===== FUNÇÃO PARA RECARREGAR DO SUPABASE =====
window.carregarFinanceiroSupabase = async function() {
  try {
    if (window.SupabaseAPI?.lancamentos) {
      const data = await window.SupabaseAPI.lancamentos.getAll();
      if (Array.isArray(data)) {
        window.lanc = data;
        try {
          localStorage.setItem('bsx_fin_lanc', JSON.stringify(data));
          localStorage.setItem('lanc', JSON.stringify(data));
        } catch(_) {}
        window.renderFin?.();
        console.log('[Financeiro] ✅ Recarregado do Supabase:', data.length);
        return data;
      }
    }
  } catch(e) {
    console.error('[Financeiro] Erro ao recarregar:', e);
  }
  return window.lanc || [];
};
// === Helpers globais de UID (deixe no ESCOPO GLOBAL)
// ===== Helpers globais e robustos para UID =====
window.__fin_getUidFromClick = function(el){
  if (!el) return '';
  return el.dataset.id || el.dataset.edit || el.dataset.del || el.closest('tr')?.dataset?.uid || '';
};

window.__fin_findByUid = function(uid){
  const arr = window.lanc || [];
  let idx = arr.findIndex(x => String(x.uid) === String(uid));
  if (idx < 0) idx = arr.findIndex(x => String(x.id)  === String(uid));
  if (idx < 0) idx = arr.findIndex(x => String(x.key) === String(uid));
  return { idx, row: idx >= 0 ? arr[idx] : null };
};
// Procura o registro pelo conteúdo da <tr> quando o uid não bate
window.__fin_guessByRowEl = function(el){
  const tr = el && el.closest ? el.closest('tr') : null;
  if (!tr) return { idx:-1, row:null };

  const tds = tr.querySelectorAll('td');
  const gerente   = (tds[0]?.innerText || '').trim();
  const valorNum  = (()=> {
    const s = (tds[1]?.innerText || '').replace(/[^\d,,-]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(s); return isFinite(n) ? n : 0;
  })();
  const status    = /RECEBIDO|PAGO/.exec(tds[2]?.innerText || '')?.[0] || '';
  const forma     = (tds[3]?.innerText || '').trim();
  const categoria = (tds[4]?.innerText || '').trim();
  const dataIso   = ((tds[5]?.innerText || '').trim().split('/').reverse().join('-')) || '';

  const arr = window.lanc || [];
  for (let i=0; i<arr.length; i++){
    const r = arr[i] || {};
    const rData = (r.data || '').slice(0,10);
    if (
      String((r.gerente||'').trim()) === gerente &&
      Math.abs(Number(r.valor||0) - valorNum) < 0.005 &&
      String(r.status||'') === status &&
      String(r.forma||'') === forma &&
      String(r.categoria||'') === categoria &&
      String(rData) === dataIso
    ){
      return { idx:i, row:r };
    }
  }
  return { idx:-1, row:null };
};


// ====== Abrir modal de edição (versão corrigida) ======
window.__fin_openDialog = function(src){
  const dlg  = document.getElementById('dlgLanc');
  const form = document.getElementById('formLanc');
  if (!dlg || !form) {
    console.error('Dialog ou formulário não encontrado');
    return;
  }

  let uid = '';
  let row = null;
  
  if (typeof src === 'string') {
    uid = src;
  } else if (src && src.nodeType === 1) {
    uid = window.__fin_getUidFromClick(src);
  }
  
  if (uid) {
    const result = window.__fin_findByUid(uid);
    row = result.row;
    
    if (!row && src && src.nodeType === 1) {
      const guess = window.__fin_guessByRowEl(src);
      row = guess.row;
    }
  }

  if (row) {
    dlg.setAttribute('data-editing', row.uid || row.id || row.key || uid);
    
    // Preenche o formulário
    if (form.gerente) form.gerente.value = row.gerente || '';
    if (form.valor) {
      const valorStr = row.valor != null ? String(row.valor).replace('.', ',') : '';
      form.valor.value = valorStr;
    }
    if (form.status) form.status.value = row.status || 'RECEBIDO';
    if (form.forma) form.forma.value = row.forma || 'PIX';
    if (form.categoria) form.categoria.value = row.categoria || '';
    if (form.data) {
      const dataVal = row.data || new Date().toISOString().slice(0,10);
      form.data.value = dataVal;
    }
  } else {
    // Novo lançamento
    dlg.removeAttribute('data-editing');
    form.reset();
    const dataInput = form.querySelector('[name="data"]');
    if (dataInput) {
      dataInput.value = new Date().toISOString().slice(0,10);
    }
  }

  // Abre o diálogo
  if (typeof dlg.showModal === 'function') {
    dlg.showModal();
  } else {
    dlg.setAttribute('open', 'open');
    dlg.style.display = 'block';
  }
};


// ====== Salvar (edita por uid/id/key de forma segura) ======
window.__fin_saveFromForm = async function(){
  const dlg  = document.getElementById('dlgLanc');
  const form = document.getElementById('formLanc');
  const btn  = document.getElementById('salvarLanc');

  if (btn?.dataset.busy === '1') return;
  if (btn) btn.dataset.busy = '1';

  const f   = new FormData(form);
  let valor = String(f.get('valor')||'').trim();
  if (valor.includes(',')) valor = valor.replace(/\./g,'').replace(',','.');

  const toIso = (typeof toISO==='function') ? toISO : (d)=>d;

  const reg = {
    gerente:   String(f.get('gerente')||'').trim(),
    valor:     parseFloat(valor||'0'),
    status:    f.get('status'),
    forma:     f.get('forma'),
    categoria: String(f.get('categoria')||'').trim(),
    data:      toIso(f.get('data'))
  };
  if (!reg.gerente || !reg.data || isNaN(reg.valor)){
    alert('Preencha os campos corretamente.');
    if (btn) btn.dataset.busy = '0';
    return;
  }

  const editing = dlg.getAttribute('data-editing');

  if (editing){
    if (!canEditLanc()){ alert('Você não tem permissão para editar.'); if (btn) btn.dataset.busy='0'; return; }
    const { idx, row } = window.__fin_findByUid(editing);
    if (idx > -1){
      // ✅ Atualiza no Supabase
      if (window.SupabaseAPI?.lancamentos) {
        try {
          await window.SupabaseAPI.lancamentos.update(editing, reg);
        } catch(e) {
          console.error('[Financeiro] Erro ao atualizar no Supabase:', e);
        }
      }
      window.lanc[idx] = {
        ...(row||{}),
        ...reg,
        uid: row?.uid || row?.id || row?.key || editing,
        editedAt: new Date().toISOString(),
        editedBy: (window.UserAuth?.currentUser()?.username || 'Usuário')
      };
      
      // ✅ AUDITORIA - Lançamento editado
      if (typeof window.AuditLog !== 'undefined' && typeof window.AuditLog.log === 'function') {
        window.AuditLog.log('lancamento_editado', {
          id: window.lanc[idx].uid,
          gerente: reg.gerente,
          valor: reg.valor
        });
      }
    }
    dlg.removeAttribute('data-editing');
  } else {
    if (!Array.isArray(window.lanc)) window.lanc = [];
    const newId = (typeof uid === 'function' ? uid()
                    : (crypto?.randomUUID?.() || String(Date.now())));
    window.lanc.push({ uid: newId, ...reg });
    // ✅ Cria no Supabase
    if (window.SupabaseAPI?.lancamentos) {
      try {
        await window.SupabaseAPI.lancamentos.create({ uid: newId, ...reg });
      } catch(e) {
        console.error('[Financeiro] Erro ao criar no Supabase:', e);
      }
    }
    
    // ✅ AUDITORIA - Lançamento criado
    if (typeof window.AuditLog !== 'undefined' && typeof window.AuditLog.log === 'function') {
      window.AuditLog.log('lancamento_criado', {
        id: newId,
        gerente: reg.gerente,
        valor: reg.valor
      });
    }
  }
  

  window.saveLanc?.();
  if (typeof dlg.close==='function') dlg.close(); else { dlg.removeAttribute('open'); dlg.style.display=''; }
  window.renderFin?.();
  if (btn) btn.dataset.busy = '0';
};

// ====== Excluir robusto (procura por uid/id/key) ======
window.__fin_deleteRow = async function(uid, el){
  const key = uid || '';
  if (!key) return;
  if (!canDeleteLanc()) { alert('Apenas ADMIN pode deletar.'); return; }
  if (!confirm('Deletar este lançamento?')) return;

  let { idx } = window.__fin_findByUid(key);
  if (idx === -1 && el && el.nodeType === 1){
    const g = window.__fin_guessByRowEl(el);
    idx = g.idx;
  }
  if (idx === -1) { alert('Registro não encontrado.'); return; }

  // garante uid estável daqui pra frente
  if (!window.lanc[idx].uid){
    window.lanc[idx].uid = window.lanc[idx].id || window.lanc[idx].key || (crypto?.randomUUID?.() || String(Date.now()));
    window.saveLanc?.();
  }

  // Salva dados para auditoria antes de excluir
  const lancExcluido = window.lanc[idx];

  // ✅ Deleta do Supabase
  const uidToDelete = window.lanc[idx]?.uid || window.lanc[idx]?.id || key;
  if (window.SupabaseAPI?.lancamentos) {
    try {
      await window.SupabaseAPI.lancamentos.delete(uidToDelete);
    } catch(e) {
      console.error('[Financeiro] Erro ao deletar do Supabase:', e);
    }
  }
  window.lanc.splice(idx, 1);
  window.saveLanc?.();
  window.renderFin?.();
  
  // ✅ AUDITORIA - Lançamento excluído
  if (typeof window.AuditLog !== 'undefined') {
    window.AuditLog.log('lancamento_excluido', {
      id: lancExcluido.uid,
      tipo: lancExcluido.tipo,
      gerente: lancExcluido.gerente,
      valor: lancExcluido.valor
    });
  }
};



function normalize(str){
  return (str||'')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // tira acento
    .toLowerCase().trim();
}
function numSafe(x){ const n = Number(x); return isFinite(n) ? n : 0; }

function debounce(fn, wait=180){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

// carrega/persiste sortState (assumindo sortState global já exista)
(function(){
  try{
    const saved = JSON.parse(localStorage.getItem(LSK_FIN_SORT)||'null');
    if(saved && saved.key && saved.dir) sortState = saved;
  }catch(e){}
})();
function saveSortState(){ try{ localStorage.setItem(LSK_FIN_SORT, JSON.stringify(sortState)); }catch(e){} }

// filtros (persistência opcional)
function saveFilters(){
  const payload = {
    mes:    document.getElementById('mes')?.value || '',
    ano:    document.getElementById('ano')?.value || '',
    status: document.getElementById('status')?.value || '',
    forma:  document.getElementById('forma')?.value || '',
    busca:  document.getElementById('busca')?.value || '',
    de:     document.getElementById('dataDe')?.value || '',
    ate:    document.getElementById('dataAte')?.value || ''
  };
  try{ localStorage.setItem(LSK_FIN_FILTER, JSON.stringify(payload)); }catch(e){}
}
function loadFilters(){
  try{
    const v = JSON.parse(localStorage.getItem(LSK_FIN_FILTER)||'null');
    if(!v) return;
    const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = val||''; };
    set('mes',v.mes); set('ano',v.ano); set('status',v.status); set('forma',v.forma);
    set('busca',v.busca); set('dataDe',v.de); set('dataAte',v.ate);
  }catch(e){}
}

// aplica filtros atuais
function applyFilters(rows){
  const mes    = (document.getElementById('mes')?.value||'').trim();
  const ano    = (document.getElementById('ano')?.value||'').trim();
  const status = (document.getElementById('status')?.value||'').trim();
  const forma  = (document.getElementById('forma')?.value||'').trim();
  const buscaI = normalize(document.getElementById('busca')?.value||'');
  const de     = (document.getElementById('dataDe')?.value||'').trim();   // YYYY-MM-DD
  const ate    = (document.getElementById('dataAte')?.value||'').trim();  // YYYY-MM-DD

  return (rows||[]).filter(r=>{
    const d  = (r.data||'').slice(0,10);         // garantir YYYY-MM-DD
    const yy = d ? d.slice(0,4) : '';
    const mm = d ? d.slice(5,7) : '';

    if (mes && parseInt(mm||'0',10) !== parseInt(mes,10)) return false;
    if (ano && yy !== String(ano)) return false;

    if (status && (r.status||'') !== status) return false;
    if (forma  && (r.forma ||'') !== forma ) return false;

    if (de  && d && d < de)  return false;  // inclusivo no >= de
    if (ate && d && d > ate) return false;  // inclusivo no <= ate

    if (buscaI){
      const hay = [ r.gerente, r.categoria, r.forma, r.status ]
        .map(normalize).join(' ');
      if (!hay.includes(buscaI)) return false;
    }
    return true;
  });
}

// ordenação
function sortRows(rows){
  const {key,dir} = sortState || {key:'data', dir:'desc'};
  const asc = dir === 'asc';
  const arr = (rows||[]).slice();

  return arr.sort((a,b)=>{
    const va = a?.[key]; const vb = b?.[key];
    if (key === 'valor') {
      return asc ? numSafe(va)-numSafe(vb) : numSafe(vb)-numSafe(va);
    }
    if (key === 'data') {
      const da = (a?.data||''); const db = (b?.data||'');
      return asc ? da.localeCompare(db) : db.localeCompare(da);
    }
    const sa = String(va??''); const sb = String(vb??'');
    return asc ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

// ===== RENDER PRINCIPAL DO FINANCEIRO =====
function renderFin() {
  const tbody = document.getElementById('tbody');
  if (!tbody) {
    console.warn('tbody não encontrado');
    return;
  }
  
  try {
    // Garante que lanc existe
    if (!Array.isArray(window.lanc)) {
      window.lanc = [];
    }
    
    // Aplica filtros e ordenação
    let filtered = applyFilters(window.lanc);
    filtered = sortRows(filtered);
    
    // Calcula totais
    let totalRecebimentos = 0;
    let totalPagamentos = 0;
    
    filtered.forEach(function(item) {
      const valor = parseFloat(item.valor) || 0;
      if (item.status === 'RECEBIDO') {
        totalRecebimentos += valor;
      } else if (item.status === 'PAGO') {
        totalPagamentos += valor;
      }
    });
    
    const saldo = totalRecebimentos - totalPagamentos;
    
    // Atualiza totais na UI
    const elTotalRec = document.getElementById('totalRecebimentos');
    const elTotalPag = document.getElementById('totalPagamentos');
    const elSaldo = document.getElementById('saldo');
    
    if (elTotalRec) elTotalRec.textContent = fmtBRL(totalRecebimentos);
    if (elTotalPag) elTotalPag.textContent = fmtBRL(totalPagamentos);
    if (elSaldo) elSaldo.textContent = fmtBRL(saldo);
    
    // Renderiza linhas
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">Nenhum lançamento encontrado.</td></tr>';
      return;
    }
    
    const rows = filtered.map(function(item) {
      const uid = item.uid || item.id || item.key || '';
      const data = (item.data || '').split('-').reverse().join('/');
      
      // Ícone de edição se o item foi editado
      let editIcon = '';
      if (item.editedAt) {
        const editDate = new Date(item.editedAt);
        const dateStr = editDate.toLocaleDateString('pt-BR');
        const timeStr = editDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const tooltip = 'Editado por: ' + (item.editedBy || 'Usuário') + '\\nEm: ' + dateStr + ' às ' + timeStr;
        editIcon = ' <span class="edit-icon" title="' + esc(tooltip) + '" style="cursor:help;font-size:0.85em;opacity:0.7;">✏️</span>';
      }
      
      return '<tr data-uid="' + uid + '" data-context="financeiro">' +
        '<td>' + esc(item.gerente || '') + '</td>' +
        '<td style="text-align:right">' + fmtBRL(item.valor) + editIcon + '</td>' +
        '<td>' + esc(item.status || '') + '</td>' +
        '<td>' + esc(item.forma || '') + '</td>' +
        '<td>' + esc(item.categoria || '') + '</td>' +
        '<td>' + data + '</td>' +
        '<td class="fin-actions" style="white-space:nowrap">' +
          '<button class="btn sm" data-edit="' + uid + '" data-context="financeiro">Editar</button> ' +
          '<button class="btn danger sm" data-del="' + uid + '" data-context="financeiro">Excluir</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    
    tbody.innerHTML = rows;
    
  } catch(error) {
    console.error('Erro em renderFin:', error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:red">Erro ao carregar dados</td></tr>';
  }
}

// Expor globalmente
window.renderFin = renderFin;

// Helper para carregar mais linhas
function loadMoreRows(data, startIndex) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  
  const fragment = document.createDocumentFragment();
  const nextBatch = data.slice(startIndex, startIndex + 100);
  
  // Remove botão "Carregar mais" anterior (última linha)
  const lastRow = tbody.lastElementChild;
  if (lastRow && lastRow.querySelector('button')) {
    lastRow.remove();
  }
  
  // Renderiza próximo lote
  nextBatch.forEach(item => {
    const tr = createTableRow(item);
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
  
  // Adiciona novo botão se ainda há mais
  const nextIndex = startIndex + 100;
  if (nextIndex < data.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.style.textAlign = 'center';
    td.style.padding = '20px';
    
    const btnMore = document.createElement('button');
    btnMore.className = 'btn';
    btnMore.textContent = `Carregar mais (${data.length - nextIndex} restantes)`;
    btnMore.onclick = () => loadMoreRows(data, nextIndex);
    
    td.appendChild(btnMore);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

// Cria uma linha da tabela a partir de um item
function createTableRow(item) {
  const tr = document.createElement('tr');
  
  const cells = [
    item.gerente || '',
    formatMoney(item.valor),
    item.status || '',
    item.forma || '',
    item.categoria || '',
    formatDate(item.data)
  ];
  
  cells.forEach(content => {
    const td = document.createElement('td');
    td.textContent = content;
    tr.appendChild(td);
  });
  
  // Ações
  const tdActions = document.createElement('td');
  
  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn sm';
  btnEdit.textContent = 'Editar';
  btnEdit.onclick = () => editarLancamento(item.id);
  
  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger sm';
  btnDel.textContent = 'Excluir';
  btnDel.onclick = () => excluirLancamento(item.id);
  
  tdActions.appendChild(btnEdit);
  tdActions.appendChild(document.createTextNode(' '));
  tdActions.appendChild(btnDel);
  
  tr.appendChild(tdActions);
  
  return tr;
}

// Helpers
function formatMoney(value) {
  return 'R$ ' + (parseFloat(value) || 0)
    .toFixed(2)
    .replace('.', ',');
}
// ===== HELPER DE ESCAPE HTML =====
window.esc = window.esc || function(s) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(s ?? '').replace(/[&<>"']/g, function(m) { return map[m]; });
};

// ===== HELPER DE FORMATAÇÃO DE MOEDA =====
window.fmtBRL = window.fmtBRL || function(n) {
  const num = parseFloat(n) || 0;
  return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

function formatDate(date) {
  if (!date) return '';
  const [y, m, d] = String(date).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}



// ====================== FINANCEIRO: Confirmação de valores vindos de Prestações ======================

// ============================================
// PENDÊNCIAS - INTEGRAÇÃO SUPABASE
// ============================================
(function initFinanceiroPendencias() {
  if (window.__FIN_PEND_INITIALIZED) return;
  window.__FIN_PEND_INITIALIZED = true;

  // Constantes (compatibilidade)
  window.DB_CAIXA_PEND = 'DB_CAIXA_PEND';
  window.DB_CAIXA_CONF_OK = 'DB_CAIXA_CONF_OK';

  // ===== API SUPABASE =====
  const PendenciasAPI = {
    get client() { return window.SupabaseAPI?.client; },

    async getAll(empresa) {
      try {
        if (!this.client) {
          // Fallback localStorage
          try { return JSON.parse(localStorage.getItem('DB_CAIXA_PEND') || '[]'); } catch { return []; }
        }
        const company = empresa || window.getCompany?.() || 'BSX';
        const { data, error } = await this.client
          .from('pendencias')
          .select('*')
          .eq('company', company)
          .eq('status', 'PENDENTE')
          .order('data', { ascending: false });
        
        if (error) { console.error('[Pendencias] Erro:', error); return []; }
        
        return (data || []).map(r => ({
          id: r.id, uid: r.uid, altUID: r.alt_uid,
          gerenteId: r.gerente_id, gerenteNome: r.gerente,
          valorOriginal: Number(r.valor_original) || 0,
          valorConfirm: Number(r.valor_confirm) || 0,
          forma: r.forma || 'PIX', data: r.data || '',
          info: r.info || '', prestId: r.prestacao_id,
          tipoCaixa: r.tipo_caixa || 'RECEBIDO',
          status: r.status || 'PENDENTE', edited: r.edited || false
        }));
      } catch(e) { console.error('[Pendencias] Erro:', e); return []; }
    },

    async create(item) {
      try {
        if (!this.client) {
          // Fallback localStorage
          const arr = JSON.parse(localStorage.getItem('DB_CAIXA_PEND') || '[]');
          arr.push(item);
          localStorage.setItem('DB_CAIXA_PEND', JSON.stringify(arr));
          return item.uid;
        }
        const company = window.getCompany?.() || 'BSX';
        const uid = item.uid || window.uid?.() || crypto.randomUUID();
        
        await this.client.from('pendencias').insert([{
          uid, alt_uid: item.altUID || null,
          gerente: item.gerenteNome || '', gerente_id: item.gerenteId || null,
          valor_original: Number(item.valorOriginal) || 0,
          valor_confirm: Number(item.valorConfirm || item.valorOriginal) || 0,
          forma: item.forma || 'PIX',
          data: item.data || new Date().toISOString().slice(0,10),
          info: item.info || '', prestacao_id: item.prestId || null,
          tipo_caixa: item.tipoCaixa || 'RECEBIDO',
          status: 'PENDENTE', edited: false, company
        }]);
        console.log('[Pendencias] ✅ Criada:', uid);
        return uid;
      } catch(e) { console.error('[Pendencias] Erro ao criar:', e); throw e; }
    },

    async update(uid, dados) {
      try {
        if (!this.client) return;
        const dbRow = {};
        if (dados.valorConfirm !== undefined) dbRow.valor_confirm = Number(dados.valorConfirm);
        if (dados.edited !== undefined) dbRow.edited = dados.edited;
        if (dados.status !== undefined) dbRow.status = dados.status;
        
        await this.client.from('pendencias').update(dbRow).eq('uid', uid);
        console.log('[Pendencias] ✅ Atualizada:', uid);
      } catch(e) { console.error('[Pendencias] Erro ao atualizar:', e); }
    },

    async delete(uid) {
      try {
        if (!this.client) {
          let arr = JSON.parse(localStorage.getItem('DB_CAIXA_PEND') || '[]');
          arr = arr.filter(p => p.uid !== uid);
          localStorage.setItem('DB_CAIXA_PEND', JSON.stringify(arr));
          return;
        }
        await this.client.from('pendencias').delete().eq('uid', uid);
        console.log('[Pendencias] ✅ Deletada:', uid);
      } catch(e) { console.error('[Pendencias] Erro ao deletar:', e); }
    },

    async confirm(uid) {
      try {
        if (!this.client) {
          const s = new Set(JSON.parse(localStorage.getItem('DB_CAIXA_CONF_OK') || '[]'));
          s.add(uid);
          localStorage.setItem('DB_CAIXA_CONF_OK', JSON.stringify([...s]));
          return;
        }
        const company = window.getCompany?.() || 'BSX';
        await this.client.from('pendencias_confirmadas').upsert([{
          uid, company, confirmed_by: window.currentUser?.nome || ''
        }], { onConflict: 'uid' });
        await this.delete(uid);
        console.log('[Pendencias] ✅ Confirmada:', uid);
      } catch(e) { console.error('[Pendencias] Erro ao confirmar:', e); }
    },

    async isConfirmed(uid) {
      try {
        if (!this.client) {
          const s = new Set(JSON.parse(localStorage.getItem('DB_CAIXA_CONF_OK') || '[]'));
          return s.has(uid);
        }
        const { data } = await this.client
          .from('pendencias_confirmadas')
          .select('uid').eq('uid', uid).maybeSingle();
        return !!data;
      } catch { return false; }
    },

    async getConfirmedSet() {
      try {
        if (!this.client) {
          return new Set(JSON.parse(localStorage.getItem('DB_CAIXA_CONF_OK') || '[]'));
        }
        const company = window.getCompany?.() || 'BSX';
        const { data } = await this.client
          .from('pendencias_confirmadas')
          .select('uid').eq('company', company);
        return new Set((data || []).map(r => r.uid));
      } catch { return new Set(); }
    },

    async migrate() {
      try {
        const raw = localStorage.getItem('DB_CAIXA_PEND');
        if (!raw) { console.log('[Pendencias] Nada para migrar'); return { migrated: 0 }; }
        
        const local = JSON.parse(raw);
        if (!Array.isArray(local) || !local.length) return { migrated: 0 };
        
        console.log(`[Pendencias] 🔄 Migrando ${local.length} pendências...`);
        let migrated = 0;
        
        for (const item of local) {
          try {
            const { data: existing } = await this.client
              .from('pendencias').select('uid').eq('uid', item.uid).maybeSingle();
            if (existing) continue;
            
            await this.create(item);
            migrated++;
          } catch(e) { console.warn('Erro ao migrar:', e); }
        }
        
        // Migra confirmações
        const confRaw = localStorage.getItem('DB_CAIXA_CONF_OK');
        if (confRaw) {
          const confs = JSON.parse(confRaw);
          for (const uid of confs) {
            try {
              await this.client.from('pendencias_confirmadas')
                .upsert([{ uid, company: window.getCompany?.() || 'BSX' }], { onConflict: 'uid' });
            } catch {}
          }
          console.log(`[Pendencias] ✅ ${confs.length} confirmações migradas`);
        }
        
        console.log(`[Pendencias] ✅ Migradas: ${migrated}`);
        localStorage.setItem('DB_CAIXA_PEND_backup', raw);
        return { migrated };
      } catch(e) { console.error('[Pendencias] Erro:', e); return { migrated: 0 }; }
    }
  };

// Expor globalmente
window.PendenciasAPI = PendenciasAPI;
window.SupabaseAPI = window.SupabaseAPI || {};
window.SupabaseAPI.pendencias = PendenciasAPI;  // ✅ ADICIONE ESTA LINHA
window.migrarPendenciasParaSupabase = () => PendenciasAPI.migrate();


// ===== FUNÇÕES DE COMPATIBILIDADE - SOMENTE SUPABASE =====
let _pendCache = null;

window.__getPendencias = function() {
  // Retorna o cache se existir, senão array vazio
  // O cache é preenchido pelo __getPendenciasAsync
  return _pendCache || [];
};

window.__getPendenciasAsync = async function() {
  _pendCache = await PendenciasAPI.getAll();
  console.log('[Pendencias] ✅ Carregado do Supabase:', _pendCache.length);
  return _pendCache;
};

window.__setPendencias = function(arr) {
  _pendCache = arr;
  // NÃO salva no localStorage - o Supabase é a fonte única
};

window.__addPendencia = async function(item) {
  await PendenciasAPI.create(item);
  _pendCache = await PendenciasAPI.getAll(); // Recarrega do Supabase
};

window.__removePendencia = async function(uid) {
  await PendenciasAPI.delete(uid);
  _pendCache = await PendenciasAPI.getAll(); // Recarrega do Supabase
};

window.__getConfSet = async function() {
  return await PendenciasAPI.getConfirmedSet();
};

window.__getConfSetAsync = async function() {
  return await PendenciasAPI.getConfirmedSet();
};

window.__addConf = async function(uid) {
  if (!uid) return;
  await PendenciasAPI.confirm(uid);
};

window.__getLanc = function() {
  return Array.isArray(window.lanc) ? window.lanc : (window.lanc = []);
};

window.__setLanc = function(novo) {
  try {
    if (Array.isArray(novo)) window.lanc = novo;
    window.saveLanc?.();
  } catch {}
};

// ✅ CARREGA DO SUPABASE NA INICIALIZAÇÃO
(async function initPendenciasFromSupabase() {
  try {
    // Aguarda o client estar pronto
    let tentativas = 0;
    while (!PendenciasAPI.client && tentativas < 50) {
      await new Promise(r => setTimeout(r, 100));
      tentativas++;
    }
    
    if (PendenciasAPI.client) {
      _pendCache = await PendenciasAPI.getAll();
      console.log('[Pendencias] ✅ Inicializado do Supabase:', _pendCache.length, 'pendências');
      
      // Re-renderiza se a tela de pendências estiver aberta
      if (typeof renderFinPendencias === 'function') {
        renderFinPendencias();
      }
    }
  } catch(e) {
    console.error('[Pendencias] Erro ao inicializar:', e);
  }
})();

  // ===== FUNÇÕES DE UID =====
  window.__pgMakeUIDs = function(prest, pg) {
    const pid = prest?.id ?? 'prest';
    const data = pg?.data || prest?.fim || prest?.ini || '';
    const v = Number(pg?.valor) || 0;
    const forma = String(pg?.forma || pg?.tipo || '').trim().toUpperCase();
    const stable = `P:${pid}|D:${data}|V:${v.toFixed(2)}|F:${forma}`;
    const legacy = `prest:${pid}:${pg?.id ?? ''}:${data}:${v}`;
    return { stable, legacy };
  };

  window.__negMakeUID = function(prest, valorAbs) {
    const pid = prest?.id ?? 'prest';
    const data = prest?.fim || prest?.ini || '';
    const v = Number(valorAbs) || 0;
    return { stable: `NEG:${pid}|D:${data}|V:${v.toFixed(2)}`, legacy: `prest:saida:${pid}:${data}:${v}` };
  };

  // ===== SINCRONIZAÇÃO =====
  window.syncPendenciasFromPrest = async function() {
    try {
      const DB_PREST_KEY = window.DB_PREST || 'bsx_prestacoes_v1';
      let prests = [];
      try {
        const raw = localStorage.getItem(DB_PREST_KEY);
        prests = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(prests)) prests = [];
      } catch { return 0; }

      // Carrega pendências do Supabase
      const pend = await window.__getPendenciasAsync();
      const pendUIDs = new Set(pend.map(p => p.uid).filter(Boolean));
      const pendAlt = new Set(pend.map(p => p.altUID).filter(Boolean));

      const lancs = window.__getLanc();
      const confirmados = await window.__getConfSetAsync();
      const confirmadosFromUID = new Set([
        ...(lancs || []).map(x => x?.meta?.fromUID).filter(Boolean),
        ...confirmados
      ]);

      let novos = 0;

      for (const p of prests) {
        const gerenteNome = (window.gerentes || []).find(g =>
          String(g.uid) === String(p.gerenteId)
        )?.nome || p?.gerenteNome || '(excluído)';

        const pagamentos = []
          .concat(Array.isArray(p.pagamentos) ? p.pagamentos : [])
          .concat(Array.isArray(p.pagamentosNormais) ? p.pagamentosNormais : [])
          .filter(x => {
            const f = String((x.forma || x.tipo || '') + '').trim().toUpperCase();
            return !x?.cancelado && f !== 'ADIANTAMENTO' && f !== 'VALE' && f !== 'DIVIDA_PAGA';
          });

        for (const pg of pagamentos) {
          const uids = window.__pgMakeUIDs(p, pg);

          if (pendUIDs.has(uids.stable) || pendUIDs.has(uids.legacy) ||
              pendAlt.has(uids.stable) || pendAlt.has(uids.legacy) ||
              confirmadosFromUID.has(uids.stable) || confirmadosFromUID.has(uids.legacy)) {
            continue;
          }

          await PendenciasAPI.create({
            uid: uids.stable, altUID: uids.legacy,
            prestId: p.id, gerenteId: p.gerenteId, gerenteNome,
            data: pg.data || p.fim || p.ini || '',
            valorOriginal: Number(pg.valor) || 0,
            valorConfirm: Number(pg.valor) || 0,
            info: 'Prest. ' + (p.ini || '').slice(5).split('-').reverse().join('/') +
                  '–' + (p.fim || '').slice(5).split('-').reverse().join('/'),
            forma: pg.forma || pg.tipo || 'PRESTAÇÃO',
            tipoCaixa: 'RECEBIDO'
          });

          pendUIDs.add(uids.stable);
          novos++;
        }
      }

      if (novos > 0) {
        _pendCache = null; // Invalida cache
        console.log('✅ Sincronizadas', novos, 'novas pendências');
      }
      return novos;
    } catch (e) { console.error('Erro em syncPendenciasFromPrest:', e); return 0; }
  };

  // Carrega pendências do Supabase no início
  setTimeout(async () => {
    if (window.SupabaseAPI?.client) {
      await window.__getPendenciasAsync();
      console.log('[Pendencias] ✅ Cache carregado do Supabase');
    }
  }, 2000);

  console.log('✅ [Pendencias] API Supabase inicializada. Use migrarPendenciasParaSupabase() para migrar.');
})();

// ===== HELPER PARA FORMATAÇÃO DE DATA =====
function fmtData(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

window.fmtData = fmtData; // Expõe globalmente


// ===== RENDERIZAÇÃO DE PENDÊNCIAS =====


function renderFinPendencias(){
  const box = document.getElementById('finPendenciasBox');
  if(!box) return;

  const pend = __getPendencias().filter(p => p.status === 'PENDENTE');
  
  // Separa recebimentos e pagamentos
  const recebimentos = pend.filter(p => p.tipoCaixa === 'RECEBIDO' || p.tipo === 'RECEBER');
  const pagamentos = pend.filter(p => p.tipoCaixa === 'PAGO' || p.tipo === 'PAGAR');

  if (pend.length === 0) {
    box.innerHTML = '<p style="padding:20px;text-align:center;color:#666">Nenhuma pendência no momento.</p>';
    return;
  }

  let html = '';

  // ===== SEÇÃO: PAGAMENTOS PENDENTES =====
  if (pagamentos.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="
          background: #fee; 
          color: #c00; 
          padding: 12px 16px; 
          margin: 0 0 16px 0;
          border-radius: 8px;
          font-size: 18px;
        ">
          ⚠️ PAGAMENTOS PENDENTES (Empresa deve ao gerente)
        </h3>
        <table class="fin-table" style="margin-bottom: 20px;">
          <thead>
            <tr>
              <th>Data</th>
              <th>Gerente</th>
              <th>Info</th>
              <th>Valor original</th>
              <th>Valor p/ confirmar</th>
              <th>Forma</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>`;

    pagamentos.forEach(p => {
      html += `
        <tr data-pend-id="${p.id}" style="background: #fff3f3;">
          <td>${fmtData(p.data||'')}</td>
          <td><strong>${esc(p.gerenteNome||'')}</strong></td>
          <td>${esc(p.info||'')}</td>
          <td style="color:#b91c1c;font-weight:600">-${fmtBRL(p.valorOriginal||0)}</td>
          <td>
            <input 
              type="number" 
              step="0.01" 
              value="${Number(p.valorConfirm||0)}"
              data-pend-edit="${p.id}"
              style="width:120px;padding:6px;border:2px solid #fca5a5;border-radius:4px"
            >
            ${p.edited ? '<span class="pill-editado" style="background:#fca5a5;color:#7f1d1d">EDITADO</span>' : ''}
          </td>
          <td>${esc(p.forma||'PIX')}</td>
          <td style="white-space:nowrap">
            <button 
              class="btn" 
              data-pend-confirm="${p.id}"
              style="background:#b91c1c"
            >Confirmar Pagamento</button>
            <button 
              class="btn ghost" 
              data-pend-discard="${p.id}"
            >Descartar</button>
          </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
  }

  // ===== SEÇÃO: RECEBIMENTOS PENDENTES =====
  if (recebimentos.length > 0) {
    html += `
      <div>
        <h3 style="
          background: #eff; 
          color: #06c; 
          padding: 12px 16px; 
          margin: 0 0 16px 0;
          border-radius: 8px;
          font-size: 18px;
        ">
          💰 RECEBIMENTOS PENDENTES (Gerente deve à empresa)
        </h3>
        <table class="fin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Gerente</th>
              <th>Info</th>
              <th>Valor original</th>
              <th>Valor p/ confirmar</th>
              <th>Forma</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>`;

    recebimentos.forEach(p => {
      html += `
        <tr data-pend-id="${p.id}">
          <td>${fmtData(p.data||'')}</td>
          <td><strong>${esc(p.gerenteNome||'')}</strong></td>
          <td>${esc(p.info||'')}</td>
          <td style="color:#16a34a;font-weight:600">${fmtBRL(p.valorOriginal||0)}</td>
          <td>
            <input 
              type="number" 
              step="0.01" 
              value="${Number(p.valorConfirm||0)}"
              data-pend-edit="${p.id}"
              style="width:120px;padding:6px;border:2px solid #d1d5db;border-radius:4px"
            >
            ${p.edited ? '<span class="pill-editado">EDITADO</span>' : ''}
          </td>
          <td>${esc(p.forma||'PRESTAÇÃO')}</td>
          <td style="white-space:nowrap">
            <button 
              class="btn" 
              data-pend-confirm="${p.id}"
            >Confirmar</button>
            <button 
              class="btn ghost" 
              data-pend-discard="${p.id}"
            >Descartar</button>
          </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
  }

  box.innerHTML = html;
}

// Delegação de eventos da área de pendências
// Delegação de eventos da área de pendências
(function bindFinPendEvents(){
  if (window.__finPendBound) return; 
  window.__finPendBound = true;

  // Event listener para inputs
  document.addEventListener('input', async function(e) {
    const inp = e.target.closest('#finPendenciasBox [data-pend-edit]');
    if (!inp) return;

    const tr = inp.closest('tr[data-pend-id]');
    const id = tr?.getAttribute('data-pend-id');
    if (!id) return;

    const pend = __getPendencias();
    const idx = pend.findIndex(function(x) { return x.id === id; });
    if (idx < 0) return;

    const val = parseFloat(String(inp.value).replace(',','.')) || 0;
    pend[idx].valorConfirm = val;
    pend[idx].edited = (Math.abs(val - (Number(pend[idx].valorOriginal)||0)) > 0.0001);
    __setPendencias(pend);

    // Re-render só a badge "EDITADO"
    const badgeCell = tr.querySelector('td:nth-child(5)');
    if (badgeCell) {
      const had = badgeCell.querySelector('.pill-editado');
      if (pend[idx].edited && !had) {
        const span = document.createElement('span');
        span.className = 'pill-editado';
        span.textContent = 'EDITADO';
        badgeCell.appendChild(span);
      }
      if (!pend[idx].edited && had) {
        had.remove();
      }
    }
  }, true);

  // Event listener para cliques
  document.addEventListener('click', async function(e) {
    const target = e.target;
    
    const btnC = target.closest('#finPendenciasBox [data-pend-confirm]');
    if (btnC) {
      e.preventDefault();
      e.stopPropagation();
      
      const tr = btnC.closest('tr[data-pend-id]');
      const id = tr?.getAttribute('data-pend-id');
      
      if (!id) {
        console.error('ID não encontrado');
        return;
      }
      
      const pend = __getPendencias();
      const i = pend.findIndex(function(x) { return x.id == id; });
      
      if (i < 0) {
        alert('Pendência não encontrada.');
        return;
      }
    
      const p = pend[i];
      
      // Desabilita o botão temporariamente
      btnC.disabled = true;
      btnC.textContent = 'Processando...';
    
      try {
        const lancs = __getLanc();
        
        // ✅ DETERMINA SE É ENTRADA OU SAÍDA
        const ehSaida = (p.tipoCaixa === 'PAGO') || (p.tipo === 'PAGAR');
        const statusFinal = ehSaida ? 'PAGO' : 'RECEBIDO';
        
        // Mensagem de confirmação diferente para pagamentos
        if (ehSaida) {
          const confirmMsg = `Confirmar PAGAMENTO de ${fmtBRL(p.valorConfirm||0)} para ${p.gerenteNome}?\n\nEste valor SAIRÁ do caixa.`;
          if (!confirm(confirmMsg)) {
            btnC.disabled = false;
            btnC.textContent = 'Confirmar Pagamento';
            return;
          }
        }
    
        // Cria o novo lançamento
        const novoLanc = {
          uid: (typeof window.uid === 'function' ? window.uid() : 'f_' + Date.now() + '_' + Math.random()),
          gerente: p.gerenteNome || '',
          valor: Number(p.valorConfirm) || 0,
          status: statusFinal,
          forma: p.forma || (ehSaida ? 'PIX' : 'PRESTAÇÃO'),
          categoria: ehSaida ? 'Prestação de contas (SAÍDA)' : 'Prestação de contas (ENTRADA)',
          data: p.data || (new Date()).toISOString().slice(0,10),
          meta: {
            from: 'prestacao',
            fromUID: p.uid,
            prestId: p.prestId || null,
            editado: !!p.edited,
            editadoDe: Number(p.valorOriginal) || 0,
            tipoPendencia: ehSaida ? 'PAGAMENTO' : 'RECEBIMENTO'
          },
          createdAt: new Date().toISOString()
        };

        // Se o valor foi editado, marca como editado
        if (p.edited) {
          novoLanc.editedAt = new Date().toISOString();
          novoLanc.editedBy = (window.UserAuth?.currentUser()?.username || 'Usuário');
        }
    
// Adiciona ao array de lançamentos
lancs.push(novoLanc);
        
// ✅ SALVA NO SUPABASE
if (window.SupabaseAPI?.lancamentos?.create) {
  await window.SupabaseAPI.lancamentos.create(novoLanc);
}

// Salva localmente como backup
__setLanc(lancs);
if (typeof window.saveLanc === 'function') {
  window.saveLanc();
}
        
        // ✅ AUDITORIA - Registra confirmação
        if (typeof window.AuditLog !== 'undefined' && typeof window.AuditLog.log === 'function') {
          const acaoAudit = ehSaida ? 'pagamento_confirmado' : 'recebimento_confirmado';
          window.AuditLog.log(acaoAudit, {
            id: novoLanc.uid,
            gerente: novoLanc.gerente,
            valor: novoLanc.valor,
            valorOriginal: Number(p.valorOriginal) || 0,
            editado: !!p.edited
          });
        }
        
        // Marca como confirmado
        __addConf(p.uid);
        if (p.altUID) __addConf(p.altUID);
    
        // Remove da fila de pendências
        pend.splice(i, 1);
        __setPendencias(pend);
    
        // Atualiza as interfaces
        if (typeof renderFinPendencias === 'function') {
          renderFinPendencias();
        }
        if (typeof window.renderFin === 'function') {
          window.renderFin();
        }
        
        // Feedback
        const mensagem = ehSaida 
          ? 'Pagamento confirmado! Valor debitado do caixa.'
          : 'Recebimento confirmado! Valor creditado no caixa.';
          
        if (typeof window.showNotification === 'function') {
          window.showNotification(mensagem, 'success');
        } else {
          alert(mensagem);
        }
        
        // ✅ NOTIFICA SINCRONIZAÇÃO
        if (typeof window.SyncManager !== 'undefined') {
          window.SyncManager.notify('financeiro', { 
            confirmacao: true, 
            tipo: ehSaida ? 'pagamento' : 'recebimento' 
          });
        }
        
      } catch(error) {
        console.error('Erro ao confirmar:', error);
        alert('Erro ao confirmar: ' + error.message);
        
        // Reabilita o botão em caso de erro
        btnC.disabled = false;
        btnC.textContent = ehSaida ? 'Confirmar Pagamento' : 'Confirmar';
      }
      
      return;
    }

    // ✅ Botão DESCARTAR
    const btnD = target.closest('#finPendenciasBox [data-pend-discard]');
    if (btnD) {
      e.preventDefault();
      e.stopPropagation();
      
      // ✅ Executa como async
      (async () => {
      // Só ADMIN pode descartar
      if (!(window.canDeleteLanc && window.canDeleteLanc())) {
        alert('Apenas ADMIN pode descartar pendências.');
        return;
      }

      const tr = btnD.closest('tr[data-pend-id]');
      const id = tr?.getAttribute('data-pend-id');

      if (!confirm('Remover esta pendência da fila? Isso NÃO cria lançamento no caixa.')) {
        return;
      }

      const pendencias = __getPendencias();
      const pendenciaDescartada = pendencias.find(function(x) { return x.id == id; });
      
      // ✅ DELETA DO SUPABASE (não apenas do cache local)
      if (pendenciaDescartada) {
        // Usa o uid ou id para deletar
        const uidToDelete = pendenciaDescartada.uid || pendenciaDescartada.id;
        await window.__removePendencia(uidToDelete);
        console.log('[Pendencias] ✅ Descartada do Supabase:', uidToDelete);
      }
      
      // ✅ AUDITORIA - Registra descarte
      if (pendenciaDescartada && typeof window.AuditLog !== 'undefined' && typeof window.AuditLog.log === 'function') {
        const ehSaida = (pendenciaDescartada.tipoCaixa === 'PAGO') || (pendenciaDescartada.tipo === 'PAGAR');
        const acaoAudit = ehSaida ? 'pagamento_descartado' : 'recebimento_descartado';
        window.AuditLog.log(acaoAudit, {
          gerente: pendenciaDescartada.gerenteNome,
          valor: pendenciaDescartada.valorConfirm || pendenciaDescartada.valorOriginal,
          info: pendenciaDescartada.info
        });
      }
      
      if (typeof renderFinPendencias === 'function') {
        renderFinPendencias();
      }
      
      })(); // ✅ Fecha a função async
      return;
    }
  }, true);
})();

// Hook principal: sempre que abrir/atualizar o Financeiro, sincroniza e renderiza pendências
(function hookFinanceiro(){
  // Guarda referência do renderFin original (se houver)
  const _origRenderFin = window.renderFin;
  window.renderFin = function(){
    try {
      syncPendenciasFromPrest();   // puxa novas pendências das prestações
      renderFinPendencias();       // mostra a seção "A confirmar"
    } catch(_) {}
    // chama o render original do caixa
    if (typeof _origRenderFin === 'function') return _origRenderFin();
  };

  // Se já estamos no financeiro e alguém chamou renderFin antes:
  // rodamos uma vez agora também
  try {
    syncPendenciasFromPrest();
    renderFinPendencias();
  } catch(_){}
})();

(function bindFinRowActions(){
  const page = document.getElementById('pageFinanceiro');
  if (!page || page.__finRowsBound) return;
  page.__finRowsBound = true;

  page.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-fin],[data-edit],[data-del]');
    if (!btn) return;

    const action =
      btn.dataset.fin ||
      (btn.hasAttribute('data-edit') ? 'edit'
       : btn.hasAttribute('data-del') ? 'del' : '');

    const uid = window.__fin_getUidFromClick(btn);

    if (action === 'edit'){
      e.preventDefault();
      window.__fin_openDialog(uid || btn);
      return;
    }

    if (action === 'del'){
      e.preventDefault();
      if (!canDeleteLanc()) { alert('Apenas ADMIN pode excluir.'); return; }
      if (!uid) return;
      if (!confirm('Excluir este lançamento?')) return;

      const { idx } = window.__fin_findByUid(uid);
      if (idx === -1) { alert('Registro não encontrado.'); return; }

      window.lanc.splice(idx, 1);
      window.saveLanc?.();
      window.renderFin?.();
      return;
    }
  }, {capture:false});
})();

// filtros reagem
['mes','ano','status','forma','busca','dataDe','dataAte'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  const fn = ()=>{ saveFilters(); renderFin(); };
  el.addEventListener('input', fn);
  el.addEventListener('change', fn);
});

// impressão A4
function imprimirFinanceiroA4(){
  const rows = sortRows(applyFilters(window.lanc));
  const totR = rows.filter(r=>r.status==='RECEBIDO').reduce((a,b)=>a+numSafe(b.valor),0);
  const totP = rows.filter(r=>r.status==='PAGO').reduce((a,b)=>a+numSafe(b.valor),0);
  const saldo= totR - totP;

  const linhas = rows.map(r => `
    <tr>
      <td>${esc(r.gerente||'')}</td>
      <td style="text-align:right">${fmtBRL(numSafe(r.valor))}</td>
      <td>${esc(r.status||'')}</td>
      <td>${esc(r.forma||'')}</td>
      <td>${esc(r.categoria||'')}</td>
      <td>${(r.data||'').split('-').reverse().join('/')}</td>
    </tr>`).join('');

  const html = `
<!doctype html><html>
<head>
<meta charset="utf-8">
<title>Financeiro - Impressão</title>
<style>
  @page{size:A4 portrait;margin:10mm}
  body{font-family:Arial;color:#111}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
  .card{padding:10px;border-radius:8px;color:#fff;font-weight:700}
  .r{background:#0b3d0b}.p{background:#212121}.s{background:#4caf50}
  .title{font-size:12px;opacity:.9}.big{font-size:18px;margin-top:6px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
  thead th{background:#222;color:#fff}
  td:nth-child(2){white-space:nowrap}
</style>
</head>
<body>
  <div class="grid">
    <div class="card r"><div class="title">TOTAL RECEBIMENTOS</div><div class="big">${fmtBRL(totR)}</div></div>
    <div class="card p"><div class="title">TOTAL PAGAMENTOS</div><div class="big">${fmtBRL(totP)}</div></div>
    <div class="card s"><div class="title">SALDO</div><div class="big">${fmtBRL(saldo)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>GERENTE/ROTA</th>
        <th style="min-width:90px">VALOR</th>
        <th>RECEBIDO/PAGO</th>
        <th>FORMA</th>
        <th>CATEGORIA</th>
        <th style="min-width:80px">DATA</th>
      </tr>
    </thead>
    <tbody>${linhas || '<tr><td colspan="6">Sem lançamentos.</td></tr>'}</tbody>
  </table>
  <script>window.print(); setTimeout(()=>window.close(), 300);<\/script>
</body></html>`.trim();

  let w = null;
  try { w = window.open('', '_blank'); } catch(_) {}

  if (w && w.document){
    w.document.open();
    w.document.write(html);
    w.document.close();
    try { w.focus(); } catch(_) {}
    return;
  }

  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 30000);
}


// ===== Helpers de ações gerais (usados pela delegação única) =====
function __fin_printCaixa(){
  const get = id => document.getElementById(id)?.textContent || 'R$ 0,00';

  const html = `
<!doctype html><html>
<head>
<meta charset="utf-8">
<title>Resumo do Caixa</title>
<style>
  body{font-family:Arial;padding:20px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .card{padding:16px;border-radius:10px;color:#fff;font-weight:700}
  .r{background:#0b3d0b}.p{background:#212121}.s{background:#4caf50}
  .big{font-size:24px;margin-top:6px}
</style>
</head>
<body>
  <h2>BSX LOTERIAS · Resumo do Caixa</h2>
  <div class="grid">
    <div class="card r"><div>TOTAL RECEBIMENTOS</div><div class="big">${get('totalRecebimentos')}</div></div>
    <div class="card p"><div>TOTAL PAGAMENTOS</div><div class="big">${get('totalPagamentos')}</div></div>
    <div class="card s"><div>SALDO</div><div class="big">${get('saldo')}</div></div>
  </div>
  <script>window.print(); setTimeout(()=>window.close(), 300);<\/script>
</body></html>`.trim();

  // tenta abrir janela
  let w = null;
  try { w = window.open('', '_blank'); } catch(_) {}

  if (w && w.document) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    try { w.focus(); } catch(_) {}
    return;
  }

  // Fallback: abre via Blob/URL (contorna bloqueio)
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  // precisa ser “clickado” no mesmo gesto do usuário:
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 30000);
}

// === Delegação ÚNICA de cliques do Financeiro ===
(function () {
  if (window.__fin_clicks_bound__) return;
  window.__fin_clicks_bound__ = true;

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-edit], [data-del]');
    if (!t) return;
  
    // --- Dialog Novo lançamento ---
    if (t.id === 'salvarLanc')  { e.preventDefault(); __fin_saveFromForm?.(); return; }
    if (t.id === 'btnCloseDlg') {
      e.preventDefault();
      const d = document.getElementById('dlgLanc');
      if (d?.close) d.close(); else d?.removeAttribute('open');
      if (d) d.style.display = '';
      return;
    } 
   
    // --- Submenu Financeiro ---
    if (t.id === 'btnImprimirTabela') { e.preventDefault(); imprimirFinanceiroA4?.(); return; }
    if (t.id === 'btnImprimirCaixa')  { e.preventDefault(); __fin_printCaixa?.(); return; }
    if (t.id === 'btnExportar')       { e.preventDefault(); __fin_exportCSV?.(); return; }
    if (t.id === 'btnNovo')           { e.preventDefault(); __fin_openDialog?.(null); return; }
  
    // --- Ações na Tabela (EDITAR/EXCLUIR) ---
    if (t.hasAttribute('data-edit')) {
      e.preventDefault();
      const uid = t.getAttribute('data-edit');
      __fin_openDialog?.(uid);
      return;
    }
    if (t.hasAttribute('data-del')) { 
      e.preventDefault();
      const uid = t.getAttribute('data-del');
      __fin_deleteRow?.(uid, t);   // <-- passa t
      return;
    }    
  }, { capture: true });
  
})();


// Placeholders seguros (remova quando ligar às suas rotinas reais)
window.__fin_deleteRow = window.__fin_deleteRow || function(uid){
  console.warn('Excluir não implementado. uid:', uid);
};
window.__fin_saveFromForm = window.__fin_saveFromForm || function(){
  console.warn('Salvar do formulário não implementado.');
};


// reforça quando entrar na aba #fin
window.addEventListener('hashchange', ()=>{
  if ((location.hash||'#').slice(1)==='fin') renderFin?.();
});

// carrega filtros salvos e faz o primeiro render (se a tela já existir)
loadFilters();
if (document.getElementById('tbody')) renderFin();


// ========= HOTFIX: binds diretos p/ botões do Financeiro + render seguro =========
(function finHotfix(){
  function bind(id, fn){
    const el = document.getElementById(id);
    if (el && !el.__finBound){
      el.addEventListener('click', (e)=>{ e.preventDefault(); fn?.(); }, {passive:false});
      el.__finBound = true;
    }
  }

  function tryRenderFin(){
    try { 
      if (typeof window.renderFin === 'function' && document.getElementById('tbody')) {
        window.renderFin();
      }
    } catch(err){
      console.error('[Financeiro] renderFin falhou:', err);
    }
  }

  // Liga assim que o DOM estiver pronto
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(){
    // Binds diretos (funcionam mesmo se a delegação global for impedida por CSS/overlay)
    bind('btnImprimirTabela', ()=> { try { imprimirFinanceiroA4(); } catch(e){ console.error(e); } });
    bind('btnImprimirCaixa',  ()=> { try { __fin_printCaixa(); }         catch(e){ console.error(e); } });
    bind('btnNovo',           ()=> { try { __fin_openDialog(null); }      catch(e){ console.error(e); } });

    // Se estiver na aba Financeiro ou se o tbody já existir no DOM, renderiza com proteção
    if ((location.hash||'#').slice(1) === 'fin' || document.getElementById('tbody')){
      tryRenderFin();
    }
  }

  // Se o usuário navegar para #fin depois, garante o render
  window.addEventListener('hashchange', ()=>{
    if ((location.hash||'#').slice(1) === 'fin') init();
  });
})();
// expõe funções para outros arquivos
window.renderFin             = window.renderFin || renderFin;
window.imprimirFinanceiroA4  = imprimirFinanceiroA4;
window.__fin_printCaixa      = __fin_printCaixa;

/* ==================== DIAGNÓSTICO DOS BOTÕES (Financeiro) ==================== */
window.BSX_fin_diag = function(){
  const q = s => document.querySelector(s);
  const o = {
    pagina_visivel: !document.getElementById('pageFinanceiro')?.classList.contains('hidden'),
    btnImprimirTabela: !!q('#btnImprimirTabela'),
    btnImprimirCaixa:  !!q('#btnImprimirCaixa'),
    btnNovo:           !!q('#btnNovo'),
    dlgLanc:           !!q('#dlgLanc'),
    fn_imprimirFinanceiroA4: typeof window.imprimirFinanceiroA4,
    fn___fin_printCaixa:     typeof window.__fin_printCaixa,
    fn___fin_openDialog:     typeof window.__fin_openDialog,
    fn___fin_saveFromForm:   typeof window.__fin_saveFromForm,
  };
  console.table(o);
  if (!o.pagina_visivel) console.warn('A aba Financeiro não está visível (#pageFinanceiro está com .hidden).');
  return o;
};
// Garante que "Novo" abra sempre limpo, mesmo se alguém chamar showModal() direto
(function forceCleanNewOpen(){
  const dlg  = document.getElementById('dlgLanc');
  const form = document.getElementById('formLanc');
  if (!dlg || !form) return;

  function resetIfNotEditing(){
    if (!dlg.hasAttribute('data-editing')){
      form.reset();
      form.querySelector('[name="data"]').value = new Date().toISOString().slice(0,10);
    }
  }

  // Se o dialog for aberto "na marra" (showModal direto), detecta o atributo open e limpa
  const mo = new MutationObserver((muts)=>{
    if (dlg.open) resetIfNotEditing();
  });
  mo.observe(dlg, { attributes:true, attributeFilter:['open'] });

  // Botão "Cancelar": além de fechar, tira o data-editing e limpa
  const btnClose = document.getElementById('btnCloseDlg');
  if (btnClose && !btnClose.__bound){
    btnClose.addEventListener('click', ()=>{
      dlg.removeAttribute('data-editing');
      form.reset();
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    });
    btnClose.__bound = true;
  }

  // Tecla ESC (cancel)
  dlg.addEventListener('cancel', ()=>{
    dlg.removeAttribute('data-editing');
    form.reset();
  });
})();

// --- sinaliza que o Financeiro está pronto (persistência OK)
window.__FIN_READY__ = true;
document.dispatchEvent(new Event('fin:ready'));

// ===== EXPORTAÇÕES GLOBAIS =====
window.renderFin = renderFin;
window.imprimirFinanceiroA4 = imprimirFinanceiroA4;
window.__fin_printCaixa = __fin_printCaixa;
window.__fin_openDialog = __fin_openDialog;
window.__fin_saveFromForm = __fin_saveFromForm;
window.__fin_deleteRow = __fin_deleteRow;
window.canEditLanc = canEditLanc;
window.canDeleteLanc = canDeleteLanc;
window.getFinanceiro = getFinanceiro;

// Sinaliza que está pronto
window.__FIN_READY__ = true;
document.dispatchEvent(new Event('fin:ready'));

console.log('[Financeiro] Módulo carregado e pronto');

// ========= CORREÇÃO DO BOTÃO NOVO LANÇAMENTO =========
(function fixBtnNovo() {
  console.log('🔧 Corrigindo botão Novo lançamento...');
  
  function setupButton() {
    const btn = document.getElementById('btnNovo');
    const dlg = document.getElementById('dlgLanc');
    
    if (!btn || !dlg) {
      console.warn('btnNovo ou dlgLanc não encontrado');
      return false;
    }
    
    // Remove listener anterior se existir
    if (btn.__fixedListener) return true;
    
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('✅ Botão Novo clicado!');
      
      // Limpa o dialog
      const form = document.getElementById('formLanc');
      if (form) {
        form.reset();
        form.removeAttribute('data-editing-uid');
        
        // Define data de hoje
        const dataInput = form.querySelector('[name="data"]');
        if (dataInput) {
          dataInput.value = new Date().toISOString().slice(0, 10);
        }
      }
      
      // Remove atributo de edição
      dlg.removeAttribute('data-editing');
      
      // Abre o dialog
      if (typeof dlg.showModal === 'function') {
        dlg.showModal();
      } else {
        dlg.setAttribute('open', '');
        dlg.style.display = 'block';
      }
      
      // Foca no primeiro campo
      setTimeout(() => {
        const firstInput = form?.querySelector('input[name="gerente"]');
        if (firstInput) firstInput.focus();
      }, 100);
    }, true);
    
    btn.__fixedListener = true;
    console.log('✅ Listener instalado no btnNovo');
    return true;
  }
  
  // Tenta instalar agora
  if (!setupButton()) {
    // Se falhar, tenta quando a página do financeiro for mostrada
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-tab="fin"]')) {
        setTimeout(setupButton, 100);
      }
    });
    
    // Tenta também quando o hash mudar
    window.addEventListener('hashchange', function() {
      if (location.hash === '#fin') {
        setTimeout(setupButton, 100);
      }
    });
    
    // Tenta depois de 2 segundos (fallback)
    setTimeout(setupButton, 2000);
  }
})();

}
// ===== FORÇA RENDERIZAÇÃO DE PENDÊNCIAS AO ABRIR FINANCEIRO =====
(function autoRenderPendencias() {
  // Quando mudar para a página financeiro
  function tryRender() {
    const page = document.getElementById('pageFinanceiro');
    if (!page || page.classList.contains('hidden')) return;
    
    setTimeout(function() {
      try {
        if (typeof syncPendenciasFromPrest === 'function') {
          syncPendenciasFromPrest();
        }
        if (typeof renderFinPendencias === 'function') {
          renderFinPendencias();
        }
        console.log('[Financeiro] ✅ Pendências renderizadas automaticamente');
      } catch(e) {
        console.warn('[Financeiro] Erro ao renderizar pendências:', e);
      }
    }, 300);
  }
  
  // Monitora navegação
  window.addEventListener('hashchange', function() {
    if (location.hash === '#fin' || location.hash === '#financeiro') {
      tryRender();
    }
  });
  
  // Monitora cliques no menu
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-tab="fin"]');
    if (btn) {
      setTimeout(tryRender, 300);
    }
  });
  
  // Se já estiver na página, renderiza agora
  if (location.hash === '#fin' || location.hash === '#financeiro') {
    setTimeout(tryRender, 1000);
  }
})();

// ===== ESTILO PARA ÍCONE DE EDIÇÃO =====
(function addEditIconStyles() {
  if (document.getElementById('fin-edit-icon-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'fin-edit-icon-styles';
  style.textContent = `
    .edit-icon {
      display: inline-block;
      transition: opacity 0.2s;
    }
    .edit-icon:hover {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  
})();
// ============================================
// API DE LANÇAMENTOS PARA SUPABASE
// ============================================
(function initLancamentosAPI() {
  
  function waitForSupabase(callback, retries = 100) {
    if (window.SupabaseAPI?.client) {
      callback();
    } else if (retries > 0) {
      setTimeout(() => waitForSupabase(callback, retries - 1), 100);
    }
  }

  waitForSupabase(() => {
    
    window.SupabaseAPI.lancamentos = {
      
      async getAll(empresa) {
        const company = empresa || window.getCompany?.() || 'BSX';
        const { data, error } = await window.SupabaseAPI.client
          .from('lancamentos')
          .select('*')
          .eq('company', company)
          .order('data', { ascending: false });
        
        if (error) { console.error('[Lancamentos] Erro:', error); return []; }
        
        return (data || []).map(r => ({
          id: r.id, uid: r.uid, key: r.uid,
          gerente: r.gerente || '', valor: Number(r.valor) || 0,
          status: r.status || 'RECEBIDO', forma: r.forma || 'PIX',
          categoria: r.categoria || '', data: r.data || '',
          editedAt: r.edited_at, editedBy: r.edited_by || ''
        }));
      },

      async create(item) {
        const company = item.company || window.getCompany?.() || 'BSX';
        const uid = item.uid || window.uid?.() || crypto.randomUUID();
        
        const { data, error } = await window.SupabaseAPI.client
          .from('lancamentos')
          .insert([{
            uid, gerente: item.gerente || '', valor: Number(item.valor) || 0,
            status: item.status || 'RECEBIDO', forma: item.forma || 'PIX',
            categoria: item.categoria || '', data: item.data || new Date().toISOString().slice(0,10),
            company, created_by: window.currentUser?.nome || ''
          }])
          .select().single();
        
        if (error) throw error;
        console.log('[Lancamentos] ✅ Criado:', uid);
        return data;
      },

      async update(uid, dados) {
        const dbRow = { edited_at: new Date().toISOString(), edited_by: window.UserAuth?.currentUser()?.username || '' };
        if (dados.gerente !== undefined) dbRow.gerente = dados.gerente;
        if (dados.valor !== undefined) dbRow.valor = Number(dados.valor);
        if (dados.status !== undefined) dbRow.status = dados.status;
        if (dados.forma !== undefined) dbRow.forma = dados.forma;
        if (dados.categoria !== undefined) dbRow.categoria = dados.categoria;
        if (dados.data !== undefined) dbRow.data = dados.data;

        const { error } = await window.SupabaseAPI.client
          .from('lancamentos').update(dbRow).eq('uid', uid);
        
        if (error) throw error;
        console.log('[Lancamentos] ✅ Atualizado:', uid);
      },

      async delete(uid) {
        const { error } = await window.SupabaseAPI.client
          .from('lancamentos').delete().eq('uid', uid);
        
        if (error) throw error;
        console.log('[Lancamentos] ✅ Deletado:', uid);
      },

      async migrate() {
        const raw = localStorage.getItem('bsx_fin_lanc');
        if (!raw) { console.log('[Lancamentos] Nada para migrar'); return { migrated: 0 }; }
        
        const local = JSON.parse(raw);
        if (!Array.isArray(local) || !local.length) return { migrated: 0 };
        
        console.log(`[Lancamentos] 🔄 Migrando ${local.length} itens...`);
        let migrated = 0;
        
        for (const item of local) {
          try {
            const uid = item.uid || item.id || item.key;
            // Verifica se já existe
            const { data: existing } = await window.SupabaseAPI.client
              .from('lancamentos').select('uid').eq('uid', uid).maybeSingle();
            
            if (existing) { console.log('Já existe:', uid); continue; }
            
            await this.create(item);
            migrated++;
          } catch(e) { console.warn('Erro ao migrar:', e); }
        }
        
        console.log(`[Lancamentos] ✅ Migrados: ${migrated}`);
        localStorage.setItem('bsx_fin_lanc_backup_pre_supabase', raw);
        return { migrated };
      }
    };

    // Função global para migrar
    window.migrarLancamentosParaSupabase = () => window.SupabaseAPI.lancamentos.migrate();

// ✅ Carrega do Supabase e SUBSTITUI o localStorage
window.SupabaseAPI.lancamentos.getAll().then(data => {
  if (Array.isArray(data)) {
    window.lanc = data;
    // Atualiza localStorage como cache
    try {
      localStorage.setItem('bsx_fin_lanc', JSON.stringify(data));
      localStorage.setItem('lanc', JSON.stringify(data));
    } catch(_) {}
    window.renderFin?.();
    console.log('[Financeiro] ✅ Carregado do Supabase:', data.length, 'lançamentos');
  }
}).catch(e => {
  console.error('[Financeiro] Erro ao carregar do Supabase:', e);
});

    console.log('✅ [Lancamentos API] Pronta! Use migrarLancamentosParaSupabase() para migrar.');
  });
})();