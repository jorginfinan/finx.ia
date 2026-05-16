/* ==== Dashboard - VERSÃO SUPABASE 2025-11-26-v2 ==== */
console.log('🟠🟠🟠 [dashboard.js] VERSÃO SUPABASE 2025-11-26-v2 CARREGADA! 🟠🟠🟠');

/* ==== Util: ler a primeira chave que existir no localStorage ==== */
function fromLS(keys){
  for (const k of keys.filter(Boolean)) {
    try {
      const val = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(val) && val.length) return val;
      if (val && typeof val === 'object' && Object.keys(val).length) return val;
    } catch(_) {}
  }
  return Array.isArray(keys) ? [] : null;
}

/* ==== Getters robustos (preferem globais; caem para várias chaves) ==== */
function getLancs(){
  try { if (Array.isArray(window.lanc)) return window.lanc; } catch(_){}
  return fromLS([
    window.DB_FIN_LANC,            // se existir no seu código
    'bsx_fin_lanc',
    'bsx_fin_lanc_backup',
    'bsx_fin_lanc_bak',
    'lanc'
  ]) || [];
}



async function getPrestacoes(){
  // Tenta carregar do Supabase primeiro
  if (typeof window.carregarPrestacoesGlobal === 'function') {
    try {
      return await window.carregarPrestacoesGlobal();
    } catch(e) {
      console.warn('[Dashboard] Erro ao carregar do Supabase, usando localStorage:', e);
    }
  }
  // Fallback para localStorage
  return fromLS([window.DB_PREST, 'bsx_prest_contas_v1', 'DB_PREST']) || [];
}


/* ==== Saldo do caixa (usa getLancs) ==== */
function calcSaldoCaixaMes(ym){
  const base = getLancs();
  const rowsMes = base.filter(r => String(r.data||'').startsWith(ym));
  const rec = rowsMes
    .filter(r => String(r.status||'').toUpperCase() === 'RECEBIDO')
    .reduce((a,b)=> a + (Number(b.valor)||0), 0);
  const pag = rowsMes
    .filter(r => String(r.status||'').toUpperCase() === 'PAGO')
    .reduce((a,b)=> a + (Number(b.valor)||0), 0);
  return rec - pag;
}

// Limiar padrão (R$ 50) e taxa ideal (4% se não houver outra no window)
const LIMIAR_ALERTA = 350;

function limiar_alerta(despesa,
  limiar = (typeof window.LIMIAR_ALERTA === 'number' ? window.LIMIAR_ALERTA : LIMIAR_ALERTA),
  rate   = (typeof window.IDEAL_RATE      === 'number' ? window.IDEAL_RATE      : 0.04)
){
  if (!despesa) {
    return { atingiu:false, diff:0, ajuda:0, ideal:0, bruta:0 };
  }

  // bruta do mês de referência da própria despesa (mês anterior ao da data)
  const bruta = vendaBrutaRefDaDespesa(despesa.ficha, despesa.data, despesa.periodoIni, despesa.periodoFim);
  const ideal = (Number(bruta)||0) * rate;            // meta (4% da bruta, por padrão)
  const ajuda = Number(despesa.valor)||0;             // valor lançado da ajuda
  const diff = (ideal > 0) ? (ajuda - ideal) : ajuda;                       // diferença = ajuda - ideal

  return {
    atingiu: diff >= Number(limiar||0),               // true se >= R$ 500
    diff, ajuda, ideal, bruta
  };
}


//* Formatação BRL sem redeclarar variável */
if (typeof window.fmtBRL !== 'function') {
  window.fmtBRL = (n) => (Number(n)||0).toLocaleString('pt-BR',
    { style:'currency', currency:'BRL' });
}

/* -------------------- Utilidades simples -------------------- */
const $ = (id) => document.getElementById(id);
const ymNow  = () => new Date().toISOString().slice(0,7);
const ymFirst = (ym) => `${ym}-01`;
const ymLast  = (ym) => {
  const [y,m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0,10);
};

/* Pega dados (preferindo globais, com fallback no localStorage) */
function getDespesas(){
  // ✅ Retorna as despesas já carregadas do Supabase (via loadDespesas)
  if (Array.isArray(window.despesas) && window.despesas.length) {
    return window.despesas;
  }
  // Fallback: tenta carregar se ainda não foi carregado
  console.warn('[Dashboard] Despesas não carregadas ainda, retornando array vazio');
  return [];
}

