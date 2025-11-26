// ==== DESPESAS ====
// VERSÃO: 2025-11-26-v2-SUPABASE
// ===== INICIALIZAÇÃO GLOBAL DE DESPESAS =====

console.log('🟣🟣🟣 [despesas.js] VERSÃO SUPABASE 2025-11-26-v2 CARREGADA! 🟣🟣🟣');

// ✅ CARREGAR DESPESAS DO SUPABASE
// ✅ CARREGAR DESPESAS DO SUPABASE (com proteção de dependência)
async function loadDespesas() {
  // Se a API ainda não estiver pronta, não lança erro nem zera os dados
  if (!window.SupabaseAPI?.despesas) {
    console.warn('[Despesas] SupabaseAPI.despesas ainda não está pronto; usando cache atual.');
    return Array.isArray(window.despesas) ? window.despesas : [];
  }

  try {
    const despesas = await window.SupabaseAPI.despesas.getAll();
    window.despesas = despesas.map(d => ({
      // Mapear campos do Supabase para JS
      id: d.id,
      uid: d.uid || d.id,
      ficha: d.ficha || '',
      gerenteId: d.gerente_id || '',
      gerenteNome: d.gerente_nome || '', // gerente_nome → gerenteNome
      info: d.descricao || '', // descricao → info
      valor: Number(d.valor) || 0,
      data: d.data || '',
      periodoIni: d.periodo_ini || '', // periodo_ini → periodoIni
      periodoFim: d.periodo_fim || '', // periodo_fim → periodoFim
      isHidden: d.oculta === true, // oculta → isHidden (boolean correto)
      rota: d.rota || '',
      categoria: d.categoria || '',
      obs: d.obs || '',
      editada: d.editada || false
    }));
    
    const ocultasCount = window.despesas.filter(d => d.isHidden).length;
    console.log('[Despesas] Carregadas do Supabase:', window.despesas.length);
    console.log('[Despesas] 🚫 Despesas com isHidden=true:', ocultasCount);
    
    // Log de amostra das ocultas
    if (ocultasCount > 0) {
      const amostraOcultas = window.despesas.filter(d => d.isHidden).slice(0, 3);
      console.log('[Despesas] 📋 Amostra de ocultas:', amostraOcultas.map(d => ({
        info: d.info,
        isHidden: d.isHidden
      })));
    }
    
    return window.despesas;
  } catch (error) {
    console.error('[Despesas] Erro ao carregar:', error);
    window.despesas = [];
    return [];
  }
}


// ✅ SALVAR DESPESA NO SUPABASE
// ✅ SALVAR DESPESA NO SUPABASE
async function saveDespesa(despesa) {
  try {
    console.log('[Despesas] Enviando para API:', despesa);
    
    if (despesa.id) {
      // Atualizar existente - API cuida do mapeamento
      await window.SupabaseAPI.despesas.updateByUid(despesa.uid, despesa);
    } else {
      // Criar nova - API cuida do mapeamento
      despesa.uid = window.uid();
      await window.SupabaseAPI.despesas.create(despesa);
    }
    
    console.log('[Despesas] ✅ Salva com sucesso');
  } catch (error) {
    console.error('[Despesas] ❌ Erro ao salvar:', error);
    throw error;
  }
}

// Compatibilidade: se chamado sem argumento, não faz nada (Supabase já salvou individualmente)
// Se chamado com argumento, salva a despesa específica
window.saveDesp = function(despesa) {
  if (despesa) {
    return saveDespesa(despesa);
  }
  // Chamada legada sem argumento - ignora (dados já estão no Supabase)
  console.log('[Despesas] saveDesp() chamado sem argumento - ignorando (Supabase já sincronizado)');
};

// Helper functions para compatibilidade
function __getDespesas() {
  return window.despesas || [];
}

function __setDespesas(arr) {
  window.despesas = arr;
}

