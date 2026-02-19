// ============================================
// FICHAS E VENDAS - SUPABASE
// VERSÃO: 2025-11-26-v3-SUPABASE
// ============================================

console.log('🔵🔵🔵 [fichas.js] VERSÃO SUPABASE 2025-11-26-v3 CARREGADA! 🔵🔵🔵');

// Flag para indicar que dados vieram do Supabase
window.__fichasFromSupabase = false;
window.__vendasFromSupabase = false;

// Inicializa arrays globais (mas não sobrescreve se já tiver dados do Supabase)
if (!window.__fichasFromSupabase) {
  window.fichas = window.fichas || [];
}
if (!window.__vendasFromSupabase) {
  window.vendas = window.vendas || [];
}

// ========== FUNÇÕES SUPABASE ==========

// Carrega fichas do Supabase
async function carregarFichas() {
  if (!window.SupabaseAPI?.fichas) {
    console.warn('[Fichas] SupabaseAPI.fichas não disponível');
    return [];
  }
  try {
    console.log('[Fichas] 🔄 Carregando do Supabase...');
    const data = await window.SupabaseAPI.fichas.getAll();
    window.fichas = data || [];
    window.__fichasFromSupabase = true;  // Marca que veio do Supabase
    console.log('[Fichas] ✅ Carregadas:', window.fichas.length);
    return window.fichas;
  } catch (e) {
    console.error('[Fichas] ❌ Erro:', e);
    return [];
  }
}

// Carrega vendas do Supabase
async function carregarVendas() {
  if (!window.SupabaseAPI?.vendas) {
    console.warn('[Vendas] SupabaseAPI.vendas não disponível');
    return [];
  }
  try {
    console.log('[Vendas] 🔄 Carregando do Supabase...');
    const data = await window.SupabaseAPI.vendas.getAll();
    window.vendas = data || [];
    window.__vendasFromSupabase = true;  // Marca que veio do Supabase
    console.log('[Vendas] ✅ Carregadas:', window.vendas.length);
    return window.vendas;
  } catch (e) {
    console.error('[Vendas] ❌ Erro:', e);
    return [];
  }
}

// Salva fichas no Supabase
async function saveFichas() {
  if (!window.SupabaseAPI?.fichas) return;
  for (const f of (window.fichas || [])) {
    await window.SupabaseAPI.fichas.upsert(f.ficha, f.area);
  }
  console.log('[Fichas] ✅ Salvas no Supabase');
}

// Salva vendas no Supabase
async function saveVendas() {
  if (!window.SupabaseAPI?.vendas) return;
  for (const v of (window.vendas || [])) {
    await window.SupabaseAPI.vendas.upsert(v);
  }
  console.log('[Vendas] ✅ Salvas no Supabase');
}

// Expor globalmente para debug
window.carregarFichas = carregarFichas;
window.carregarVendas = carregarVendas;
// NÃO zera mais as funções:
//// window.renderFichaArea = null;
//// window.renderVendas   = null;