function getVendas(){
  // ✅ USA APENAS window.vendas (Supabase) - sem fallback localStorage
  return Array.isArray(window.vendas) ? window.vendas : [];
}
function getFichas(){
  // ✅ USA APENAS window.fichas (Supabase) - sem fallback localStorage
  return Array.isArray(window.fichas) ? window.fichas : [];
}

/* Rota/área exibida por ficha */
function rotaByFicha(ficha){
  try {
    if (typeof window.getRotaByFicha === 'function'){
      const r = window.getRotaByFicha(ficha);
      if (r) return r;
    }
  } catch(_){}
  const rec = getFichas().find(f => String(f.ficha)===String(ficha));
  return rec ? (rec.area || rec.rota || '—') : '—';
}


/* -------------------- 1) Saldo do mês (Financeiro) -------------------- */
function calcSaldoCaixaMes(ym){
  const base = Array.isArray(window.lanc) ? window.lanc : [];
  const rowsMes = base.filter(r => String(r.data||'').startsWith(ym));
  const rec = rowsMes.filter(r=> String(r.status||'').toUpperCase()==='RECEBIDO')
                     .reduce((a,b)=> a + (Number(b.valor)||0), 0);
  const pag = rowsMes.filter(r=> String(r.status||'').toUpperCase()==='PAGO')
                     .reduce((a,b)=> a + (Number(b.valor)||0), 0);
  return rec - pag;
}
function renderSaldo(ym){
  const el = $('dashSaldo');
  if (el) el.textContent = window.fmtBRL(calcSaldoCaixaMes(ym));
}
/* ==== Lookup de gerente com fallback (evita "(excluído)") ==== */
// Nome do gerente por UID: tenta window.gerentes, cai para bsx_gerentes_v2

function gerenteNome(uid){
  const uidS = String(uid);

  // 1) tentar na lista já carregada do Supabase
  if (Array.isArray(window.gerentes) && window.gerentes.length){
    const g = window.gerentes.find(x => String(x.uid ?? x.id) === uidS);
    if (g?.nome) return g.nome;
  }

  // 2) Se ainda não carregou, tentar buscar do GerentesLoader
  if (window.GerentesLoader?.getCache) {
    const cache = window.GerentesLoader.getCache();
    const g = cache.find(x => String(x.uid ?? x.id) === uidS);
    if (g?.nome) return g.nome;
  }

  // 3) Não encontrou - retorna carregando ou excluído
  return window.gerentes ? '(excluído)' : '(carregando...)';
}