// Inicialização: só roda depois que SupabaseAPI.despesas existir
function initDespesasWhenReady(retries = 50) {
  if (!window.SupabaseAPI?.despesas) {
    if (retries <= 0) {
      console.error('[Despesas] SupabaseAPI.despesas não ficou pronto; exibindo apenas dados em memória.');
      if (typeof renderDespesas === 'function') renderDespesas();
      return;
    }
    console.warn('[Despesas] Aguardando SupabaseAPI.despesas...', retries);
    setTimeout(() => initDespesasWhenReady(retries - 1), 200);
    return;
  }

  (async () => {
    await loadDespesas();
    // Preenche selects se a função existir
    if (typeof buildDespesasFilterOptions === 'function') {
      buildDespesasFilterOptions();
    }
    if (typeof renderDespesas === 'function') {
      renderDespesas();
    }
  })();
}

// Garante que o boot rode depois do DOM pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initDespesasWhenReady());
} else {
  initDespesasWhenReady();
}

// continua expondo a função para uso externo
window.loadDespesas = loadDespesas;

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

// Helpers - ✅ USA window.fichas e window.vendas (Supabase)
function getRotaByFicha(ficha) {
    const rec = (window.fichas || []).find(f => String(f.ficha) === String(ficha));
    return rec ? rec.area : '';
  }
  function getVendaMesByDespesa(ficha, dataISO, periodoIni, periodoFim) {
    const baseISO = (dataISO || periodoFim || periodoIni || '').slice(0, 10);
    if (!baseISO) return null;
    const [yyyy, mm] = baseISO.split('-').map(Number);
    let prevY = yyyy, prevM = mm - 1;
    if (prevM === 0) { prevM = 12; prevY = yyyy - 1; }
    const prevYM = `${prevY}-${String(prevM).padStart(2,'0')}`;
    return (window.vendas || []).find(v => String(v.ficha) === String(ficha) && v.ym === prevYM) || null;
  }

  function renderDespesas(){
    const tb = document.getElementById('tbodyDespesas');
    if (!tb) {
      console.warn('[Despesas] tbody não encontrado');
      return;
    }
    
    const buscaG = (document.getElementById('despBuscaGerente')?.value||'').toLowerCase();
    const buscaF = (document.getElementById('despBuscaFicha')?.value||'').toLowerCase();
    const buscaR = (document.getElementById('despBuscaRota')?.value||'').toLowerCase();
    const de = document.getElementById('despDe')?.value || '0000-00-00';
    const ate = document.getElementById('despAte')?.value || '9999-12-31';
    const showHidden = !!document.getElementById('despMostrarOcultas')?.checked;
    
    const IDEAL_RATE = typeof window.IDEAL_RATE === 'number' ? window.IDEAL_RATE : 0.06;


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
const allDespesas = __getDespesas();
console.log('[renderDespesas] 📊 Total de despesas:', allDespesas.length);
console.log('[renderDespesas] 🔍 Despesas ocultas:', allDespesas.filter(d => d.isHidden).length);
console.log('[renderDespesas] 👁️ showHidden (checkbox marcado)?', showHidden);

const list = allDespesas.filter(r=>{
  if(r.data < de || r.data > ate) return false;
  if(!showHidden && r.isHidden) {
    console.log('[renderDespesas] ⚠️ Filtrando despesa oculta:', r.info, 'isHidden:', r.isHidden);
    return false;
  }

  const nomeG = (r.gerenteNome||'').toLowerCase();
  if (buscaG && nomeG !== buscaG) return false;

  const fichaStr = String(r.ficha||'').toLowerCase();
  if (buscaF && fichaStr !== buscaF) return false;

  const rotaStr = (getRotaByFicha(r.ficha) || '').toLowerCase();
  if (buscaR && rotaStr !== buscaR) return false;

  return true;
});

console.log('[renderDespesas] ✅ Após filtrar:', list.length, 'despesas');

  
    // 2) Agrupa por ficha
    const groups = new Map();
    for(const r of list){
      const key = String(r.ficha||'');
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
  
      const rota  = getRotaByFicha(ficha) || '—';
      const gerentesSet = Array.from(new Set(itens.map(x=> (x.gerenteNome||'').trim()).filter(Boolean)));
      const gerenteNome = gerentesSet.length <= 1 ? (gerentesSet[0]||'') : 'Vários';
  
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

        // Sistema unificado: apenas dropdown "Opções ▾"
      
        const selo = r.isHidden ? '<span class="pill-oculta" title="Esta despesa está oculta">ocultada</span>' : '';
        const difColor = status==='ACIMA' ? '#b91c1c' : (status==='ABAIXO' ? '#2563eb' : '#16a34a');
  
        const infoTxt = `${esc(r.info||'')} — <small class="muted">${fmtDiaMes(r.data)}</small>${selo}`;
        
        // Debug: Log do ID sendo renderizado
        if (!r.id) {
          console.error('[DESPESAS] Renderizando linha SEM ID!', r);
        }
        
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
      }
  
    tb.innerHTML = linhas.join('');
    console.log('[renderDespesas] ✅ Renderizadas', linhas.length, 'linhas de', list.length, 'despesas');
  
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
    }
    window.renderDespesas = renderDespesas;

    
  /* ================== DESPESAS: listas de opções dos filtros (encadeadas) ================== */