// Inicialização - carrega dados do Supabase
(function initFichasVendas() {
  let tentativas = 0;
  const maxTentativas = 20;
  let dadosCarregados = false;
  
  async function tryLoad() {
    tentativas++;
    console.log(`[Init Fichas/Vendas] Tentativa ${tentativas}...`);
    
    // Verifica se API está pronta
    if (!window.SupabaseAPI?.fichas || !window.SupabaseAPI?.vendas) {
      if (tentativas < maxTentativas) {
        setTimeout(tryLoad, 500);
      } else {
        console.error('[Init Fichas/Vendas] ❌ API não ficou pronta após', maxTentativas, 'tentativas');
      }
      return;
    }
    
    console.log('[Init Fichas/Vendas] ✅ API pronta, carregando dados...');
    
    try {
      // Carrega fichas
      await carregarFichas();
      
      // Carrega vendas
      await carregarVendas();
      
      dadosCarregados = true;
      
      // Renderiza se elementos existirem
      renderIfVisible();
      
      console.log('[Init Fichas/Vendas] ✅ Inicialização completa!');
    } catch (err) {
      console.error('[Init Fichas/Vendas] ❌ Erro:', err);
    }
  }
  
  // Função para renderizar se os elementos existirem no DOM
  function renderIfVisible() {
    if (!dadosCarregados) return;
    
    const tbodyFichas = document.getElementById('tbodyFichaArea');
    const tbodyVendas = document.getElementById('tbodyVendas');
    
    if (tbodyFichas && typeof renderFichaArea === 'function') {
      console.log('[Fichas] Renderizando tabela...');
      renderFichaArea();
    }
    
    if (tbodyVendas && typeof renderVendas === 'function') {
      console.log('[Vendas] Renderizando tabela...');
      renderVendas();
    }
    
    if (typeof buildDespesasFilterOptions === 'function') {
      buildDespesasFilterOptions();
    }
  }
  
  // Aguarda um pouco para API carregar
  setTimeout(tryLoad, 1500);
  
  // Renderiza quando navegar para a página de fichas
  document.addEventListener('page:show', (e) => {
    if (e.detail === 'fich' || e.detail === 'fichas') {
      console.log('[Fichas] Página exibida, renderizando...');
      renderIfVisible();
    }
  });
  
  // Também escuta mudanças de hash
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'fich' || hash === 'fichas') {
      console.log('[Fichas] Hash mudou para fichas, renderizando...');
      setTimeout(renderIfVisible, 100);
    }
  });
  
  // Observa mudanças de visibilidade da seção de fichas
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target.id === 'page-fich' || target.id === 'secFichas') {
          const isVisible = target.style.display !== 'none';
          if (isVisible) {
            console.log('[Fichas] Seção ficou visível, renderizando...');
            setTimeout(renderIfVisible, 50);
          }
        }
      }
    });
  });
  
  // Observa as seções quando estiverem disponíveis
  setTimeout(() => {
    const pageFich = document.getElementById('page-fich');
    const secFichas = document.getElementById('secFichas');
    
    if (pageFich) {
      observer.observe(pageFich, { attributes: true });
    }
    if (secFichas) {
      observer.observe(secFichas, { attributes: true });
    }
  }, 2000);
  
  // Recarrega ao trocar empresa
  document.addEventListener('empresa:change', async () => {
    console.log('[Fichas/Vendas] 🔄 Empresa mudou, recarregando...');
    await carregarFichas();
    await carregarVendas();
    renderIfVisible();
  });
})();

// ==== FICHAS ====
function renderFichaArea(){
  console.log('🟢 [renderFichaArea] Iniciando... window.fichas.length:', window.fichas?.length);
  
  const tbody = document.getElementById('tbodyFichaArea');
  if (!tbody) {
    console.warn('[renderFichaArea] ⚠️ tbody não encontrado!');
    return;
  }
  
  // ✅ USA EXPLICITAMENTE window.fichas (do Supabase)
  const fichasArr = window.fichas || [];
  console.log('🟢 [renderFichaArea] Renderizando', fichasArr.length, 'fichas');
  
  tbody.innerHTML = fichasArr.sort((a,b)=> String(a.ficha).localeCompare(String(b.ficha))).map(r=>{
    const del = currentUser?.isAdmin ? `<button class="btn danger" data-del-ficha="${r.ficha}">Excluir</button>` : '';
    return `<tr><td>${r.ficha}</td><td>${r.area||''}</td><td>${del}</td></tr>`;
  }).join('') || '<tr><td colspan="3">Nenhuma ficha cadastrada.</td></tr>';

  const sel = document.getElementById('selFichaVenda');
  if (sel) {
    sel.innerHTML = fichasArr.sort((a,b)=> String(a.ficha).localeCompare(String(b.ficha))).map(r=>`<option value="${r.ficha}">${r.ficha} — ${r.area||''}</option>`).join('');
  }

  if(currentUser?.isAdmin){
    document.querySelectorAll('[data-del-ficha]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const f=b.getAttribute('data-del-ficha');
        if(confirm(`Excluir ficha ${f}? (Não remove vendas)`)){
          window.fichas = window.fichas.filter(x=>x.ficha!==f); 
          if (window.SupabaseAPI?.fichas) {
            await window.SupabaseAPI.fichas.delete(f);
          }
          renderFichaArea(); 
          renderVendas();
        }
      });
    });
  }
  
  console.log('🟢 [renderFichaArea] ✅ Concluído');
}
// Exporta para window
window.renderFichaArea = renderFichaArea;
// >>> FONTE ÚNICA: array global `fichas` + Supabase
async function setFichaArea(ficha, area){
  ficha = String(ficha||'').trim();
  area  = String(area ||'').trim();
  if (!ficha || !area) return;

  const i = (window.fichas||[]).findIndex(x => String(x.ficha) === ficha);
  if (i >= 0) window.fichas[i].area = area;
  else (window.fichas ||= []).push({ ficha, area });

  // Salva no Supabase
  if (window.SupabaseAPI?.fichas) {
    await window.SupabaseAPI.fichas.upsert(ficha, area);
  }
}