/* -------------------- 2) Resultado – prestações Abertas -------------------- */
/* ========= Resultado – prestações ABERTAS (detalhado, 1 linha por gerente) ========= */
async function renderDashboardResultado(){
  const q = (document.getElementById('dashResBusca')?.value || '').toLowerCase();
  const arr = (await getPrestacoes()).filter(p => !p.fechado);


  const rows = arr.map(p=>{
    const nome = (p.gerenteNome && p.gerenteNome.trim()) || gerenteNome(p.gerenteId);
    if (q && !nome.toLowerCase().includes(q)) return null;

    const aPagar     = Number(p?.resumo?.aPagar) || 0;
    const pagamentos = Array.isArray(p.pagamentos) ? p.pagamentos : [];

    const adiant = pagamentos
    .filter(x => {
      const f = String(x.forma||'').toUpperCase();
      return f === 'ADIANTAMENTO' && !x.cancelado;
    })
    .reduce((s,x)=> s + (Number(x.valor)||0), 0);

    // ✅ RECEBIDO: Valores recebidos do gerente (PIX, Dinheiro, etc) - EXCLUI pagamentos da empresa
    const recebido = pagamentos
      .filter(x=>{
        const f = String(x.forma||'').toUpperCase();
        // ✅ EXCLUI: ADIANTAMENTO, VALE e DIVIDA_PAGA (pois são pagamentos da empresa para o gerente)
        return f !== 'ADIANTAMENTO' && 
               f !== 'VALE' && 
               f !== 'DIVIDA_PAGA' && 
               !x.cancelado;
      })
      .reduce((s,x)=> s + (Number(x.valor)||0), 0);

    // Calcula restante com arredondamento para evitar problemas de precisão
    const restante = Math.max(Math.round((aPagar - (adiant + recebido)) * 100) / 100, 0);
    
    // ✅ SITUAÇÃO corrigida:
    // - PAGO: quando restante é zero ou muito próximo de zero
    // - PG PARCIAL: quando restante é diferente do valor original (houve pagamento)
    // - EM ABERTO: quando restante é igual ao valor original (nenhum pagamento)
    const situacao = restante <= 0.01 ? 'PAGO' 
                   : restante < aPagar ? 'PG PARCIAL'
                   : 'EM ABERTO';

    return {
      nome,
      valor: aPagar,
      situacao,
      restante,
      adiant,
      recebido,
      periodo: `${(p.ini||'').split('-').reverse().slice(0,2).join('/')}`
               + (p.fim ? `–${(p.fim||'').split('-').reverse().slice(0,2).join('/')}` : '')
    };
  }).filter(Boolean)
    .sort((a,b)=> b.restante - a.restante); // maiores abertos primeiro

  // ====== TABELA ======
  const tb = document.getElementById('dashResBody');
  if (tb){
    tb.innerHTML = rows.map(r=>`
      <tr>
        <td>
          ${r.nome}
          ${r.periodo ? `<div style="color:#6b7280;font-size:12px">${r.periodo}</div>` : ''}
        </td>
        <td style="${r.valor < 0 ? 'color:#b91c1c;font-weight:700' : ''}">
          ${window.fmtBRL(r.valor)}
        </td>
        <td>${r.situacao}</td>
        <td>${window.fmtBRL(r.restante)}</td>
        <td>${window.fmtBRL(r.adiant)}</td>
        <td style="color:green;font-weight:700">${window.fmtBRL(r.recebido)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6">Sem prestações em aberto.</td></tr>';
  }

// ====== TOTAIS / PAINEL ======
  // ✅ Separa valores positivos e negativos CORRETAMENTE
  const totValorPos    = rows.reduce((a,b)=> a + (b.valor > 0 ? b.valor : 0), 0);
  const totValorNegAbs = rows.reduce((a,b)=> a + (b.valor < 0 ? Math.abs(b.valor) : 0), 0);
  const totRec         = rows.reduce((a,b)=> a + b.recebido, 0);
  const totAdi         = rows.reduce((a,b)=> a + b.adiant, 0);
  const totAber        = rows.reduce((a,b)=> a + b.restante, 0);
  const fmtPct         = (n,d)=> (d>0 ? ((n/d)*100).toFixed(2).replace('.',',') : '0,00') + '%';

  // rodapé da tabela
  const foot = document.getElementById('dashResFoot');
  if (foot) foot.innerHTML = `
    <tr style="font-weight:bold;background:#f3f4f6">
      <td style="text-align:right">Totais:</td>
      <td>${window.fmtBRL(totValorPos)}</td>
      <td></td>
      <td>${window.fmtBRL(totAber)}</td>
      <td>${window.fmtBRL(totAdi)}</td>
      <td style="color:green">${window.fmtBRL(totRec)}</td>
    </tr>
  `;

  // painel à direita
  document.getElementById('dashResTotValor')?.replaceChildren(
    document.createTextNode(window.fmtBRL(totValorPos))
  );
  
  // ✅ CORRIGIDO: totRec agora NÃO inclui valores negativos
  document.getElementById('dashResTotRec')?.replaceChildren(
    document.createTextNode(`${window.fmtBRL(totRec)} (${fmtPct(totRec, totValorPos||1)})`)
  );
  
  document.getElementById('dashResTotAber')?.replaceChildren(
    document.createTextNode(`${window.fmtBRL(totAber)} (${fmtPct(totAber, totValorPos||1)})`)
  );
  
  // ✅ CORRIGIDO: Mostra pagamentos separadamente
  document.getElementById('dashResTotPag')?.replaceChildren(
    document.createTextNode(window.fmtBRL(totValorNegAbs))
  );
  
  document.getElementById('dashResPerc')?.replaceChildren(
    document.createTextNode(fmtPct(totRec, totValorPos || 1))
  );

  // maior inadimplência (maior RESTANTE)
  const maior = rows.find(r => r.restante > 0);
  document.getElementById('dashResMaior')?.replaceChildren(
    document.createTextNode(maior ? `${maior.nome} — ${window.fmtBRL(maior.restante)}` : '—')
  );
}
/* -------------------- Ciclo do dashboard -------------------- */
async function refresh(){
  const ym = ($('dashMes')?.value) || ymNow();
  renderSaldo(ym);
  
  // ✅ Garante que despesas estão carregadas do Supabase
  if (typeof loadDespesas === 'function' && (!window.despesas || !window.despesas.length)) {
    await loadDespesas();
  }
  
  // ✅ Garante que fichas estão carregadas do Supabase
  if (typeof window.carregarFichas === 'function' && (!window.fichas || !window.fichas.length)) {
    console.log('[Dashboard] Aguardando fichas do Supabase...');
    await window.carregarFichas();
  }
  
  // ✅ Garante que vendas estão carregadas do Supabase
  if (typeof window.carregarVendas === 'function' && (!window.vendas || !window.vendas.length)) {
    console.log('[Dashboard] Aguardando vendas do Supabase...');
    await window.carregarVendas();
  }
  
  renderDashboardResultado();
  renderAlerts(ym);
}
function init(){
  const input = $('dashMes'); if (input && !input.value) input.value = ymNow();
  input?.addEventListener('change', refresh);

  $('dashResAtualizar')?.addEventListener('click', renderDashboardResultado);
  $('dashResBusca')?.addEventListener('input', renderDashboardResultado);
  $('dashResImprimir')?.addEventListener('click', ()=> window.print());

  refresh();
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* Debug no console: __dash_debug('2025-10') */
window.__dash_debug = function(ym){
  const ymUse = ym || ($('dashMes')?.value) || ymNow();
  const grupos = buildAlertsForMonth(ymUse);
  return grupos.flatMap(g => g.fichas.map(f => ({
    gerente: g.gerente, ficha: f.ficha, rota: f.rota,
    ajuda: f.ajuda, ideal: f.ideal, excedente: f.excedente
  })));
};  



function vendaBrutaRefDaDespesa(ficha, dataISO, periodoIni, periodoFim){
  if (typeof window.getVendaMesByDespesa === 'function'){
    const v = window.getVendaMesByDespesa(ficha, dataISO, periodoIni, periodoFim);
    return Number(v?.bruta)||0;
  }
  const baseISO = String(dataISO||periodoFim||periodoIni||'').slice(0,10);
  const [Y,M] = baseISO.slice(0,7).split('-').map(Number);
  if(!Y||!M) return 0;
  let y=Y, m=M-1; if(m===0){m=12;y--;}
  const prevYM = `${y}-${String(m).padStart(2,'0')}`;
  const row = getVendas().find(v => String(v.ficha)===String(ficha) && String(v.ym)===prevYM);
  return Number(row?.bruta)||0;
}

function buildAlertsForMonth(ym){
  const de = ymFirst(ym), ate = ymLast(ym);
  const eid = (typeof window.getCurrentEmpresaId==='function') ? String(getCurrentEmpresaId()) : null;

  const fichasCad = getFichas();
  const exigirFichaCadastrada = Array.isArray(fichasCad) && fichasCad.length > 0;

  const base = getDespesas().filter(d=>{
    const dt = String(d.data||'').slice(0,10); if (!dt) return false;
    if (dt < de || dt > ate) return false;
    if (eid && d.empresaId && String(d.empresaId)!==eid) return false;
    if (d.isHidden || d.oculta) return false;
    
    // ✅ REQUERIDO: Só aceita despesas com FICHA preenchida
    if (!String(d.ficha||'').trim()) return false;

    if (exigirFichaCadastrada){
      return fichasCad.some(f => String(f.ficha)===String(d.ficha));
    }
    return true;
  });

  const itensAlerta = [];
  for (const d of base){
    const chk = limiar_alerta(d);           // calcula diferença e confere limiar
  
    if (chk.atingiu){                       // só entra no alerta se >= R$ 500
      const nomeViaId = (d.gerenteId && Array.isArray(window.gerentes))
        ? (window.gerentes.find(x=> String(x.uid)===String(d.gerenteId))?.nome || '')
        : '';
      const gerenteNome = (d.gerenteNome || nomeViaId || '(sem gerente)').trim();
  
      itensAlerta.push({
        gerente: gerenteNome,
        ficha: String(d.ficha||''),
        rota: rotaByFicha(d.ficha),
        ajuda: chk.ajuda,
        ideal: chk.ideal,
        excedente: chk.diff                 // aqui a “diferença”
      });
    }
  }
  

  const byGer = new Map();
  for (const it of itensAlerta){
    if (!byGer.has(it.gerente)) byGer.set(it.gerente, []);
    byGer.get(it.gerente).push(it);
  }

  return Array.from(byGer.entries())
    .map(([gerente, fichas]) => ({
      gerente,
      fichas: fichas.sort((a,b)=> b.excedente - a.excedente)
    }))
    .sort((a,b)=> b.fichas.length - a.fichas.length);
}

function renderAlerts(ym){
  const box = document.getElementById('dashAlertBox'); 
  if (!box) return;

  const dados = buildAlertsForMonth(ym);

  if (!dados.length){
    box.innerHTML = '<p class="muted">Tudo certo por aqui.</p>';
    box.classList.remove('has-alert');
    return;
  }

  // resumo: total de vendedores (fichas) acima da média — sem detalhar ficha
  const totalVendedores = dados.reduce((s, gr) => s + gr.fichas.length, 0);
  const ehSingular = totalVendedores === 1;

  box.innerHTML = `
    <div class="alert-item">
      <div class="alert-title">
        <span class="alert-ico">⚠️</span>
        <strong>${totalVendedores} ${ehSingular ? 'vendedor está' : 'vendedores estão'} acima da média de despesas</strong>
      </div>
      <button class="btn small" data-desp-rel style="margin-top:8px;">
        👁️ Mostrar detalhes
      </button>
    </div>
  `;

  // handler do botão → vai para RELATÓRIOS com o período do mês selecionado no dashboard
  const ymAtual = (document.getElementById('dashMes')?.value) || ymNow();
  box.querySelector('[data-desp-rel]')?.addEventListener('click', ()=>{
    gotoRelatorioDespesas(ymAtual);
  });

  box.classList.add('has-alert');
}

// ===== 3) NAVEGAÇÃO: ir para o RELATÓRIO com o período do mês selecionado =====
window.gotoRelatorioDespesas = function(ym){
  ym = ym || ymNow();

  // abre a aba de Relatórios de Prestações
  try { if (typeof window.switchTab === 'function') window.switchTab('prest-rel'); } catch(_){}

  // preenche o período (De/Até) com o mês em que a análise foi gerada
  const de  = document.getElementById('relDe');
  const ate = document.getElementById('relAte');
  if (de){
    de.value = ymFirst(ym);
    de.dispatchEvent(new Event('change', { bubbles:true }));
  }
  if (ate){
    ate.value = ymLast(ym);
    ate.dispatchEvent(new Event('change', { bubbles:true }));
  }

  // dispara a busca do relatório
  const btnAplicar = document.getElementById('btnRelAplicar');
  if (btnAplicar) btnAplicar.click();
};

// ===== NAVEGAÇÃO: ir para a página de Despesas com filtros preenchidos =====
window.gotoDespesasDetalhes = function(gerenteNome, ym){
  try { if (typeof window.switchTab === 'function') window.switchTab('desp'); } catch(_){}

  // tenta preencher campo de busca por gerente (existe no seu core.js)
  const inpGer = document.getElementById('despBuscaGerente');
  if (inpGer){
    inpGer.value = gerenteNome || '';
    inpGer.dispatchEvent(new Event('input', { bubbles:true }));
    inpGer.dispatchEvent(new Event('change', { bubbles:true }));
  }

  // tenta preencher o mês (se existir esse input na página de despesas)
  const inpMes = document.getElementById('despMes') || document.getElementById('despMesRef');
  if (inpMes){
    inpMes.value = ym || ymNow();
    inpMes.dispatchEvent(new Event('change', { bubbles:true }));
  }

  // dispara busca/render da página de despesas (ajuste aos IDs/funções que você tiver)
  const btnBuscar = document.getElementById('btnDespBuscar') || document.getElementById('despBuscar');
  if (btnBuscar) btnBuscar.click();

  if (typeof window.renderDespesas === 'function') window.renderDespesas();
};