function buildDespesasFilterOptions() {
  // Garante que os 3 filtros sejam <select>
  const selG = ensureSelect('despBuscaGerente'); // Gerente
  const selR = ensureSelect('despBuscaRota');    // Rota
  const selF = ensureSelect('despBuscaFicha');   // Ficha
  if (!selG || !selR || !selF) return;

  const de  = document.getElementById('despDe').value  || '0000-00-00';
  const ate = document.getElementById('despAte').value || '9999-12-31';

  // Base: considera despesas no período (visíveis e ocultas)
  const base = __getDespesas().filter(d =>
    d.data >= de && d.data <= ate
  );

  // Valores atuais (para tentar manter seleção ao recriar opções)
  const curG = selG.value;
  const curR = selR.value;
  const curF = selF.value;

  // --- Opções de GERENTE: só quem tem despesa no período ---
  const gerentes = Array.from(new Set(
    base.map(d => (d.gerenteNome || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  selG.innerHTML = [
    `<option value="">Selecione o gerente</option>`,
    ...gerentes.map(n => `<option value="${esc(n)}"${n === curG ? ' selected' : ''}>${esc(n)}</option>`)
  ].join('');

  // Reaplica seleção se existir; senão, zera
  if (selG.value && !gerentes.includes(selG.value)) selG.value = '';

  // --- Opções de ROTA: dependem do gerente selecionado ---
  const baseR = selG.value
    ? base.filter(d => (d.gerenteNome || '').trim() === selG.value)
    : base;

  const rotas = Array.from(new Set(
    baseR.map(d => String(getRotaByFicha(d.ficha) || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  selR.innerHTML = [
    `<option value="">Selecione a rota</option>`,
    ...rotas.map(r => `<option value="${esc(r)}"${r === curR ? ' selected' : ''}>${esc(r)}</option>`)
  ].join('');

  if (selR.value && !rotas.includes(selR.value)) selR.value = '';

  // --- Opções de FICHA: dependem de gerente e rota selecionados ---
  const baseF = baseR.filter(d => {
    if (!selR.value) return true;
    const rota = String(getRotaByFicha(d.ficha) || '').trim();
    return rota === selR.value;
  });

  const fichas = Array.from(new Set(
    baseF.map(d => String(d.ficha || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  selF.innerHTML = [
    `<option value="">Selecione a ficha</option>`,
    ...fichas.map(f => `<option value="${esc(f)}"${f === curF ? ' selected' : ''}>${esc(f)}</option>`)
  ].join('');

  if (selF.value && !fichas.includes(selF.value)) selF.value = '';
}
window.buildDespesasFilterOptions = buildDespesasFilterOptions;

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
// ====== SISTEMA UNIFICADO DE AÇÕES (DROPDOWN) ======
// Único sistema mantido - dropdown "Opções ▾"
// Remove duplicatas e mantém apenas o sistema mais completo

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

// ====== NOVO SISTEMA DE DROPDOWN DE AÇÕES ======
if (!window.__despDropdownBound) {
  // Toggle do dropdown
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-desp-dd-toggle]');
    
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      
      // Fecha todos os outros dropdowns
      document.querySelectorAll('.desp-menu.show').forEach(menu => {
        if (menu !== toggle.nextElementSibling) {
          menu.classList.remove('show');
          const otherToggle = menu.previousElementSibling;
          if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
        }
      });
      
      // Toggle do menu atual
      const menu = toggle.nextElementSibling;
      if (menu && menu.classList.contains('desp-menu')) {
        const isOpen = menu.classList.contains('show');
        menu.classList.toggle('show');
        toggle.setAttribute('aria-expanded', !isOpen);
      }
      return;
    }
    
    // Fecha dropdowns ao clicar fora
    if (!e.target.closest('.desp-dd')) {
      document.querySelectorAll('.desp-menu.show').forEach(menu => {
        menu.classList.remove('show');
        const toggle = menu.previousElementSibling;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }
  });
  
  window.__despDropdownBound = true;
}

// ====== AÇÕES DO MENU (EDITAR, OCULTAR, EXCLUIR) ======
if (!window.__despMenuActionsBound) {
  document.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-desp-act]');
    if (!actionBtn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const action = actionBtn.getAttribute('data-desp-act');
    const id = actionBtn.getAttribute('data-id');
    
    console.log('[DESPESAS] Ação clicada:', action, 'ID:', id, 'Tipo:', typeof id);
    
    // Fecha o dropdown
    const menu = actionBtn.closest('.desp-menu');
    if (menu) {
      menu.classList.remove('show');
      const toggle = menu.previousElementSibling;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    
    const arr = __getDespesas();
    const idx = arr.findIndex(x => String(x.id) === String(id));
    
    if (idx === -1) {
      console.warn('[DESPESAS] Despesa não encontrada!');
      console.warn('ID procurado:', id, 'Tipo:', typeof id);
      console.warn('IDs disponíveis:', arr.map(x => ({ id: x.id, tipo: typeof x.id })));
      console.warn('Total de despesas no array:', arr.length);
      alert('Não foi possível localizar esta despesa. Verifique o console (F12) para mais detalhes.');
      return;
    }
    
    // Executar a ação
    switch(action) {
      case 'toggle-hide':
        const antigoEstado = arr[idx].isHidden;
        arr[idx].isHidden = !arr[idx].isHidden;
        __setDespesas(arr);
        
        console.log('[DROPDOWN] 1️⃣ Alterando despesa:', {
          uid: arr[idx].uid,
          info: arr[idx].info,
          'isHidden ANTES': antigoEstado,
          'isHidden AGORA': arr[idx].isHidden
        });
        
        try {
          // Salva no Supabase
          console.log('[DROPDOWN] 2️⃣ Salvando...');
          await saveDespesa(arr[idx]);
          
          // Aguarda um pouco para garantir que o Supabase processou
          console.log('[DROPDOWN] 3️⃣ Aguardando 100ms...');
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Recarrega do Supabase
          console.log('[DROPDOWN] 4️⃣ Recarregando do Supabase...');
          const uidAlterado = arr[idx].uid;
          const infoAlterado = arr[idx].info;
          const novoEstado = arr[idx].isHidden;
          
          await loadDespesas();
          
          // Verifica se a mudança persistiu
          const arrDepois = __getDespesas();
          const despesaDepois = arrDepois.find(d => d.uid === uidAlterado);
          console.log('[DROPDOWN] 🔍 Verificando se mudança persistiu:', {
            uid: uidAlterado,
            info: infoAlterado,
            'enviamos isHidden': novoEstado,
            'veio do Supabase': despesaDepois?.isHidden,
            'PERSISTIU?': despesaDepois?.isHidden === novoEstado ? '✅ SIM' : '❌ NÃO'
          });
          
          // Renderiza
          console.log('[DROPDOWN] 5️⃣ Renderizando...');
          renderDespesas();
          
          console.log('[DROPDOWN] ✅ Concluído!');
        } catch (error) {
          console.error('[DESPESAS] Erro ao ocultar/desocultar:', error);
          alert('Erro ao salvar: ' + error.message);
          // Reverte mudança local em caso de erro
          arr[idx].isHidden = !arr[idx].isHidden;
          __setDespesas(arr);
          renderDespesas();
        }
        break;
        
      case 'editar':
        // Abre modal de edição se existir a função
        if (typeof openEditDespesaModal === 'function') {
          openEditDespesaModal(arr[idx]);
        } else {
          // Fallback: edição inline simples
          const novaInfo = prompt('Editar descrição:', arr[idx].info || '');
          if (novaInfo !== null && novaInfo !== arr[idx].info) {
            arr[idx].info = novaInfo;
            arr[idx].editada = true;
            __setDespesas(arr);
            
            try {
              await saveDespesa(arr[idx]);
              await new Promise(resolve => setTimeout(resolve, 100));
              await loadDespesas();
              renderDespesas();
            } catch (error) {
              console.error('[DESPESAS] Erro ao editar:', error);
              alert('Erro ao salvar: ' + error.message);
            }
          }
        }
        break;
        
      case 'excluir':
        if (!confirm('Excluir esta despesa?')) return;
        
        try {
          const uid = arr[idx].uid || arr[idx].id;
          
          // Remove do Supabase primeiro
          await window.SupabaseAPI.despesas.deleteByUid(uid);
          
          // Aguarda confirmação
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Remove do array local
          const novo = arr.filter(x => String(x.id) !== String(id));
          __setDespesas(novo);
          
          // Recarrega do Supabase
          await loadDespesas();
          renderDespesas();
        } catch (error) {
          console.error('[DESPESAS] Erro ao excluir:', error);
          alert('Erro ao excluir: ' + error.message);
        }
        break;
    }
  });
  
  window.__despMenuActionsBound = true;
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
        // Aguarda e recarrega apenas uma vez no final
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadDespesas();
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

// Event listeners para filtros (delegados, funcionam mesmo se o <select> for recriado)
document.addEventListener('change', (e) => {
  const target = e.target;
  if (!target || !target.id) return;

  // Quando troca o GERENTE:
  // - Recalcula opções de rota/ficha com base nesse gerente
  // - Re-renderiza a tabela
  if (target.id === 'despBuscaGerente') {
    if (typeof buildDespesasFilterOptions === 'function') {
      buildDespesasFilterOptions();
    }
    renderDespesas();
  }

  // Quando troca ROTA ou FICHA: só precisa redesenhar a tabela
  if (target.id === 'despBuscaRota' || target.id === 'despBuscaFicha') {
    renderDespesas();
  }
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

// ✅ Re-renderiza quando fichas/vendas forem carregadas do Supabase
(function initDespesasSupabaseSync() {
  let fichasLoaded = false;
  let vendasLoaded = false;
  
  // Observa mudanças em window.fichas e window.vendas
  const checkAndRender = () => {
    const nowFichas = Array.isArray(window.fichas) && window.fichas.length > 0;
    const nowVendas = Array.isArray(window.vendas);
    
    if (nowFichas && !fichasLoaded) {
      fichasLoaded = true;
      console.log('[Despesas] ✅ Fichas carregadas, atualizando filtros...');
      if (typeof buildDespesasFilterOptions === 'function') {
        buildDespesasFilterOptions();
      }
      if (typeof renderDespesas === 'function') {
        renderDespesas();
      }
    }
    
    if (nowVendas && !vendasLoaded) {
      vendasLoaded = true;
      console.log('[Despesas] ✅ Vendas carregadas, atualizando...');
      if (typeof renderDespesas === 'function') {
        renderDespesas();
      }
    }
  };
  
  // Verifica periodicamente até que os dados estejam carregados
  const interval = setInterval(() => {
    checkAndRender();
    if (fichasLoaded && vendasLoaded) {
      clearInterval(interval);
      console.log('[Despesas] ✅ Sincronização com Supabase completa');
    }
  }, 500);
  
  // Para após 30 segundos se não carregar
  setTimeout(() => clearInterval(interval), 30000);
  
  // Escuta evento de mudança de empresa
  document.addEventListener('empresa:change', () => {
    fichasLoaded = false;
    vendasLoaded = false;
    console.log('[Despesas] 🔄 Empresa mudou, aguardando novos dados...');
  });
})();