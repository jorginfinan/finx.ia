// === HELPER: Carregar prestações do Supabase ===
async function carregarPrestacoes() {
  if (typeof window.carregarPrestacoesGlobal === 'function') {
    try {
      return await window.carregarPrestacoesGlobal();
    } catch(e) {
      console.warn('[Relatórios] Erro ao carregar do Supabase, usando localStorage:', e);
    }
  }
  // Fallback para localStorage
  return JSON.parse(localStorage.getItem(DB_PREST)||'[]')||[];
}

// === PRESTAÇÕES SALVAS (com filtro De/Até) ===
async function renderRelPrestacoes(){
  const de  = document.getElementById('relDe')?.value || '';
  const ate = document.getElementById('relAte')?.value || '';

  const arr = (await carregarPrestacoes())
    .filter(p=>{
      // REMOVIDO: filtro por empresa
      if (p.fechado) return false;
      const d = p.ini || p.periodoIni || '';
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      return true;
    })
    .sort((a,b)=> String(b.fim||b.periodoFim||'').localeCompare(String(a.fim||a.periodoFim||'')));

  const tb = document.getElementById('tbodyRelatorios');
  tb.innerHTML = arr.map(r=>{
    const pagos   = sumPagos(r);
    const aPagar  = toNum(r?.resumo?.aPagar ?? r?.resumo?.a_pagar ?? r?.resumo?.pagar);
    const aberto  = Math.max(aPagar - pagos, 0);

    const canDel = !!(
      window.UserAuth?.isAdmin?.()
      || window.IS_ADMIN
      || (typeof canDeletePrest === 'function' && canDeletePrest(r))
    );

    const itemFechar  = `<button class="mi" data-rel="fechar"  role="menuitem">Fechar semana</button>`;
    const itemEditar  = `<button class="mi" data-rel="editar"  role="menuitem">Editar</button>`;
    const itemExcluir = canDel ? `<button class="mi danger" data-rel="excluir" role="menuitem">Excluir</button>` : ``;

    const periodo = `${fmtData(r.ini || r.periodoIni)} a ${fmtData(r.fim || r.periodoFim)}`;
    const pid = String(r.id ?? r.uid ?? r.key ?? r._id ?? '');

    return `<tr data-id="${pid}" data-prest-id="${pid}" data-uid="${pid}">
      <td>${getNomeGerente(r)}</td>
      <td>${safe(periodo)}</td>
      <td>${fmtBRL(r.resumo?.coletas || 0)}</td>
      <td>${fmtBRL(r.resumo?.despesas || 0)}</td>
      <td>${fmtBRL(aPagar)}</td>
      <td>${fmtBRL(pagos)}</td>
      <td>${fmtBRL(aberto)}</td>
      <td>
        <div class="rel-acts">
          <span class="rel-dd" data-dd>
            <button class="btn sm" data-dd-toggle data-id="${pid}" aria-haspopup="true" aria-expanded="false">Opções ▾</button>
            <div class="rel-menu" data-dd-menu role="menu">
              ${itemFechar}
              ${itemEditar}
              ${itemExcluir}
            </div>
          </span>
          <button class="btn ghost sm" data-rel="visualizar">Visualizar</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8">Nenhuma prestação encontrada.</td></tr>';
}
window.renderRelPrestacoes = renderRelPrestacoes;

// Fallback de permissão: se não existir canDeletePrest, usa isAdmin
if (typeof window.canDeletePrest !== 'function') {
  window.canDeletePrest = function () {
    return !!(window.currentUser && window.currentUser?.role === 'admin');
  };
}

async function renderPrestFechadas(){
  const de  = document.getElementById('fechDe')?.value || '';
  const ate = document.getElementById('fechAte')?.value || '';

  const arr = (await carregarPrestacoes())
    .filter(p=>{
      // REMOVIDO: filtro por empresa
      if (!p.fechado) return false;
      const d = p.ini || p.periodoIni || '';
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      return true;
    })
    .sort((a,b)=> String(b.fechadoEm||'').localeCompare(String(a.fechadoEm||'')));

  const tb = document.getElementById('tbodyFechadas');
  tb.innerHTML = arr.map(r=>{
    const pagos   = sumPagos(r);
    const aPagar  = toNum(r?.resumo?.aPagar ?? r?.resumo?.a_pagar ?? r?.resumo?.pagar);
    const aberto  = Math.max(aPagar - pagos, 0);

    const canDel = !!(
      window.UserAuth?.isAdmin?.()
      || window.IS_ADMIN
      || (typeof canDeletePrest === 'function' && canDeletePrest(r))
    );

    const itemExcluir = canDel ? `<button class="mi danger" data-rel="excluir" role="menuitem">Excluir</button>` : ``;
    const periodo = `${fmtData(r.ini || r.periodoIni)} a ${fmtData(r.fim || r.periodoFim)}`;
    const pid = String(r.id ?? r.uid ?? r.key ?? r._id ?? '');

    return `<tr data-id="${pid}" data-prest-id="${pid}" data-uid="${pid}">
      <td>${getNomeGerente(r)}</td>
      <td>${safe(periodo)}</td>
      <td>${fmtBRL(r.resumo?.coletas || 0)}</td>
      <td>${fmtBRL(r.resumo?.despesas || 0)}</td>
      <td>${fmtBRL(aPagar)}</td>
      <td>${fmtBRL(pagos)}</td>
      <td>${fmtBRL(aberto)}</td>
      <td>
        <div class="rel-acts">
          <span class="pill-oculta">Fechada</span>
          <span class="rel-dd" data-dd>
            <button class="btn sm" data-dd-toggle data-id="${pid}" aria-haspopup="true" aria-expanded="false">Opções ▾</button>
            <div class="rel-menu" data-dd-menu role="menu">
              ${itemExcluir}
              <button class="mi" data-rel="reabrir" role="menuitem">Reabrir</button>
            </div>
          </span>
          <button class="btn ghost sm" data-rel="visualizar">Visualizar</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8">Nenhuma prestação finalizada.</td></tr>';
}
window.renderPrestFechadas = renderPrestFechadas;

// Colocar ANTES de qualquer chamada a esta função
window.viewPrestImage = viewPrestImage;

async function viewPrestImage(id){
  const arr = await carregarPrestacoes();
  const r = arr.find(x => x.id === id);
  if(!r){ alert("Prestação não encontrada."); return; }

  const dataURL = window.prestToDataURL ? window.prestToDataURL(r) : null;
  const w = window.open('', 'img_prestacao');
  if(!w){ alert('Popup bloqueado.'); return; }

  w.document.write(
    '<html><head><meta charset="utf-8"><title>Prestação</title></head>' +
    '<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;">' +
    '<img src="' + dataURL + '" style="max-width:100vw;max-height:100vh"/>' +
    '</body></html>'
  );
  w.document.close();
}


// Um único listener para abrir/fechar menu e disparar ações
(function bindRelatoriosUI(){
  if (window.__relUIBound) return; window.__relUIBound = true;

  document.addEventListener('click', (e)=>{
    const t = e.target;

// Toggle do dropdown (DENTRO da célula)
const toggle = t.closest('[data-dd-toggle]');
if (toggle){
  if (window.__REL_OPTS_PORTAL__) {      // <-- ADICIONE ESTA LINHA
    e.preventDefault();                   //     se o popover novo está ligado,
    return;                               //     não abra o dropdown antigo
  }
  e.preventDefault();
  const dd = toggle.closest('[data-dd]');
  document.querySelectorAll('.rel-dd.open').forEach(x=>x!==dd && x.classList.remove('open'));
  dd.classList.toggle('open');
  return;
}



    // Itens de ação (menu ou botões "Visualizar")
    const act = t.closest('[data-rel]');
    if (act){
      e.preventDefault();
      const tr = act.closest('tr');
      const id = tr?.dataset?.id;
      const op = act.dataset.rel;
    
      // fecha o dropdown se veio dele
      act.closest('.rel-dd')?.classList.remove('open');
    
      if (op === 'visualizar') return viewPrestImage?.(id);
      if (op === 'editar')     return editPrest?.(id);
      if (op === 'excluir')    return deletePrest?.(id);
      if (op === 'fechar'){
        if (confirm('Fechar esta semana? Depois você não poderá lançar nesta prestação.')){
          return fecharSemanaById?.(id);
        }
        return;
      }
      if (op === 'reabrir')    return reopenWeek?.(id); // se existir
      return;
    }
    
    // Clique fora fecha qualquer dropdown aberto
    if (!t.closest('.rel-dd')) {
      document.querySelectorAll('.rel-dd.open').forEach(x=>x.classList.remove('open'));
    }
  }, {capture:true});
})();


// Filtros da "Finalizadas"
document.getElementById('btnFechAplicar')?.addEventListener('click', renderPrestFechadas);
['fechDe','fechAte'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change', renderPrestFechadas);
});

  // EDITAR: carrega TUDO na tela de prestações (ordem segura)
// EDITAR: carrega TUDO na tela de prestações (ordem segura)
async function editPrest(id){
  const arr = await carregarPrestacoes();
  const r = arr.find(function(x) { return x.id === id; });
  if(!r){ alert("Prestação não encontrada."); return; }

  // Marca que está editando - ✅ INCLUI O SALDO INFO
  window.__prestBeingEdited = { 
    id: r.id,
    saldoInfo: r.saldoInfo || null
  };

  switchTab('prest');
  fillPcGerentes();

  const sel = document.getElementById('pcGerente');
  if (sel && r.gerenteId && ![].slice.call(sel.options).some(function(o) { return o.value === r.gerenteId; })) {
    const opt = document.createElement('option'); 
    opt.value = r.gerenteId; 
    opt.textContent = '(excluído)'; 
    sel.appendChild(opt);
  }
  if (sel) sel.value = r.gerenteId || '';

  // Migração de vales (backfill se necessário)
  const migVale = (!r.valeParcAplicado || r.valeParcAplicado.length === 0)
    ? (window.__backfillValeParcFromPagamentos ? window.__backfillValeParcFromPagamentos(r.pagamentos, r.gerenteId) : [])
    : (r.valeParcAplicado || []);

  // ✅ CARREGAR TODOS OS DADOS

prestacaoAtual = {
  despesas:   ((r.dados?.despesas || r.despesas) || []).map(function(d) { return Object.assign({}, d); }),
  pagamentos: ((r.dados?.pagamentos || r.pagamentos) || []).map(function(p) { return Object.assign({}, p); }),
  coletas:    ((r.dados?.coletas || r.coletas) || []).map(function(c) { return Object.assign({}, c); }),
  vales:      ((r.dados?.vales || r.vales) || []).map(function(v) { return Object.assign({}, v); }),
  valeSelec:  ((r.dados?.valesSel || r.valesSel) || []).map(function(v) { return Object.assign({}, v); }),
  resumo:     Object.assign({}, (r.dados?.resumo || r.resumo) || {}),
  saldoInfo:  r.dados?.saldoInfo || r.saldoInfo || null,
  valeParcAplicado: migVale.map(function(x) { return Object.assign({}, x); })
};

  // Preencher período
  document.getElementById('pcIni').value = r.ini || '';
  document.getElementById('pcFim').value = r.fim || '';

  // Preencher campos extras do resumo
  const rs = prestacaoAtual.resumo || {};
  document.getElementById('pcValorExtra').value   = rs.valorExtra || 0;
  document.getElementById('pcAdiant').value       = rs.adiant     || 0;
  document.getElementById('pcDeveAnterior').value = rs.deveAnt    || 0;
  document.getElementById('pcDivida').value       = rs.divida     || 0;
  document.getElementById('pcCredito').value      = rs.credito    || 0;

  // ✅ RENDERIZAR TODAS AS SEÇÕES (incluindo coletas!)
  try {
    if (typeof pcRenderColetas === 'function') {
      pcRenderColetas();
    }
  } catch(e) {
    console.warn('Erro ao renderizar coletas:', e);
  }

  try { pcRender(); } catch(e) { console.warn('pcRender:', e); }
  try { pgRender(); } catch(e) { console.warn('pgRender:', e); }
  try { renderDespesas(); } catch(e) { console.warn('renderDespesas:', e); }
  try { renderValesPrestacao(); } catch(e) { console.warn('renderValesPrestacao:', e); }
  try { pcCalcular(); } catch(e) { console.warn('pcCalcular:', e); }

  // Scroll suave para o formulário
  const form = document.getElementById('prestContas');
  if (form) {
    form.scrollIntoView({behavior:'smooth', block:'start'});
  }
}

// ===== EXCLUIR PRESTAÇÃO (APENAS ADMIN) =====
async function deletePrest(id) {
  // Verifica se é admin
  const currentUser = window.UserAuth?.currentUser?.();
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Apenas administradores podem excluir prestações.');
    return;
  }

  const arr = await carregarPrestacoes();
  const idx = arr.findIndex(x => x.id === id);
  
  if (idx === -1) {
    alert('Prestação não encontrada.');
    return;
  }

  const prestacao = arr[idx];
  const gerenteNome = prestacao.gerenteNome || '(desconhecido)';
  const periodo = (prestacao.ini || '') + ' a ' + (prestacao.fim || '');
  
  // Confirmação dupla
  if (!confirm(
    `⚠️ ATENÇÃO! Deseja realmente EXCLUIR a prestação?\n\n` +
    `Gerente: ${gerenteNome}\n` +
    `Período: ${periodo}\n` +
    `Valor: ${fmtBRL(prestacao.resumo?.aPagar || 0)}\n\n` +
    `Esta ação NÃO pode ser desfeita!`
  )) {
    return;
  }

  // Segunda confirmação
  if (!confirm('Tem certeza ABSOLUTA? Esta é sua última chance!')) {
    return;
  }

  try {
    // ✅ 1. AJUSTAR SALDO ACUMULADO (remover saldo da prestação excluída)
    if (window.SaldoAcumulado && prestacao.saldoInfo?.usandoSaldoAcumulado) {
      const empresaId = prestacao.empresaId || (window.getCompany ? window.getCompany() : 'BSX');
      const saldoAtual = window.SaldoAcumulado.getSaldo(prestacao.gerenteId, empresaId);
      const saldoPrestacao = prestacao.saldoInfo.saldoCarregarNovo || 0;
      
      // Remove o saldo desta prestação
      const novoSaldo = Math.max(0, saldoAtual - saldoPrestacao);
      window.SaldoAcumulado.setSaldo(prestacao.gerenteId, empresaId, novoSaldo);
      
      console.log('🔄 Saldo ajustado após exclusão:', {
        saldoAtual,
        saldoPrestacao,
        novoSaldo
      });
    }

    // ✅ 2. DELETAR DO SUPABASE E LOCALSTORAGE
    if (typeof window.deletarPrestacaoGlobal === 'function') {
      await window.deletarPrestacaoGlobal(id);
    } else {
      // Fallback para localStorage
      arr.splice(idx, 1);
      localStorage.setItem(DB_PREST, JSON.stringify(arr));
    }

    // ✅ 4. REGISTRAR NO HISTÓRICO/AUDITORIA
    if (window.AuditLog && typeof window.AuditLog.log === 'function') {
      window.AuditLog.log('prestacao_excluida', {
        id: prestacao.id,
        gerente: gerenteNome,
        gerenteId: prestacao.gerenteId,
        periodo: periodo,
        valor: fmtBRL(prestacao.resumo?.aPagar || 0),
        empresa: window.getCompany ? window.getCompany() : 'BSX'
      });
    }

    // ✅ 5. NOTIFICAR USUÁRIO
    if (typeof window.showNotification === 'function') {
      window.showNotification('Prestação excluída com sucesso!', 'success');
    } else {
      alert('✅ Prestação excluída com sucesso!');
    }

    // ✅ 6. ATUALIZAR INTERFACE
    try {
      if (typeof window.renderRelPrestacoes === 'function') {
        window.renderRelPrestacoes();
      }
      if (typeof window.renderPrestFechadas === 'function') {
        window.renderPrestFechadas();
      }
      if (typeof window.__syncAbertasMirror === 'function') {
        window.__syncAbertasMirror();
      }
    } catch (e) {
      console.warn('Erro ao atualizar interface:', e);
    }

    console.log('✅ Prestação excluída:', id);

  } catch (error) {
    console.error('Erro ao excluir prestação:', error);
    alert('❌ Erro ao excluir prestação: ' + error.message);
  }
}