function getAreaByFicha(ficha){
  ficha = String(ficha||'').trim();
  const it = (window.fichas||[]).find(x => String(x.ficha) === ficha);
  return it ? (it.area || '') : '';
}

document.getElementById('formFichaArea').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const ficha = String(fd.get('ficha')||'').trim();
  const area  = String(fd.get('area')||'').trim();
  if(!ficha || !area){ alert('Informe ficha e área.'); return; }
  
  const i = window.fichas.findIndex(x=>x.ficha===ficha);
  if(i>-1){ window.fichas[i].area = area; } else { window.fichas.push({ficha, area}); }
  
  // Salva no Supabase
  if (window.SupabaseAPI?.fichas) {
    await window.SupabaseAPI.fichas.upsert(ficha, area);
  }
  
  buildDespesasFilterOptions?.();
  renderFichaArea();
  renderVendas?.();
  renderDespesas?.(); 
  alert('Salvo.');
});

function renderFichaVenda(){ renderFichaArea(); }
document.getElementById('formFichaVenda').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const ficha = String(fd.get('ficha')||'').trim();
  const ym    = String(fd.get('mes')||'').trim(); // AAAA-MM
  let bruta   = String(fd.get('bruta')||'').trim();
  let liquida = String(fd.get('liquida')||'').trim();
  if(!ficha || !ym || !bruta){ alert('Informe ficha, mês e venda bruta.'); return; }
  if(bruta.includes(',')) bruta = bruta.replace(/\./g,'').replace(',','.');
  if(liquida && liquida.includes(',')) liquida = liquida.replace(/\./g,'').replace(',','.');
  
  const rec = { id:uid(), ficha, ym, bruta:parseFloat(bruta)||0, liquida: parseFloat(liquida||'0')||0 };
  const idx = window.vendas.findIndex(v=>v.ficha===ficha && v.ym===ym);
  if(idx>-1) window.vendas[idx] = { ...window.vendas[idx], ...rec };
  else window.vendas.push(rec);
  
  // Salva no Supabase
  if (window.SupabaseAPI?.vendas) {
    await window.SupabaseAPI.vendas.upsert(rec);
  }
  
  ev.target.reset(); 
  renderVendas(); 
  alert('Venda salva.');
});
function renderVendas(){
  const tb = document.getElementById('tbodyVendas');
  if (!tb) return;
  
  const qFicha = (document.getElementById('fvBuscaFicha')?.value||'').trim().toLowerCase();
  const qArea  = (document.getElementById('fvBuscaArea')?.value||'').trim().toLowerCase();
  const de = document.getElementById('fvDe')?.value || '0000-00';
  const ate = document.getElementById('fvAte')?.value || '9999-12';

  // ✅ USA window.vendas e window.fichas
  const rows = (window.vendas||[]).filter(v=>{
    if(v.ym < de || v.ym > ate) return false;
    if(qFicha && !String(v.ficha).toLowerCase().includes(qFicha)) return false;
    const area = (window.fichas.find(f=>f.ficha===v.ficha)?.area || '').toLowerCase();
    if(qArea && !area.includes(qArea)) return false;
    return true;
  }).sort((a,b)=> a.ficha===b.ficha ? a.ym.localeCompare(b.ym) : String(a.ficha).localeCompare(String(b.ficha)));

  tb.innerHTML = rows.map(v=>{
    const area = window.fichas.find(f=>f.ficha===v.ficha)?.area || '';
    const del = currentUser?.isAdmin ? `<button class="btn danger" data-del-venda="${v.id}">Excluir</button>` : '';
    const [y,m] = v.ym.split('-');
    return `<tr>
      <td>${v.ficha}</td>
      <td>${esc(area)}</td>
      <td>${m}/${y}</td>
      <td>${fmtBRL(v.bruta)}</td>
      <td>${fmtBRL(v.liquida)}</td>
      <td>${del}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">Sem vendas cadastradas.</td></tr>';

  if(currentUser?.isAdmin){
    document.querySelectorAll('[data-del-venda]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const id=b.getAttribute('data-del-venda');
        if(confirm('Excluir venda?')){
          window.vendas = window.vendas.filter(x=>x.id!==id); 
          if (window.SupabaseAPI?.vendas) {
            await window.SupabaseAPI.vendas.delete(id);
          }
          renderVendas();
        }
      });
    });
  }
}
// Exporta para window
window.renderVendas = renderVendas;
['fvBuscaFicha','fvBuscaArea','fvDe','fvAte'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderVendas);
  document.getElementById(id).addEventListener('change', renderVendas);
});
document.getElementById('fvExport').addEventListener('click',()=>{
  const qFicha = (document.getElementById('fvBuscaFicha').value||'').trim().toLowerCase();
  const qArea  = (document.getElementById('fvBuscaArea').value||'').trim().toLowerCase();
  const de = document.getElementById('fvDe').value || '0000-00';
  const ate = document.getElementById('fvAte').value || '9999-12';
  const rows = (window.vendas||[]).filter(v=>{
    if(v.ym < de || v.ym > ate) return false;
    if(qFicha && !String(v.ficha).toLowerCase().includes(qFicha)) return false;
    const area = (window.fichas.find(f=>f.ficha===v.ficha)?.area || '').toLowerCase();
    if(qArea && !area.includes(qArea)) return false;
    return true;
  });
  const header = ['FICHA','ÁREA','MÊS','VENDA BRUTA','VENDA LÍQUIDA'];
  const lines=[header.join(';')].concat(rows.map(v=>{
    const area = window.fichas.find(f=>f.ficha===v.ficha)?.area || '';
    const [y,m] = v.ym.split('-');
    return [v.ficha, area, `${m}/${y}`, (v.bruta||0).toFixed(2).replace('.',','), (v.liquida||0).toFixed(2).replace('.',',')].join(';');
  }));
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='fichas_vendas.csv'; a.click(); URL.revokeObjectURL(url);
});

// ========== IMPORTAÇÃO DE VENDAS (XLSX/XLS/CSV) — BLOCO ÚNICO ==========
(function initImportVendas(){
const inp  = document.getElementById('inpImportVendas');   // <input type="file" ...>
const btn  = document.getElementById('btnImportVendas');   // botão Importar
const btnModelo = document.getElementById('btnModeloVendas'); // botão Baixar modelo (opcional)
const hint = document.getElementById('impHintVendas');     // <small> para mensagens
if (!inp || !btn) return;

// carrega SheetJS sob demanda
async function ensureXLSX(){
  if (window.XLSX) return;
  await new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = ()=>rej(new Error('Falha ao carregar XLSX'));
    document.head.appendChild(s);
  });
}

// número robusto: aceita 19.626,62 / 19626,62 / 19626.62 / R$ 19.626,62
function toNumberSmart(v){
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[^\d.,-]/g,'').trim(); // deixa só dígitos, , . e -
  // se houver vírgula e ponto: o separador decimal é o úlTIMO que aparece
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1){
    const lastSep = Math.max(lastComma, lastDot);
    const dec = s[lastSep];               // ',' ou '.'
    const mil = dec === ',' ? '.' : ',';  // o outro é milhar
    s = s.replace(new RegExp('\\' + mil, 'g'), ''); // remove milhar
    s = s.slice(0,lastSep).replace(/[^-\d]/g,'') + '.' + s.slice(lastSep+1).replace(/[^\d]/g,'');
    return Number(s);
  }
  // só vírgula → vírgula é decimal
  if (lastComma !== -1){
    s = s.replace(/\./g,''); // pontos são milhar
    s = s.replace(',','.');
    return Number(s);
  }
  // só ponto → ponto é decimal
  if (lastDot !== -1){
    // não remover ponto (é o decimal). remove vírgulas perdidas
    s = s.replace(/,/g,'');
    return Number(s);
  }
  // sem separador: inteiro
  return Number(s.replace(/[^\d-]/g,''));
}

// normaliza mês (muitas formas)
function normMes(val){
  if (!val && val !== 0) return '';
  const mNames = {
    'jan':1,'janeiro':1,'feb':2,'fev':2,'fevereiro':2,'mar':3,'marco':3,'março':3,
    'apr':4,'abr':4,'abril':4,'may':5,'mai':5,'maio':5,'jun':6,'junho':6,'jul':7,'julho':7,
    'aug':8,'ago':8,'agosto':8,'sep':9,'set':9,'setembro':9,'oct':10,'out':10,'outubro':10,
    'nov':11,'novembro':11,'dec':12,'dez':12,'dezembro':12
  };
  let s = String(val).trim().toLowerCase().normalize('NFKD').replace(/[^\w\/\- ]/g,'');
  s = s.replace(/mar\u0063o|marco/g,'marco'); // normaliza "março"

  // AAAA-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // MM/AAAA ou MM-AAAA
  let m;
  let mA = s.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (mA){
    const mm = String(parseInt(mA[1],10)).padStart(2,'0');
    return `${mA[2]}-${mm}`;
  }

  // AAAA/MM ou AAAA-MM
  mA = s.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (mA){
    const mm = String(parseInt(mA[2],10)).padStart(2,'0');
    return `${mA[1]}-${mm}`;
  }

  // NomeMes-YY / NomeMes/AAAA etc.
  mA = s.match(/^([A-Za-z\u00C0-\u017F]+)[\/-](\d{2,4})$/);
  if (mA){
    const name = mA[1].replace(/[^a-z]/g,'');
    m = mNames[name] || 0;
    let yyyy = mA[2];
    if (yyyy.length === 2){
      const yy = parseInt(yyyy,10);
      yyyy = (yy >= 50 ? 1900+yy : 2000+yy).toString();
    }
    if (m>=1 && m<=12) return `${yyyy}-${String(m).padStart(2,'0')}`;
  }

  // NomeMes (coluna só mês) + deduzir ano atual
  if (mNames[s]){
    const yyyy = new Date().getFullYear();
    return `${yyyy}-${String(mNames[s]).padStart(2,'0')}`;
  }

  return s; // deixa como veio; validaremos depois
}

function normalizeHeader(h){
  return String(h||'').toLowerCase().normalize('NFKD').replace(/[^\w]/g,'');
}

function rowsFromSheet(ws){
  return XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});
}
function rowsFromCSV(text){
  const sep = text.indexOf(';')>-1 ? ';' : ',';
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=='');
  if (!lines.length) return [];
  const head = lines[0].split(sep).map(s=>s.trim());
  return lines.slice(1).map(l=>{
    const cols = l.split(sep);
    const o = {}; head.forEach((h,i)=>o[h]= (cols[i]||'').trim());
    return o;
  });
}

function mapRow(obj){
  const map = {};
  Object.keys(obj).forEach(k => map[normalizeHeader(k)] = obj[k]);
  const ficha = String(map.ficha||'').trim();
  const ym    = normMes(map.mes || map.mesref || map.referencia || '');
  const bruta = toNumberSmart(map.bruta || map.vendabruta || map.vendab);
  const liquida = toNumberSmart(map.liquida || map.vendaliquida || map.vendal);

  // >>> único ajuste relevante: aceita várias colunas para ÁREA <<<
  const area  = String(map.area || map.rota || map.setor || map.regiao || map.regional || '').trim();

  if (!ficha || !/^\d{4}-\d{2}$/.test(ym))
    throw new Error(`Linha inválida (ficha="${ficha}", mes="${ym}")`);

  return { ficha, ym, bruta, liquida, area };
}

async function upsertVendas(rows){
  const idx = new Map();
  (window.vendas||[]).forEach((v,i)=> idx.set(`${v.ficha}|${v.ym}`, i));
  let novos=0, atualizados=0;

  for (const r of rows) {
    const key = `${r.ficha}|${r.ym}`;
    const rec = {
      id: uid?.() || crypto.randomUUID?.() || String(Date.now()+Math.random()),
      ficha: r.ficha,
      ym: r.ym,
      bruta: Number(r.bruta)||0,
      liquida: Number(r.liquida)||0
    };
    
    if (idx.has(key)){
      const i = idx.get(key);
      rec.id = window.vendas[i].id; // mantém ID original
      window.vendas[i].bruta = rec.bruta;
      window.vendas[i].liquida = rec.liquida;
      window.vendas[i].updatedAt = new Date().toISOString();
      atualizados++;
    } else {
      rec.createdAt = new Date().toISOString();
      window.vendas.push(rec);
      novos++;
    }
    
    // Salva cada venda no Supabase
    if (window.SupabaseAPI?.vendas) {
      await window.SupabaseAPI.vendas.upsert(rec);
    }
  }

  return {novos, atualizados};
}

async function handleImport(){
  hint && (hint.textContent = '');
  const file = inp.files?.[0];
  if (!file){ alert('Selecione um arquivo.'); return; }

  try{
    let rows = [];
    if (/\.(xlsx|xls)$/i.test(file.name)){
      await ensureXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = rowsFromSheet(ws);
    } else if (/\.csv$/i.test(file.name)){
      rows = rowsFromCSV(await file.text());
    } else {
      alert('Formato não suportado. Use XLSX, XLS ou CSV.');
      return;
    }

    const mapped = rows.map(mapRow);
    const areasInfo = await upsertAreasFromRows(mapped);
    const {novos, atualizados} = await upsertVendas(mapped);

    renderVendas?.(); 
    renderDespesas?.();     
    buildDespesasFilterOptions?.();

    const msg = `Importação concluída: ${novos} novos, ${atualizados} atualizados.`;
    if (hint){ hint.textContent = msg; hint.style.color = '#065f46'; }
    alert(msg);
  } catch(err){
    console.error(err);
    const msg = `Erro: ${err.message || err}`;
    if (hint){ hint.textContent = msg; hint.style.color = '#b91c1c'; }
    alert(msg);
  } finally {
    inp.value = '';
  }
}

btn.addEventListener('click', handleImport);

// modelo CSV simples — AGORA COM COLUNA area
btnModelo?.addEventListener('click', ()=>{
  const csv = 'ficha,mes,bruta,liquida,area\n0301,2025-08,10000,9200,003 VX\n0309,08/2025,19626.62,1942.59,005 AA\n0312,Agosto/2025,992773,-351005,007 BR\n';
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'modelo_vendas.csv'; a.click();
  URL.revokeObjectURL(url);
});

async function upsertAreasFromRows(rows){
  if (!Array.isArray(window.fichas)) window.fichas = [];
  const byFicha = new Map();
  // considera só linhas com área preenchida
  rows.forEach(r=>{
    if (r.ficha && r.area) byFicha.set(r.ficha, r.area);
  });
  if (!byFicha.size) return {novas:0, atualizadas:0};

  let novas=0, atualizadas=0;
  const idx = new Map(window.fichas.map((f,i)=>[String(f.ficha), i]));

  for (const [ficha, area] of byFicha) {
    if (idx.has(ficha)){
      const i = idx.get(ficha);
      if (window.fichas[i].area !== area){
        window.fichas[i].area = area;
        atualizadas++;
      }
    } else {
      window.fichas.push({ ficha, area });
      novas++;
    }
    
    // Salva no Supabase
    if (window.SupabaseAPI?.fichas) {
      await window.SupabaseAPI.fichas.upsert(ficha, area);
    }
  }

  // atualiza telas relacionadas
  window.buildDespesasFilterOptions?.();
  window.renderFichaArea?.();
  return {novas, atualizadas};
}
// ====== Importar FICHA ↔ ÁREA (XLSX/CSV) ======
(function fichaAreaImport() {
  const $file  = document.getElementById('inpImportFichaArea'); // <-- ID correto do seu HTML
  const $imp   = document.getElementById('btnImportFichaArea');
  const $hint  = document.getElementById('impHintFA'); // opcional, se quiser exibir mensagem
  if (!$file || !$imp) return;

  // usa a função principal já existente
  async function upsertFA(ficha, area) {
    await setFichaArea(ficha, area); // grava direto no Supabase
  }

  // parser CSV (formato simples "ficha;area")
  function parseCSV(text) {
    const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
    const head  = lines.shift().split(/[;,]/).map(h=>h.trim().toLowerCase());
    const ixF = head.indexOf('ficha');
    const ixA = head.indexOf('area');
    if (ixF < 0 || ixA < 0)
      throw new Error('Cabeçalho precisa ter colunas: ficha e area');
    return lines.map(l=>{
      const cols = l.split(/[;,]/).map(s=>s.trim());
      return { ficha: cols[ixF], area: cols[ixA] };
    });
  }

  async function readFile(file){
    const name = (file?.name||'').toLowerCase();
    if (name.endsWith('.csv')) {
      const text = await file.text();
      return parseCSV(text);
    }
    // XLSX/XLS
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval:'', raw:false });
    const norm = rows.map(r=>{
      const o = {};
      Object.keys(r).forEach(k=>{
        o[k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')] = String(r[k]).trim();
      });
      return { ficha: o['ficha'] || '', area: o['area'] || '' };
    });
    return norm;
  }

  function sanitize(list){
    const out = []; const seen = new Set();
    list.forEach(r=>{
      const ficha = String(r.ficha||'').replace(/\D/g,'');
      const area  = String(r.area||'').toUpperCase().trim();
      if (!ficha) return;
      if (seen.has(ficha)) return;
      seen.add(ficha);
      out.push({ ficha, area });
    });
    return out;
  }

  async function doImport(){
    const file = $file.files?.[0];
    if (!file){ alert('Escolha um arquivo CSV ou XLSX.'); return; }

    try{
      const raw = await readFile(file);
      const items = sanitize(raw);
      if (!items.length){ alert('Nenhuma linha válida encontrada.'); return; }

      for (const r of items) await upsertFA(r.ficha, r.area);

      // Atualiza tudo que depende do vínculo Ficha ↔ Área
      renderFichaArea?.();
      buildDespesasFilterOptions?.();
      renderDespesas?.();

      alert(`Importação concluída: ${items.length} vínculos Ficha ↔ Área salvos.`);
      $file.value = '';
    }catch(err){
      console.error(err);
      alert('Falha ao importar. Verifique se o arquivo tem colunas ficha e area.');
    }
  }

  $imp.addEventListener('click', (e)=>{
    e.preventDefault();
    doImport();
  });
})();
})();