// Expor globalmente
window.deletePrest = deletePrest;
window.excluirPrestacao = deletePrest;
window.relExcluirPrest = deletePrest;
window.excluirPrestacaoRel = deletePrest;
  
   // CALCULO RELATÓRIO DE RECEBIMENTOS DAS PRESTAÇÕES
   async function renderResultado(){
    const de  = document.getElementById('resDataDe')?.value || '';
    const ate = document.getElementById('resDataAte')?.value || '';
    const q   = (document.getElementById('resBusca')?.value || '').toLowerCase();
  
    const arr = (await carregarPrestacoes())
  .filter(p=>{
    const d = p.ini || '';
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
  });

    const fmtPct = (num, den) => {
      const n = Number(num)||0, d = Number(den)||0;
      if (d <= 0) return '0,00%';
      return ((n/d)*100).toFixed(2).replace('.',',') + '%';
    };
  
    const mapa = new Map();
  
    for (const p of arr){
      const nome = (findGerenteInfo(p.gerenteId)?.nome || p?.gerenteNome || '(excluído)');
      if (q && !nome.toLowerCase().includes(q)) continue;
  
      const aPagar = toNum(p?.resumo?.aPagar ?? p?.resumo?.a_pagar ?? p?.resumo?.pagar);
  
      const pagamentos = []
        .concat(Array.isArray(p.pagamentos)        ? p.pagamentos        : [])
        .concat(Array.isArray(p.pagamentosNormais) ? p.pagamentosNormais : [])
        .filter(x => !x?.cancelado);
  
      const adiantamentoPago = pagamentos
        .filter(x => String(x.forma||'').toUpperCase() === 'ADIANTAMENTO')
        .reduce((s, x)=> s + toNum(x.valor), 0);
  
      const recebido = pagamentos
        .filter(x => {
          const f = String(x.forma||'').toUpperCase();
          return f !== 'ADIANTAMENTO' && f !== 'VALE';
        })
        .reduce((s, x)=> s + toNum(x.valor), 0);
  
      const aberto = Math.max(aPagar - (recebido + adiantamentoPago), 0);
  
      const cur = mapa.get(nome) || { valor:0, recebido:0, aberto:0, adiant:0 };
      cur.valor    += aPagar;
      cur.recebido += recebido;
      cur.adiant   += adiantamentoPago;
      cur.aberto   += aberto;
      mapa.set(nome, cur);
    }
  
    const rows = [...mapa.entries()].map(([nome, v])=>{
      const sit = v.aberto <= 0 ? 'PAGO' : (v.recebido > 0 || v.adiant > 0 ? 'PAGO PARCIAL' : 'EM ABERTO');
      return { nome: safe(nome), valor:v.valor, recebido:v.recebido, aberto:v.aberto, adiant:v.adiant, sit };
    }).sort((a,b)=> b.aberto - a.aberto);
  
    const tb = document.getElementById('tbodyResultado');
    tb.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.nome}</td>
        <td>${fmtBRL(r.valor)}</td>
        <td>${r.sit}</td>
        <td>${fmtBRL(r.aberto)}</td>
        <td>${fmtBRL(r.adiant)}</td>
        <td style="color:green;font-weight:bold">${fmtBRL(r.recebido)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6">Sem dados para o período.</td></tr>';
  
    // totais
    const totValor = rows.reduce((a,b)=> a + b.valor ,0);
    const totRec   = rows.reduce((a,b)=> a + b.recebido ,0);
    const totAdi   = rows.reduce((a,b)=> a + b.adiant,0);
    const totAber  = rows.reduce((a,b)=> a + b.aberto,0);
  
    // garante um único <tfoot>
    const table = tb.closest('table');
    table.querySelectorAll('tfoot').forEach(tf => tf.remove());
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
      <tr style="font-weight:bold;background:#f3f4f6">
        <td style="text-align:right">Totais:</td>
        <td>${fmtBRL(totValor)}</td>
        <td></td>
        <td>${fmtBRL(totAber)} <small>(${fmtPct(totAber, totValor)})</small></td>
        <td>${fmtBRL(totAdi)} <small>(${fmtPct(totAdi, totValor)})</small></td>
        <td style="color:green">${fmtBRL(totRec)} <small>(${fmtPct(totRec, totValor)})</small></td>
      </tr>
    `;
    table.appendChild(tfoot);
  
    // painel
    document.getElementById('resTotReceber').textContent = fmtBRL(totValor);
    document.getElementById('resTotRecebido').textContent= `${fmtBRL(totRec)} (${fmtPct(totRec, totValor)})`;
    document.getElementById('resTotAberto').textContent  = `${fmtBRL(totAber)} (${fmtPct(totAber, totValor)})`;
    document.getElementById('resPerc').textContent       = fmtPct(totRec, totValor);
  
    const maior = rows[0];
    document.getElementById('resMaiorInad').textContent = maior
      ? `${maior.nome} — ${fmtBRL(maior.aberto)}`
      : '—';
  }
  window.IS_ADMIN = true;

  function showRelTab(which){
    // mostra/oculta caixas
    const prest = document.getElementById('relPrestacoesBox');
    const res   = document.getElementById('relResultadoBox');
    if (!prest || !res) return;
  
    if (which === 'res'){
      prest.classList.add('hidden');
      res.classList.remove('hidden');
      // opcional: focar o filtro do Resultado
      document.getElementById('resDataDe')?.focus();
    } else {
      // default: prestações salvas
      res.classList.add('hidden');
      prest.classList.remove('hidden');
      // mostra o filtro de período geral
      document.getElementById('relFiltroPeriodo')?.classList.remove('hidden');
    }
    // guarda preferência
    try { sessionStorage.setItem('rel_sub', which); } catch {}
  }
  // carrega a aba salva e renderiza
(function initRelSub(){
  const saved = sessionStorage.getItem('rel_sub') || 'prest';
  showRelTab(saved);
  if (saved === 'res') renderResultado?.(); else renderRelPrestacoes?.();
})();


if (!window.showRelTab) window.showRelTab = showRelTab;

  // Filtro de período (Prestações salvas)
document.getElementById('btnRelAplicar')?.addEventListener('click', ()=>{
  showRelTab('prest');
  renderRelPrestacoes?.();
});

// opcional: aplicar automaticamente ao mudar as datas
['relDe','relAte'].forEach(id=>{
  const el = document.getElementById(id);
  el?.addEventListener('change', ()=>{
    showRelTab('prest');
    renderRelPrestacoes?.();
  });
});

  
    
  document.getElementById('btnResAtualizar')?.addEventListener('click', renderResultado);
  document.getElementById('resBusca')?.addEventListener('input', renderResultado);
  document.getElementById('resDataDe')?.addEventListener('change', renderResultado);
  document.getElementById('resDataAte')?.addEventListener('change', renderResultado);
  document.getElementById('btnResImprimir')?.addEventListener('click', ()=> window.print());


// sempre trabalha em data local (YYYY-MM-DD)
function __toISO(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function __ymd(iso){ if(!iso) return null; const [y,m,d] = iso.split('-').map(Number); const dt = new Date(y, (m||1)-1, (d||1)); return isNaN(dt) ? null : dt; }
function __addDays(iso,n){ const d = __ymd(iso) || new Date(); d.setDate(d.getDate()+n); return __toISO(d); }
function __startOfWeekSeg(iso){
  const d = __ymd(iso) || new Date();
  const wd = (d.getDay()+6)%7; // 0=seg … 6=dom
  d.setDate(d.getDate()-wd);
  return __toISO(d);
}
function __endOfWeekDom(iso){ return __addDays(__startOfWeekSeg(iso), 6); }
// Converte "R$ 1.234,56", "1.234,56", "1234.56" → número
function toNum(v){
  if (typeof v === 'number') return v || 0;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s|R\$\s?/g, '').replace(/\./g, '').replace(/,/g, '.'));
  return isNaN(n) ? 0 : n;
}

// Soma pagamentos (principal + "normais") em R$, ignorando cancelados
function sumPagos(p){
  const itens = []
    .concat(Array.isArray(p?.pagamentos)        ? p.pagamentos        : [])
    .concat(Array.isArray(p?.pagamentosNormais) ? p.pagamentosNormais : [])
    .filter(x => !x?.cancelado); // <<< apenas esta linha é a correção

  return itens.reduce((s,x)=> s + toNum(x?.valor), 0);
}

// Escapa texto para HTML seguro
function safe(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function findGerenteInfo(gerenteId){
  const gid = String(gerenteId ?? '');
  
  // 1) Tenta window.gerentes (carregado do Supabase)
  const L = Array.isArray(window.gerentes) ? window.gerentes : [];
  const found = L.find(x => String(x?.uid ?? x?.id ?? '') === gid);
  if (found) return found;
  
  // 2) Tenta cache do GerentesLoader
  if (window.GerentesLoader?.getCache) {
    const cache = window.GerentesLoader.getCache();
    const foundInCache = cache.find(x => String(x?.uid ?? x?.id ?? '') === gid);
    if (foundInCache) return foundInCache;
  }
  
  return null;
}

function getNomeGerente(recPrest){
  // 1. Tenta buscar na lista de gerentes ativos do Supabase
  const g = findGerenteInfo(recPrest?.gerenteId);
  if (g?.nome) return safe(g.nome);
  
  // 2. Usa nome salvo na prestação (sempre salvo no snapshot)
  if (recPrest?.gerenteNome) return safe(recPrest.gerenteNome);
  
  // 3. Se window.gerentes não carregou ainda, indica isso
  if (!window.gerentes || window.gerentes.length === 0) {
    console.warn('[Relatórios] Gerentes não carregados do Supabase - usando nome da prestação');
    return safe(recPrest?.gerenteNome || '(carregando...)');
  }
  
  // 4. Gerente realmente foi removido
  return safe('(removido)');
}


// NORMALIZA qualquer par ini/fim para exatamente seg→dom
function __normalizeSegDom(iniRaw, fimRaw){
  const base = iniRaw || fimRaw || __toISO(new Date());
  const seg  = __startOfWeekSeg(base);
  const dom  = __endOfWeekDom(seg);
  return { seg, dom };
}

// *** NOVO: devolve a SEMANA SEGUINTE (seg→dom) a partir de um ini/fim qualquer
function __nextWeekRange(iniRaw, fimRaw){
  const { seg, dom } = __normalizeSegDom(iniRaw, fimRaw);
  const nextSeg = __addDays(dom, 1);        // segunda seguinte
  const nextDom = __addDays(nextSeg, 6);    // domingo seguinte
  return { nextSeg, nextDom };
}

const DB_PREST_CARRY = 'DB_PREST_CARRY';

function __getCarry(){
  try { return JSON.parse(localStorage.getItem(DB_PREST_CARRY)||'[]'); } catch(_) { return []; }
}
function __setCarry(arr){
  localStorage.setItem(DB_PREST_CARRY, JSON.stringify(arr));
}

function __putCarry({gerenteId, gerenteNome, periodoIni, periodoFim, deveAnterior, adiantamento, fromPrestId}){
  const carr = __getCarry();
  if (carr.some(c => c.fromPrestId === fromPrestId)) return; // evita duplicar
  carr.push({
    id: (crypto?.randomUUID ? crypto.randomUUID() : ('c_'+Date.now())),
    gerenteId: String(gerenteId||''),
    gerenteNome,
    periodoIni,
    periodoFim,
    deveAnterior: Number(deveAnterior||0),
    adiantamento: Number(adiantamento||0),
    fromPrestId,
    createdAt: new Date().toISOString()
  });
  __setCarry(carr);
}

function __consumeCarry(gerenteId, periodoIni, periodoFim){
  const carr = __getCarry();
  let changed = false;
  carr.forEach(c=>{
    if (String(c.gerenteId) === String(gerenteId) &&
        c.periodoIni === periodoIni &&
        c.periodoFim === periodoFim &&
        !c.consumedAt) {
      c.consumedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) __setCarry(carr);
}


// ====== FECHAR SEMANA ======
async function fecharSemanaById(prestId, {forcar=false}={}){
  // Lê do mesmo DB das prestações salvas
  const arr = (await carregarPrestacoes());
  const idx = arr.findIndex(p => String(p.id)===String(prestId));
  if (idx<0){ alert('Prestação não encontrada.'); return; }

  const atual = arr[idx];
  if (atual.fechado){ alert('Esta semana já está fechada.'); return; }

  // pega ini/fim independente de como foi salvo e normaliza para seg→dom
  const iniRaw = atual.ini || atual.periodoIni || atual.dataIni || '';
  const fimRaw = atual.fim || atual.periodoFim || atual.dataFim || '';
  const { seg:curIni, dom:curFim } = __normalizeSegDom(iniRaw, fimRaw);

  // só depois da próxima segunda (a menos que force)
  const hoje    = __toISO(new Date());
  const proxSeg = __addDays(curFim, 1);
  if (!forcar && hoje < proxSeg){
    const ok = confirm('Ainda não chegou a próxima segunda-feira.\nDeseja fechar esta semana mesmo assim?');
    if (!ok) return;
  }

// ---- DERIVAÇÃO ROBUSTA: restam e adiantamento ----
const resumo = atual.resumo || {};

// 1) A Pagar (com vários fallbacks; se não vier, calcula)
let aPagar = toNum(resumo.aPagar ?? resumo.a_pagar ?? resumo.pagar);
if (!aPagar) {
  const coletas    = toNum(resumo.coletas);
  const despesas   = toNum(resumo.despesas);
  const valorExtra = toNum(resumo.valorExtra);
  const deveAnt    = toNum(resumo.deveAnt ?? resumo.deveAnterior);
  const divida     = toNum(resumo.divida);
  const credito    = toNum(resumo.credito);
  // ajuste esta fórmula se a sua regra for diferente:
  aPagar = (coletas - despesas) + valorExtra + deveAnt + divida - credito;
}

// 2) Pagamentos
const pagamentos = []
  .concat(Array.isArray(atual.pagamentos)        ? atual.pagamentos        : [])
  .concat(Array.isArray(atual.pagamentosNormais) ? atual.pagamentosNormais : []);

const totalAdiantamento = pagamentos
  .filter(x => String((x.forma||x.tipo||'') + '').trim().toUpperCase() === 'ADIANTAMENTO' && !x.cancelado)
  .reduce((s,x)=> s + toNum(x.valor), 0);

const totalRecebidoNormal = pagamentos
  .filter(x => {
    const f = String((x.forma||x.tipo||'') + '').trim().toUpperCase();
    return f !== 'ADIANTAMENTO' && f !== 'VALE';
  })
  .reduce((s,x)=> s + toNum(x.valor), 0);

// 3) RESTAM (usa campo salvo se existir; senão deriva)
let restam = toNum(atual.restam ?? atual.emAberto ?? resumo.restam);
if (!restam && (aPagar || totalRecebidoNormal || totalAdiantamento)) {
  restam = Math.max(aPagar - (totalRecebidoNormal + totalAdiantamento), 0);
}

// 4) Valores finais a carregar
const adiantamento = totalAdiantamento;


  // período da PRÓXIMA semana (seg→dom)
  const { nextSeg, nextDom } = __nextWeekRange(iniRaw, fimRaw);
const nextIni = nextSeg;
const nextFim = nextDom;

  // guarda carry (não cria prestação nova)
  __putCarry({
    gerenteId:   String(atual.gerenteId || ''),
    gerenteNome: atual.gerenteNome,
    periodoIni:  nextIni,
    periodoFim:  nextFim,
    deveAnterior: restam,
    adiantamento: adiantamento,
    fromPrestId:  atual.id
  });
  
  // marca a atual como fechada
  atual.fechado   = true;
  atual.fechadoEm = new Date().toISOString();

  // salva de volta no Supabase E localStorage
  arr[idx] = atual;
  
  // ✅ SALVAR NO SUPABASE (correção principal)
  if (typeof window.salvarPrestacaoGlobal === 'function') {
    try {
      await window.salvarPrestacaoGlobal(atual);
      console.log('✅ Prestação fechada salva no Supabase:', atual.id);
    } catch(e) {
      console.error('❌ Erro ao salvar no Supabase:', e);
      alert('Erro ao salvar no servidor. Tente novamente.');
      return;
    }
  } else {
    // Fallback para localStorage se Supabase não disponível
    localStorage.setItem(DB_PREST, JSON.stringify(arr));
  }
  
  renderRelPrestacoes?.();
  renderPrestFechadas?.();

  alert(
    'Semana fechada.\n' +
    `Próxima semana (seg→dom): ${nextIni} a ${nextFim}\n` +
    `• Deve anterior a carregar: ${fmtBRL(restam)}\n` +
    `• Adiantamento a carregar: ${fmtBRL(adiantamento)}\n\n` +
    'Informações salvas para próxima prestação de contas.'
  );
}
// ===== Relatórios: menu "Opções" flutuante =====
(function bindRelatoriosOpcoes(){
  if (window.__rel_opts_bound) return;
  window.__rel_opts_bound = true;

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-rel-opts], .rel-opts, .btn-opts'); // ajuste se precisar
    if (!btn) return;

    e.preventDefault();

    // ID/obj da prestação (busque do dataset ou da <tr>)
    const tr  = btn.closest('tr');
    const pid = btn.dataset.id || tr?.dataset.id || tr?.getAttribute('data-prest-id') || '';

    // Monte o conteúdo do menu (mostra "Fechar semana" só para admin)
    const isAdmin = !!(window.currentUser && window.currentUser?.role === 'admin');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      ${isAdmin ? `<button class="mi" data-act="fechar" data-id="${pid}">Fechar semana</button>` : ''}
      <button class="mi" data-act="editar" data-id="${pid}">Editar</button>
      <button class="mi" data-act="visualizar" data-id="${pid}">Visualizar</button>
    `;

    // Clique nas ações
    wrap.addEventListener('click', (ev)=>{
      const a = ev.target.closest('.mi'); if (!a) return;
      const act = a.dataset.act, id = a.dataset.id;

      // Dispare suas rotinas existentes (ajuste os nomes se forem outros):
      if (act === 'fechar')      { window.relFecharSemana?.(id); }
      else if (act === 'editar') { window.relEditarPrestacao?.(id); }
      else if (act === 'visualizar') { window.relVisualizarPrestacao?.(id); }

      window.closeFloatingMenu?.();
    });

    // abre fora da tabela
    window.openFloatingMenu(btn, wrap);
  });
})();
/* ====== Opções (contextual) em popover fora da tabela ====== */
(function(){
  if (window.__CTX_OPTS_PORTAL__) return;
  window.__CTX_OPTS_PORTAL__ = true;
  window.__REL_OPTS_PORTAL__ = true;
  let pop=null, btnRef=null;

  // utilidade: chama o 1º handler existente
  function callFirst(names, ...args){
    return names.some(n => typeof window[n] === 'function' && (window[n](...args), true));
  }

  // admin?
  const isAdmin = (()=> {
    if (window.UserAuth?.isAdmin?.()) return true;
    try { return !!JSON.parse(localStorage.getItem('bsx_user_v1')||'null')?.isAdmin; } catch(_) { return false; }
  })();

  // ---- helpers de posicionamento/fechamento
  function closePop(){
    if (!pop) return;
    pop.remove(); pop=null;
    if (btnRef){ btnRef.setAttribute('aria-expanded','false'); btnRef.classList.remove('is-open'); }
    btnRef=null;
    document.removeEventListener('click', onDocClick, true);
    window.removeEventListener('scroll', onRelayout, true);
    window.removeEventListener('resize', onRelayout);
  }
  function onDocClick(e){ if (pop && !pop.contains(e.target) && !btnRef.contains(e.target)) closePop(); }
  function onRelayout(){ if (pop && btnRef) positionPop(); }
  function positionPop(){
    const r = btnRef.getBoundingClientRect(), sx=scrollX, sy=scrollY, vw=innerWidth, vh=innerHeight;
    pop.style.visibility='hidden'; pop.style.left='-9999px'; pop.style.top='-9999px';
    const openBelow = (r.bottom + 8 + (pop.offsetHeight||220)) <= vh;
    let x = r.left + sx;
    let y = (openBelow ? r.bottom + 6 : r.top - (pop.offsetHeight||220) - 6) + sy;
    const w = pop.offsetWidth || 240;
    if (x + w > vw + sx - 8) x = vw + sx - w - 8;
    if (x < sx + 8) x = sx + 8;
    pop.style.left = x+'px'; pop.style.top = y+'px'; pop.style.visibility='visible';
  }

  // ---- id robusto
  function getRowId(btn){
    const tr = btn.closest('tr');
    return (
      btn.dataset.id ||
      tr?.dataset?.id ||
      tr?.dataset?.uid ||
      tr?.getAttribute?.('data-id') ||
      tr?.getAttribute?.('data-uid') || ''
    );
  }
  // remove dropdown antigo (se existir)
  function killLegacyDropdown(btn){
    const scope = btn.closest('td,th') || btn.parentElement;
    scope?.querySelectorAll('.dd, .dd-menu, [data-dd-panel]').forEach(el=>el.remove());
  }

  // ---------- AÇÕES: DESPESAS ----------
  function despGetAll(){ try { return JSON.parse(localStorage.getItem(DB_DESPESAS)||'[]')||[]; } catch(_) { return []; } }
  function despSave(arr){ localStorage.setItem(DB_DESPESAS, JSON.stringify(arr)); window.despesas = arr; window.renderDespesas?.(); }
  function despFindIndex(arr, id){
    return arr.findIndex(x => [x?.uid, x?.id, x?.key].some(v => String(v)===String(id)));
  }
  function despToggleHide(id){
    const arr = despGetAll(); const i = despFindIndex(arr,id);
    if (i<0) return alert('Despesa não encontrada.');
    const r = arr[i] || {};
    const novo = !(r.isHidden || r.oculto || r.hidden);
 r.isHidden = novo;   // usado no render da página Despesas
 r.oculto   = novo;   // retrocompatibilidade
 r.hidden   = novo;   // retrocompatibilidade
    arr[i] = r; despSave(arr);
  }
  function despDelete(id){
    if (!isAdmin) { alert('Apenas ADMIN pode excluir.'); return; }
    if (!confirm('Excluir esta despesa?')) return;
    const arr = despGetAll(); const i = despFindIndex(arr,id);
    if (i<0) return alert('Despesa não encontrada.');
    arr.splice(i,1); despSave(arr);
  }

  // ---------- POPS ESPECÍFICOS ----------
  async function openPrestPop(btn){
    // monta menu de PRESTAÇÕES (aberta x fechada)
    closePop();
    btnRef = btn; btnRef.setAttribute('aria-expanded','true'); btnRef.classList.add('is-open');
    killLegacyDropdown(btnRef);

    const id = getRowId(btnRef);
    const list = await carregarPrestacoes();
    const rec  = list.find(x => [x.id,x.uid,x.key,x._id].some(v=> String(v)===String(id))) || null;
    const isClosed = !!rec?.fechado;

    pop = document.createElement('div');
    pop.className = 'prest-pop';
    pop.innerHTML = `
      ${!isClosed ? `<div class="item" data-act="fechar">Fechar semana</div>` : ``}
      ${ isClosed ? `<div class="item" data-act="reabrir">Reabrir</div>`       : ``}
      <div class="item" data-act="editar">Editar</div>
      ${isAdmin ? `<div class="item danger" data-act="excluir">Excluir</div>` : ``}
    `;
    document.body.appendChild(pop);

    pop.addEventListener('click', (e)=>{
      const it = e.target.closest('.item'); if (!it) return;
      const act = it.dataset.act; closePop();
      if (act==='fechar')  callFirst(['fecharSemanaById','fecharPrestacao','relFecharSemana','fecharSemanaPrestacao'], id);
      if (act==='reabrir') callFirst(['reopenWeek','reabrirPrestacao','relReabrirPrestacao'], id);
      if (act==='editar')  callFirst(['editPrest','editarPrestacao','relEditarPrest','editarPrestacaoRel'], id);
      if (act==='excluir') callFirst(['deletePrest','excluirPrestacao','relExcluirPrest','excluirPrestacaoRel'], id);
    });

    positionPop();
    setTimeout(()=>{ document.addEventListener('click', onDocClick, true); window.addEventListener('scroll', onRelayout, true); window.addEventListener('resize', onRelayout); },0);
  }
  async function reopenWeek(id){
    const arr = await carregarPrestacoes();
    const i = arr.findIndex(p => String(p.id)===String(id));
    if (i < 0) { alert('Prestação não encontrada.'); return; }
  
    const prest = arr[i];
  
    // apaga carries gerados a partir desta prestação
    let carr = __getCarry();
    carr = carr.filter(c => c.fromPrestId !== prest.id);
    __setCarry(carr);
  
    // marca como aberta novamente
    prest.fechado = false;
    delete prest.fechadoEm;
  
    // salva no Supabase e localStorage
    if (typeof window.salvarPrestacaoGlobal === 'function') {
      await window.salvarPrestacaoGlobal(prest);
    } else {
      localStorage.setItem(DB_PREST, JSON.stringify(arr));
    }
    renderRelPrestacoes?.();
    renderPrestFechadas?.();
  
    // garante que a aba mostrada seja a de Prestações salvas
    try { sessionStorage.setItem('rel_sub','prest'); } catch(_){}
    try { showRelTab?.('prest'); } catch(_){}
    try { showPage?.('prest-rel'); } catch(_){ location.hash = '#prest-rel'; }
  
    // fecha popover, se estiver aberto
    try { document.querySelector('.prest-pop')?.remove(); } catch(_){}
  }
  // ⇩ exporta para o escopo global (o menu chama por nome)
  window.reopenWeek = reopenWeek;
  
  
  function openDespesasPop(btn){
    // monta menu de DESPESAS (ocultar/desocultar, editar, excluir)
    closePop();
    btnRef = btn; btnRef.setAttribute('aria-expanded','true'); btnRef.classList.add('is-open');
    killLegacyDropdown(btnRef);

    const id = getRowId(btnRef);
    const arr = despGetAll();
    const row = arr.find(x => [x?.uid,x?.id,x?.key].some(v => String(v)===String(id))) || {};
    const hideLabel = (row.isHidden || row.oculto || row.hidden) ? 'Desocultar' : 'Ocultar';

    pop = document.createElement('div');
    pop.className = 'prest-pop';
    pop.innerHTML = `
      <div class="item" data-act="toggle-hide">${hideLabel}</div>
      <div class="item" data-act="editar">Editar</div>
      ${isAdmin ? `<div class="item danger" data-act="excluir">Excluir</div>` : ``}
    `;
    document.body.appendChild(pop);

    pop.addEventListener('click', (e)=>{
      const it = e.target.closest('.item'); if (!it) return;
      const act = it.dataset.act; closePop();
      if (act==='toggle-hide') despToggleHide(id);
      if (act==='editar')      callFirst(['editDespesa','openDespesaDialog','__desp_openDialog','editarDespesa'], id);
      if (act==='excluir')     despDelete(id);
    });

    positionPop();
    setTimeout(()=>{ document.addEventListener('click', onDocClick, true); window.addEventListener('scroll', onRelayout, true); window.addEventListener('resize', onRelayout); },0);
  }

  // ---------- Delegação: decide CONTEXTO ----------
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-dd-toggle]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

    if (btnRef === btn) { closePop(); return; } // toggle

    // Se o botão está dentro da página Despesas => menu de Despesas; senão, de Prestações
    if (btn.closest('#pageDespesas') || btn.closest('#tbodyDespesas')) openDespesasPop(btn);
    else                                                               openPrestPop(btn);
  }, true);

  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closePop(); });
})();

// Exportar funções para uso global
window.editPrest = editPrest;
window.viewPrestImage = viewPrestImage;
window.fecharSemanaById = fecharSemanaById;
window.reopenWeek = reopenWeek;
window.renderRelPrestacoes = renderRelPrestacoes;
window.renderPrestFechadas = renderPrestFechadas;
window.renderResultado = renderResultado;