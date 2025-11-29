// prestacoes.js
// Aqui só garantimos as chaves na window:
window.DB_GERENTES = window.DB_GERENTES || 'bsx_gerentes_v2';
window.DB_PREST    = window.DB_PREST    || 'bsx_prestacoes_v1';

console.log('[Prestações] Carregado. DB_GERENTES:', window.DB_GERENTES, 'DB_PREST:', window.DB_PREST);

// ===== SISTEMA DE SALDO ACUMULADO =====
// Carrega automaticamente se os scripts estiverem no HTML
console.log('[Prestações] Aguardando Sistema de Saldo Acumulado...');

// Aguarda o sistema de saldo estar disponível
(function waitForSaldoAcumulado() {
  const checkInterval = setInterval(() => {
    if (window.SaldoAcumulado && window.SaldoAcumuladoUI) {
      clearInterval(checkInterval);
      console.log('✅ Sistema de Saldo Acumulado disponível!');
    }
  }, 100);
  
  // Timeout após 5 segundos
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!window.SaldoAcumulado) {
      console.warn('⚠️ Sistema de Saldo Acumulado não carregado');
    }
  }, 5000);
})();

// ===== FUNÇÕES AUXILIARES GLOBAIS (UMA VEZ SÓ) =====
if (typeof window.fmtBRL !== 'function') {
  window.fmtBRL = function(n) {
    return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  };
}
// const fmtBRL = window.fmtBRL; // REMOVIDO

if (typeof window.fmtData !== 'function') {
  window.fmtData = function(iso) {
    if (!iso) return '';
    const [a,m,d] = String(iso).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  };
}
// const fmtData = window.fmtData; // REMOVIDO

if (typeof window.fmtHora !== 'function') {
  window.fmtHora = function(d) {
    if (!d) return '';
    const x = (d instanceof Date) ? d : new Date(d);
    if (!isFinite(+x)) return '';
    try {
      return x.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    } catch {
      const hh = String(x.getHours()).padStart(2,'0');
      const mm = String(x.getMinutes()).padStart(2,'0');
      return `${hh}:${mm}`;
    }
  };
}
// const fmtHora = window.fmtHora; // REMOVIDO

console.log('✅ [Prestações] Helpers globais carregados');

async function carregarPrestacoesIniciais() {
  console.log('🔄 Carregando prestações...');
  
  if (typeof window.carregarPrestacoesGlobal === 'function') {
    try {
      const prestacoes = await window.carregarPrestacoesGlobal();
      console.log('✅ Prestações carregadas do Supabase:', prestacoes.length);
      window.dispatchEvent(new Event('prestacoes:loaded'));
      return prestacoes;
    } catch(e) {
      console.error('❌ Erro ao carregar do Supabase, usando localStorage:', e);
      return JSON.parse(localStorage.getItem(window.DB_PREST) || '[]');
    }
  } else {
    console.warn('⚠️ Funções Supabase não disponíveis, usando localStorage');
    return JSON.parse(localStorage.getItem(window.DB_PREST) || '[]');
  }
}

window.carregarPrestacoesIniciais = carregarPrestacoesIniciais;
console.log('✅ [Prestações] Função de carregamento Supabase disponível');

// ===== SISTEMA DE PROTEÇÃO DE EVENT LISTENERS =====
const __pcListeners = new WeakMap();

function addPcListener(element, event, handler, options) {
  if (!element) return;
  
  // Verifica se já existe listener
  let listeners = __pcListeners.get(element);
  if (!listeners) {
    listeners = new Map();
    __pcListeners.set(element, listeners);
  }
  
  const key = `${event}_${handler.name || 'anonymous'}`;
  if (listeners.has(key)) {
    return; // Já existe, não adiciona
  }
  
  element.addEventListener(event, handler, options);
  listeners.set(key, { event, handler, options });
}

function removePcListener(element, event, handler) {
  if (!element) return;
  
  const listeners = __pcListeners.get(element);
  if (!listeners) return;
  
  const key = `${event}_${handler.name || 'anonymous'}`;
  if (listeners.has(key)) {
    element.removeEventListener(event, handler);
    listeners.delete(key);
  }
}

function clearPcListeners(element) {
  if (!element) return;
  
  const listeners = __pcListeners.get(element);
  if (!listeners) return;
  
  listeners.forEach(({ event, handler, options }) => {
    element.removeEventListener(event, handler, options);
  });
  
  __pcListeners.delete(element);
} 

// ==== CORE SCHEDULER (aceita objeto OU número) ====
let __pcTick = null;
function pcSchedule(opts = { render:false, delay:80 }){
  // ✅ tolera chamadas pcSchedule(120)
  if (typeof opts === 'number') opts = { render:false, delay: opts };
  clearTimeout(__pcTick);
  __pcTick = setTimeout(()=>{
    pcCalcular();      // sempre recalcula totais
    pgRender();        // atualiza tabelas de pagamentos (direita)
    if (opts.render) { // só redesenha listas quando explicitamente pedido
      pcRender();
    }
  }, opts.delay ?? 80);
}
window.esc = window.esc || (s => String(s ?? ''));
// Fallback seguro para getAreaByFicha (evita ReferenceError se não estiver carregada)
window.getAreaByFicha = window.getAreaByFicha || (() => '');



// Helper num(id) seguro (vírgula decimal e vazio -> 0)
function pcNum(id){
  const el = document.getElementById(id);
  let v = String(el?.value || '').trim();
  if (v.includes(',')) v = v.replace(/\./g,'').replace(',','.');
  const n = parseFloat(v||'0');
  return Number.isFinite(n) ? n : 0;
}
function lsKeyEndsWith(e, suffix){
  const k = e?.key || '';
  return k === suffix || k.endsWith(`__${suffix}`);
}


async function loadGerentes(){
  try{
    console.log('[Prestações] Carregando gerentes do Supabase...');
    
    // Busca do Supabase
    if (window.SupabaseAPI && window.SupabaseAPI.gerentes) {
      const arr = await window.SupabaseAPI.gerentes.getAll();
      
      if (!Array.isArray(arr)) {
        console.warn('[prestacoes] SupabaseAPI não retornou array:', arr);
        window.gerentes = [];
        return;
      }
      
      // normaliza
      window.gerentes = arr.map(g => ({
        id:       g.id,  // ← ADICIONE ESTA LINHA
        uid:      g.uid ?? g.id ?? uid(),
        nome:     g.nome ?? g.name ?? g.apelido ?? '—',
        comissao: Number(g.comissao ?? g.percent ?? 0),
        comissao2: Number(g.comissao2) || 0,
        comissaoModo: (g.comissaoModo || (g.comissaoSequencial ? 'sequencial' : 'simples')),     
        comissaoPorRotaPositiva: !!g.comissao_por_rota_positiva || !!g.comissaoPorRotaPositiva,
        temSegundaComissao: !!g.tem_segunda_comissao || !!g.temSegundaComissao,
        temSaldoAcumulado: !!g.tem_saldo_acumulado || !!g.temSaldoAcumulado,
        numero:   g.numero ?? g.rota ?? '',
        endereco: g.endereco ?? '',
        telefone: g.telefone ?? '',
        email:    g.email ?? '',
        obs:      g.obs ?? g.observacoes ?? '',
        baseCalculo: g.base_calculo ?? g.baseCalculo ?? 'COLETAS_MENOS_DESPESAS'
      }));
      
      fillPcGerentes();

      console.log('[Prestações] ✅ Gerentes carregados:', window.gerentes.length);
      
    } else {
      console.warn('[prestacoes] SupabaseAPI não disponível ainda, aguardando...');
      window.gerentes = [];
      
      // Tenta novamente após 1 segundo
      setTimeout(() => loadGerentes(), 1000);
    }
    
  } catch (e){
    console.warn('[prestacoes] falha ao carregar gerentes:', e);
    window.gerentes = [];
  }
}
  // === Atualiza gerentes quando a empresa mudar (emitido pelo empresa-shim)
  document.addEventListener('empresa:change', async ()=>{
    try {
      await loadGerentes();
      fillPcGerentes?.();
      renderValesPrestacao?.();
    } catch(e){
      console.warn('[prestacoes] empresa:change handler:', e);
    }
  });

  window.addEventListener('gerentes:updated', () => loadGerentes());



  document.addEventListener('DOMContentLoaded', async ()=>{
    await loadGerentes();
    fillPcGerentes?.();
  });

  window.addEventListener('storage', async (e)=>{
    try{
      if (lsKeyEndsWith(e, 'bsx_gerentes_v2')) {
        await loadGerentes();
        fillPcGerentes?.();
      }
    }catch(err){
      console.warn('[prestacoes] storage handler:', err);
    }
  });

// ===== Helper de hora SEGURO (use em telas e logs) =====
window.fmtHora = window.fmtHora || function fmtHora(d){
  if (!d) return '';
  const x = (d instanceof Date) ? d : new Date(d);
  if (!isFinite(+x)) return '';
  try {
    return x.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  } catch {
    const hh = String(x.getHours()).padStart(2,'0');
    const mm = String(x.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
};


// ==== PRESTAÇÃO DE CONTAS ====
function fillPcGerentes(){
  const sel = document.getElementById('pcGerente'); if (!sel) return;
  const list = Array.isArray(window.gerentes) ? window.gerentes.slice() : [];
  sel.innerHTML = '<option value="">Selecione</option>' +
    list.map(g => `<option value="${esc(g.uid||g.id)}">${esc(g.nome||'(sem nome)')}</option>`).join('');
}

  
/* ===========================================================
   COLETAS — ÚNICO BLOCO (padrão do gerente + extras da prestação)
   Elementos usados no HTML:
   - #colNome, #colValor, #btnColAdd
   - #pcColetasBody (tbody) e #pcColetasTotal (rodapé)
   - #btnPcSalvarColetores (salvar padrão no gerente)
   - #pcGerente (select do gerente)
   =========================================================== */

// Renderiza a tabela de coletas (editável inline) e o total — sem re-render a cada tecla
function pcRenderColetas(){
  const tb = document.getElementById('pcColetasBody');
  if(!tb) return;
  
  // Limpa listeners antigos
  clearPcListeners(tb);
  
  const rows = prestacaoAtual.coletas || [];

  tb.innerHTML = rows.map(function(c) {
    return '<tr>' +
      '<td>' +
        '<input data-ctype="nome" data-id="' + c.id + '" value="' + (c.nome||'') + '" placeholder="ex.: 005 WEWERTON">' +
      '</td>' +
      '<td>' +
        '<input data-ctype="valor" data-id="' + c.id + '" type="number" step="0.01" value="' + (Number(c.valor || 0)) + '">' +
      '</td>' +
      '<td><button class="btn danger" data-del-coleta="' + c.id + '">Excluir</button></td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="3">Nenhum coletor. Adicione acima.</td></tr>';

  const $tot = document.getElementById('pcColetasTotal');
  const recalcTot = function() {
    const tot = (prestacaoAtual.coletas||[]).reduce(function(a,b) { 
      return a + (Number(b.valor)||0); 
    }, 0);
    if ($tot) $tot.textContent = fmtBRL(tot);
  };

  // Atualiza o modelo conforme digita
  tb.querySelectorAll('input[data-ctype]').forEach(function(inp) {
    const id  = inp.dataset.id;
    const typ = inp.dataset.ctype;

    // Enquanto DIGITA: só atualiza o objeto e o total
    addPcListener(inp, 'input', function inputHandler() {
      const it = (prestacaoAtual.coletas||[]).find(function(x) { return x.id === id; });
      if(!it) return;
      if(typ === 'valor'){
        it.valor = Number(inp.value) || 0;
        recalcTot();
      } else {
        it.nome = inp.value;
      }
    });

    // Quando TERMINA (sai do campo ou muda): agenda recálculo
    const finish = function finishHandler() { pcSchedule(120); };
    addPcListener(inp, 'change', finish);
    addPcListener(inp, 'blur', finish);

    // Enter também confirma
    addPcListener(inp, 'keydown', function keydownHandler(e) {
      if (e.key === 'Enter') { 
        e.preventDefault(); 
        finish(); 
      }
    });
  });

  // Excluir linha
  tb.querySelectorAll('[data-del-coleta]').forEach(function(b) {
    addPcListener(b, 'click', function deleteHandler() {
      const id = b.getAttribute('data-del-coleta');
      prestacaoAtual.coletas = (prestacaoAtual.coletas||[]).filter(function(x) { 
        return x.id !== id; 
      });
      pcRenderColetas();
      pcSchedule(120);
    });
  });

  // Total inicial
  recalcTot();
}

/* Adicionar coletor (temporário/extra ou padrão ainda não salvo)
   – Lê #colNome e #colValor e já soma no total da prestação. */
   (function() {
    const btn = document.getElementById('btnColAdd');
    if (!btn || btn.__pcWired) return;
    btn.__pcWired = true;
    
    addPcListener(btn, 'click', async function() {
  const nome  = (document.getElementById('colNome')?.value || '').trim();
  let   valor = String(document.getElementById('colValor')?.value || '').trim();
  if(valor.includes(',')) valor = valor.replace(/\./g,'').replace(',','.');
  const vNum = parseFloat(valor||'0')||0;

  if (!nome || Number.isNaN(vNum) || vNum === 0) {
    alert('Preencha o USUÁRIO e um VALOR maior que zero.');
    return;
  }

  (prestacaoAtual.coletas ||= []).push({ id: uid(), nome, valor: vNum });

  // limpa os campos do formulário
  if(document.getElementById('colNome'))  document.getElementById('colNome').value  = '';
  if(document.getElementById('colValor')) document.getElementById('colValor').value = '';

  pcRenderColetas();
  pcSchedule();
});
})();

/* Salvar como padrão do gerente (apenas os NOMES dos coletores).
   — Ao trocar o gerente, os nomes padrão reaparecem com valor 0. */
   (function() {
    const btn = document.getElementById('btnPcSalvarColetores');
    if (!btn || btn.__pcWired) return;
    btn.__pcWired = true;
    
    addPcListener(btn, 'click', async function() {
  const gid = document.getElementById('pcGerente')?.value;
  if(!gid){ alert('Selecione um gerente.'); return; }

  // zera os padrões atuais desse gerente e grava os novos nomes
  coletoresPadrao = (coletoresPadrao||[]).filter(c=>c.gerenteId!==gid);
  (prestacaoAtual.coletas||[]).forEach(c=>{
    const nome = (c.nome||'').trim();
    if(nome) coletoresPadrao.push({ id: uid(), gerenteId: gid, nome });
  });
  saveColetores();
  alert('Coletores padrão salvos para este gerente.');
});


/* Ao trocar o gerente:
   – Carrega apenas os COLETORES PADRÃO (nomes) com valor 0
   – Mantém o controle de parcelas de vale separado */
   (function() {
    const sel = document.getElementById('pcGerente');
    if (!sel || sel.__pcWiredChange) return;
    sel.__pcWiredChange = true;
    
    addPcListener(sel, 'change', function() {
  const gid = document.getElementById('pcGerente').value;
  const lista = (coletoresPadrao||[]).filter(c=>c.gerenteId===gid);
  prestacaoAtual.coletas = lista.map(c=>({ id: uid(), nome: c.nome, valor: 0 }));
  prestacaoAtual.valeParcAplicado = []; // evita herdar aplicação de outros períodos
  pcRenderColetas();
  pcSchedule();
});
})();

  // Limpa a prestação em edição e re-renderiza a tela
window.pcResetPrestacao = function(){
  prestacaoAtual = {
    despesas: [],
    pagamentos: [],
    coletas: [],
    vales: [],
    valeSelec: [],
    resumo: {},
    valeParcAplicado: [],
    saldoInfo: null
  };

  // limpa campos comuns (ajuste os IDs que você tiver na tela)
  ['pcColetorNome','pcColetorValor','pcPgData','pcPgValor','pcObs']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // re-render de tudo que depende do estado
  (window.pcRenderColetas||window.pcRender||function(){})();
  window.pcRenderPagamentos?.();
  window.pcRenderResumo?.();
  window.renderValesPrestacao?.();

};
})();

/* ========= pcRender enxuta (sem chamar pgRender/pcCalcular) ========= */
function pcRender(){
  const tbody = document.getElementById('pcDespesasBody');
  if(!tbody) return;

  const rows = (prestacaoAtual.despesas||[]);
  tbody.innerHTML = rows.map(d => {
    const area = getAreaByFicha(d.ficha);
    return `
      <tr>
        <td>
          <div class="fa-cell">
            <input data-id="${d.id}" data-field="ficha" value="${d.ficha||''}" inputmode="numeric" maxlength="5">
            <span class="fa-badge" title="Área desta ficha">${area ? area : ''}</span>
          </div>
        </td>
        <td><input data-id="${d.id}" data-field="info"  value="${d.info||''}"></td>
        <td><input data-id="${d.id}" data-field="valor" type="number" step="0.01" value="${Number(d.valor||0)}"></td>
        <td><button class="btn danger" data-del-id="${d.id}">Excluir</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4">Nenhuma despesa.</td></tr>';

  pcUpdateTotals(false);
}



// ===== VALES DO GERENTE (BANCO GERAL) =====
function renderValesPrestacao(){
  const gid = document.getElementById('pcGerente').value || '';
  const tb  = document.getElementById('pcValesBody');
  if(!tb) return;

  const rows = (__valesReload()||[]).filter(v=>v.gerenteId===gid && !v.quitado);

  tb.innerHTML = rows.map(v=>`
    <tr>
      <td>${esc(v.cod||'-')}</td>
      <td>${fmtBRL(v.valor||0)}</td>
      <td style="text-align:left">
        ${esc(v.obs||'')}
        ${v.periodo?` <small style="color:#6b7280">(${esc(v.periodo)})</small>`:''}
      </td>
      <td style="white-space:nowrap; text-align:right">
        <input
          type="number" step="0.01" min="0"
          placeholder="0,00"
          style="width:110px; margin-right:8px"
          data-vale-valor="${v.id}">
        <button class="btn" data-vale-aplicar="${v.id}">Aplicar</button>
      </td>
      <td>
        <button class="btn ghost" data-vale-quitar="${v.id}">Quitar</button>
        <button class="btn danger" data-vale-del="${v.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhum vale aberto para este gerente.</td></tr>';

  // Aplicar desconto digitado
  tb.querySelectorAll('[data-vale-aplicar]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-vale-aplicar');
      const inp = tb.querySelector(`[data-vale-valor="${id}"]`);
      let val = String(inp?.value||'').trim();
      if(val.includes(',')) val = val.replace(/\./g,'').replace(',','.');
      descontarValeAgoraPorId(id, parseFloat(val||'0')||0);
      if(inp) inp.value = '';
    });
  });


  // Enter no input aplica também
  tb.querySelectorAll('[data-vale-valor]').forEach(inp=>{
    inp.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        const id = inp.getAttribute('data-vale-valor');
        let val = String(inp.value||'').trim();
        if(val.includes(',')) val = val.replace(/\./g,'').replace(',','.');
        descontarValeAgoraPorId(id, parseFloat(val||'0')||0);
        inp.value='';
      }
    });
  });

// Quitar (zera o saldo, marca quitado e registra log)
tb.querySelectorAll('[data-vale-quitar]').forEach(b=>{
  b.addEventListener('click', async ()=>{
    const id = b.getAttribute('data-vale-quitar');
    const v = (vales||[]).find(x=>x.id===id); 
    if(!v) return;

    const saldoAntes = Number(v.valor)||0;
    if (!confirm(`Quitar este vale? Isso zera o saldo de ${fmtBRL(saldoAntes)} e marca como quitado.`)) return;

    v.valor   = 0;
    v.saldo   = 0;
    v.quitado = true;
    
    // Atualiza no Supabase
    if (window.SupabaseAPI?.vales) {
      await window.SupabaseAPI.vales.update(id, { saldo: 0, quitado: true });
    }

    // log amigável
    window.valesLog?.add({
      id: (typeof uid==='function'? uid(): 'vl_'+Math.random().toString(36).slice(2,9)),
      valeId: v.id, cod: v.cod||'', gerenteId: v.gerenteId,
      delta: saldoAntes,
      saldoAntes, saldoDepois: 0,
      prestacaoId: window.__prestBeingEdited?.id || null,
      periodoIni: document.getElementById('pcIni')?.value || null,
      periodoFim: document.getElementById('pcFim')?.value || null,
      createdAt: new Date().toISOString()
    });

    renderValesPrestacao();
    pcSchedule();
    try { window.dispatchEvent(new Event('vales:updated')); } catch {}
  });
});


// Excluir
tb.querySelectorAll('[data-vale-del]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-vale-del');
    window.deleteValeById?.(id);
  });
});


  // Rodapé “total em aberto”
  const totAberto = rows.reduce((a,b)=>a+(Number(b.valor)||0),0);
  const el = document.getElementById('pcValesTotalDesc');
  if(el) el.textContent = fmtBRL(totAberto);
}
/* ===== VALES - SUPABASE API ===== */
(function VALES_SUPABASE_API(){
  const EMP = () => localStorage.getItem('empresa_ativa') || window.getCompany?.() || 'BSX';
  const getUser = () => window.Auth?.user?.()?.email || window.SupabaseAPI?.user?.email || '';

  // Inicializa array vazio
  window.vales = window.vales || [];

  // API de Vales no Supabase
  const ValesAPI = {
    async getAll(empresa) {
      const emp = empresa || EMP();
      try {
        const { data, error } = await window.SupabaseAPI.client
          .from('vales')
          .select('*')
          .eq('company', emp)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return (data || []).map(v => ({
          id: v.uid,
          gerenteId: v.gerente_id,
          cod: v.cod || '',
          valor: Number(v.valor) || 0,
          saldo: Number(v.saldo) || 0,
          obs: v.obs || '',
          periodo: v.periodo || '',
          quitado: v.quitado || false,
          criadoEm: v.created_at
        }));
      } catch (e) {
        console.error('[Vales] Erro getAll:', e);
        return [];
      }
    },

    async create(item) {
      const emp = EMP();
      try {
        const { error } = await window.SupabaseAPI.client
          .from('vales')
          .insert({
            uid: item.id,
            gerente_id: item.gerenteId,
            cod: item.cod || '',
            valor: Number(item.valor) || 0,
            saldo: Number(item.saldo ?? item.valor) || 0,
            obs: item.obs || '',
            periodo: item.periodo || '',
            quitado: item.quitado || false,
            company: emp,
            created_by: getUser()
          });
        
        if (error) throw error;
        console.log('[Vales] ✅ Criado:', item.id);
        return true;
      } catch (e) {
        console.error('[Vales] Erro create:', e);
        return false;
      }
    },

    async update(uid, dados) {
      try {
        const upd = {};
        if (dados.saldo !== undefined) upd.saldo = Number(dados.saldo);
        if (dados.quitado !== undefined) upd.quitado = dados.quitado;
        if (dados.cod !== undefined) upd.cod = dados.cod;
        if (dados.obs !== undefined) upd.obs = dados.obs;
        if (dados.valor !== undefined) upd.valor = Number(dados.valor);

        const { error } = await window.SupabaseAPI.client
          .from('vales')
          .update(upd)
          .eq('uid', uid);
        
        if (error) throw error;
        console.log('[Vales] ✅ Atualizado:', uid);
        return true;
      } catch (e) {
        console.error('[Vales] Erro update:', e);
        return false;
      }
    },

    async delete(uid) {
      try {
        const { error } = await window.SupabaseAPI.client
          .from('vales')
          .delete()
          .eq('uid', uid);
        
        if (error) throw error;
        
        // Remove logs também
        await window.SupabaseAPI.client
          .from('vales_log')
          .delete()
          .eq('vale_id', uid);
        
        console.log('[Vales] ✅ Deletado:', uid);
        return true;
      } catch (e) {
        console.error('[Vales] Erro delete:', e);
        return false;
      }
    },

    async migrate() {
      const emp = EMP();
      const KEY = `${emp}__bsx_vales_v1`;
      const KEY_LEG = 'bsx_vales_v1';
      
      let local = [];
      try { local = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      if (!local.length) {
        try { local = JSON.parse(localStorage.getItem(KEY_LEG) || '[]'); } catch {}
      }
      
      if (!local.length) {
        console.log('[Vales] Nada para migrar');
        return { migrated: 0 };
      }

      console.log(`[Vales] 🔄 Migrando ${local.length} vales...`);
      
      const { data: existing } = await window.SupabaseAPI.client
        .from('vales')
        .select('uid')
        .eq('company', emp);
      
      const existingSet = new Set((existing || []).map(v => v.uid));
      
      let migrated = 0;
      for (const v of local) {
        if (existingSet.has(v.id)) continue;
        const ok = await this.create(v);
        if (ok) migrated++;
      }

      console.log(`[Vales] ✅ Migrados: ${migrated}`);
      return { migrated };
    }
  };

  // Registra API global
  window.SupabaseAPI = window.SupabaseAPI || {};
  window.SupabaseAPI.vales = ValesAPI;

  // Função para carregar vales do Supabase (síncrona - retorna cache)
  window.__valesReload = function() {
    return window.vales || [];
  };

  // Função assíncrona para carregar do Supabase
  window.__valesReloadAsync = async function() {
    if (!window.SupabaseAPI?.client) return window.vales || [];
    try {
      const data = await ValesAPI.getAll();
      window.vales = data;
      console.log('[Vales] ✅ Carregados do Supabase:', data.length);
      return data;
    } catch (e) {
      console.warn('[Vales] Erro ao carregar:', e);
      return window.vales || [];
    }
  };

  // saveVales - salva cada vale no Supabase
  window.saveVales = async function() {
    if (!window.SupabaseAPI?.client) return;
    const arr = window.vales || [];
    
    for (const v of arr) {
      try {
        const { data } = await window.SupabaseAPI.client
          .from('vales')
          .select('uid')
          .eq('uid', v.id)
          .maybeSingle();
        
        if (data) {
          await ValesAPI.update(v.id, {
            saldo: v.saldo ?? v.valor,
            quitado: v.quitado,
            obs: v.obs,
            cod: v.cod
          });
        } else {
          await ValesAPI.create(v);
        }
      } catch (e) {
        console.warn('[Vales] Erro sync:', v.id, e);
      }
    }
    
    if (typeof window.SyncManager !== 'undefined') {
      window.SyncManager.notify('vales', { count: arr.length });
    }
  };

  // Ao trocar de empresa, recarrega do Supabase
  document.addEventListener('empresa:change', async () => {
    await window.__valesReloadAsync();
    try { renderValesPrestacao?.(); } catch {}
  });

  // Função de migração global
  window.migrarValesParaSupabase = async function() {
    const r1 = await ValesAPI.migrate();
    const r2 = await window.SupabaseAPI?.valesLog?.migrate?.() || { migrated: 0 };
    console.log(`[Vales] ✅ Migração completa - Vales: ${r1.migrated}, Logs: ${r2.migrated}`);
    return { vales: r1.migrated, logs: r2.migrated };
  };

  // Carrega vales do Supabase na inicialização
  function initVales() {
    if (window.SupabaseAPI?.client) {
      window.__valesReloadAsync().then(() => {
        try { renderValesPrestacao?.(); } catch {}
      });
    } else {
      setTimeout(initVales, 500);
    }
  }
  setTimeout(initVales, 1000);

  console.log('[Vales] ✅ API Supabase inicializada');
})();


function atualizarTotalVales(){
  const tot = (prestacaoAtual.valeSelec||[]).reduce((a,b)=>a+(Number(b.valor)||0),0);
  const el = document.getElementById('pcValesTotalDesc');
  if(el) el.textContent = fmtBRL(tot);
}
// Formatação usada na tabela de Vales
function vlsFmt(n){ return window.fmtBRL ? fmtBRL(Number(n)||0) : (Number(n)||0).toFixed(2); }


// também reagir quando trocar gerente (para atualizar vales da lista)
document.getElementById('pcGerente')?.addEventListener('change', renderValesPrestacao);

// Totais de despesas (prestação)
function pcUpdateTotals(triggerRecalc = true){
  const tot = (prestacaoAtual.despesas||[]).reduce((a,b)=> a + (Number(b.valor)||0), 0);
  document.getElementById('pcTotalDespesas').textContent = fmtBRL(tot);
  if (triggerRecalc) pcSchedule();
}

(function() {
  const tbody = document.getElementById('pcDespesasBody');
  if (!tbody || tbody.__pcWiredClick) return;
  tbody.__pcWiredClick = true;
  
  addPcListener(tbody, 'click', function(e) {
  const btn = e.target.closest('[data-del-id]'); if(!btn) return;
  const id = btn.getAttribute('data-del-id');
  prestacaoAtual.despesas = prestacaoAtual.despesas.filter(d=>d.id!==id);
  pcRender();
  pcSchedule({ render:true });
});
})();

(function() {
  const tbody = document.getElementById('pcDespesasBody');
  if (!tbody || tbody.__pcWiredInput) return;
  tbody.__pcWiredInput = true;
  
  addPcListener(tbody, 'input', function(e) {
  const el = e.target;
  if (el.tagName !== 'INPUT') return;

  const id = el.dataset.id, field = el.dataset.field;
  const it = prestacaoAtual.despesas.find(x=>x.id===id);
  if (!it) return;

  if (field === 'valor'){
    it.valor = Number(el.value) || 0;
  } else {
    it[field] = el.value;
  }


  pcUpdateTotals(false);
  pcSchedule();               // seu scheduler já recalcula sem re-render (mantém foco)
});
})();

/* ========= ADICIONAR / LIMPAR DESPESAS (Prestação) ========= */

// Garante que existe prestacaoAtual
window.prestacaoAtual = window.prestacaoAtual || { despesas: [], pagamentos: [], coletas: [], resumo: {} };

// uid() de fallback (caso não exista no seu core)
function __uidFallback(){
  return 'd_' + Math.random().toString(36).slice(2, 10);
}

// Adiciona uma nova linha de despesa vazia (editável)
async function pcAddDespesa(preset = {}){
  const id = (typeof uid === 'function' ? uid() : __uidFallback());
  
  const novaDespesa = {
    id,
    ficha:  String(preset.ficha || '').trim(),
    info:   String(preset.info  || '').trim(),
    valor:  Number(preset.valor || 0)
  };
  
  (prestacaoAtual.despesas ||= []).push(novaDespesa);
  

  
  pcRender();  // ou a função que renderiza as despesas na tela
  
  renderDespesas();
  pcSchedule();
  
  setTimeout(()=>{
    const inp = document.querySelector('#pcDespesasBody tr:last-child input[name="ficha"]');
    if(inp) inp.focus();
  }, 50);
}

// ✅ FUNÇÃO async para salvar despesa no Supabase
async function salvarDespesaNoSupabase(despesa) {
  const gerenteId = document.getElementById('pcGerente')?.value;
  const ini = document.getElementById('pcIni')?.value;
  const fim = document.getElementById('pcFim')?.value;
  const gerente = window.gerentes?.find(g => g.uid === gerenteId);
  const empresa = window.getCompany ? window.getCompany() : 'BSX';
  
  await window.SupabaseAPI.despesas.create({
    uid: despesa.id,
    empresa_id: empresa,
    gerente_nome: gerente?.nome || '',
    ficha: despesa.ficha || '',
    rota: '',
    descricao: despesa.info || '',
    valor: Number(despesa.valor) || 0,
    categoria: '',
    data: fim || new Date().toISOString().split('T')[0],
    periodo_ini: ini,
    periodo_fim: fim,
    oculta: false,
    editada: false
  });
  
  console.log('✅ Despesa salva no Supabase');
}

// Botão "Adicionar Despesa" (id existente no seu HTML)
(function() {
  const btn = document.getElementById('btnPcAddDespesa');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', function(e) {
  e.preventDefault();
  pcAddDespesa(); // insere linha vazia para você digitar
});
})();

// Botão "Limpar Despesas"
(function() {
  const btn = document.getElementById('btnPcLimpar');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', function(e) {
  e.preventDefault();
  if (!confirm('Deseja limpar TODAS as despesas desta prestação?')) return;
  prestacaoAtual.despesas = [];
  pcRender();
  pcSchedule({ render:true });
});
})();

// Campos que recalculam (debounce)
let __pcDebouncedTimer = null;
const __pcDebounced = function() {
  clearTimeout(__pcDebouncedTimer);
  __pcDebouncedTimer = setTimeout(function() {
    pcSchedule({ render: false, delay: 0 });
  }, 200);
};
['pcGerente','pcValorExtra','pcAdiant','pcDeveAnterior','pcDivida','pcCredito','pcIni','pcFim','pcPerc2','pcSeq','pcPorRota']
  .forEach(id=>{ const el = document.getElementById(id);
    if (!el || el.__pcWiredCalc) return;
    el.__pcWiredCalc = true;
    el.addEventListener('input', __pcDebounced);
    el.addEventListener('change', __pcDebounced);
  });

  function __recalcValeParcFromPagamentos(){
    try{
      const gid = document.getElementById('pcGerente')?.value || '';
      const map = new Map();
      (prestacaoAtual.pagamentos || []).forEach(p=>{
        if (String(p.forma||'').toUpperCase() === 'VALE'){
          const ref = String(p.obs||'').trim();            // código do vale
          const v = (vales||[]).find(x =>
            x.gerenteId === gid && !x.quitado && String(x.cod||'').trim() === ref
          );
          if (v){
            map.set(v.id, (map.get(v.id)||0) + (Number(p.valor)||0));
          }
        }
      });
      prestacaoAtual.valeParcAplicado = Array.from(map, ([id, aplicado])=>{
        const v = (vales||[]).find(x => x.id === id);
        return { id, cod: v?.cod || '', aplicado: Number(aplicado)||0 };
      });
    } catch(e){
      console.warn('recalc valeParcAplicado:', e);
    }
  }
  

// ===== PAGAMENTOS (Prestação) =====
function pgRender(){
  const todos = (prestacaoAtual.pagamentos||[]);
  const listaVales = todos.filter(p => (p.forma||'').toString().toUpperCase()==='VALE');
  const listaNorm  = todos.filter(p => (p.forma||'').toString().toUpperCase()!=='VALE');

  // --- tabela VALES ---
  const tbV = document.getElementById('pgVBody');
  if (tbV){
    tbV.innerHTML = listaVales.map(p => `
      <tr>
        <td>${fmtData(p.data||'')}</td>
        <td>${fmtBRL(p.valor||0)}</td>
        <td>${esc(p.obs||'')}</td>
        <td>${esc(p.obs2||'')}</td>
        <td><button class="btn danger" data-del-pg="${p.id}">Excluir</button></td>
      </tr>
    `).join('') || '<tr><td colspan="5">Nenhum pagamento de VALE.</td></tr>';
  }
  const totV = listaVales.reduce((a,b)=> a + (Number(b.valor)||0), 0);
  const elTotV = document.getElementById('pgVTotal'); if (elTotV) elTotV.textContent = fmtBRL(totV);

// --- tabela NORMAIS ---
const tbN = document.getElementById('pgNBody');
if (tbN){
  tbN.innerHTML = listaNorm.map(p => {
    // ✅ Se for DIVIDA_PAGA, mostra negativo
    const isDivida = (p.forma||'').toString().toUpperCase() === 'DIVIDA_PAGA';
    const valorExibir = isDivida ? -(Number(p.valor)||0) : (Number(p.valor)||0);
    const corValor = isDivida ? 'color: #b91c1c; font-weight: bold;' : '';
    
    return `
      <tr>
        <td>${fmtData(p.data||'')}</td>
        <td style="${corValor}">${fmtBRL(valorExibir)}</td>
        <td>${isDivida ? 'PIX (Empresa → Gerente)' : (p.forma||'').toString().toUpperCase()}</td>
        <td>${esc(p.obs||'')}</td>
        <td><button class="btn danger" data-del-pg="${p.id}">Excluir</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5">Nenhum pagamento lançado.</td></tr>';
}
// ✅ Calcula o total considerando valores negativos (DIVIDA_PAGA)
const totN = listaNorm.reduce((a,b)=> {
  const isDivida = (b.forma||'').toString().toUpperCase() === 'DIVIDA_PAGA';
  const valor = isDivida ? -(Number(b.valor)||0) : (Number(b.valor)||0);
  return a + valor;
}, 0);
const elTotN = document.getElementById('pgNTotal'); 
if (elTotN) elTotN.textContent = fmtBRL(totN);

  // deletar (vale para ambas as tabelas)
// deletar (vale para ambas as tabelas)
document.querySelectorAll('[data-del-pg]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-del-pg');
    const pay = (prestacaoAtual.pagamentos||[]).find(x=>x.id===id);
    prestacaoAtual.pagamentos = (prestacaoAtual.pagamentos||[]).filter(x=>x.id!==id);

    __recalcValeParcFromPagamentos();
    pcSchedule();

  });
});
}

// === Pagamento NORMAL (PIX/DINHEIRO/CARTÃO/ADIANTAMENTO) ===
function pgNAddFromForm(){
  const data  = document.getElementById('pgNData').value || new Date().toISOString().slice(0,10);
  let valor = Number(document.getElementById('pgNValor').value || 0);
  const forma = (document.getElementById('pgNForma').value || 'PIX').toUpperCase();
  const obs   = (document.getElementById('pgNObs').value || '').trim();

  // ✅ PERMITE ZERO PARA VALORES NEGATIVOS
  if (valor === 0 || isNaN(valor)){ 
    alert('Informe um valor válido (diferente de zero).'); 
    return; 
  }

  // ✅ Se o valor for negativo E o À PAGAR também for negativo
  // Isso significa que a empresa está pagando ao gerente
  const aPagar = Number(prestacaoAtual.resumo?.aPagar || 0);
  if (valor < 0 && aPagar < 0) {
    // Inverte o sinal para ficar positivo (é um pagamento de dívida)
    valor = Math.abs(valor);
    
    // Adiciona como DIVIDA_PAGA
    (prestacaoAtual.pagamentos ||= []).push({ 
      id: uid(), 
      data, 
      valor, 
      forma: 'DIVIDA_PAGA',  // ✅ Marca como dívida
      obs: obs || forma      // Mantém a forma original na obs
    });
  } else {
    // Pagamento normal (positivo ou negativo quando À PAGAR é positivo)
    (prestacaoAtual.pagamentos ||= []).push({ 
      id: uid(), 
      data, 
      valor: Math.abs(valor),  // ✅ Sempre positivo no banco
      forma, 
      obs 
    });
  }

  document.getElementById('pgNValor').value = '';
  document.getElementById('pgNObs').value   = '';

  __recalcValeParcFromPagamentos(); 
  pcSchedule();
  pgRender();  // ✅ Atualiza as duas tabelas
}

// === Pagamento de VALE ===
function pgVAddFromForm(){
  const data  = document.getElementById('pgVData').value || new Date().toISOString().slice(0,10);
  const valor = Number(document.getElementById('pgVValor').value || 0);
  const ref   = (document.getElementById('pgVRef').value || '').trim();
  const obs2  = (document.getElementById('pgVObs').value || '').trim();

  if (!valor || valor<=0){ alert('Informe um valor válido (>0).'); return; }
  if (!ref){ alert('Informe o CÓDIGO do vale.'); return; }

  // vincula no controle de parcelas aplicadas
  const res = aplicarPagamentoEmVale({ valor, obs: ref });
  if (!res){ alert('Não achei um vale aberto com esse código.'); return; }



  // adiciona o pagamento como forma VALE
  (prestacaoAtual.pagamentos ||= []).push({ id: uid(), data, valor, forma:'VALE', obs: ref, obs2 });

  // limpar campos
  document.getElementById('pgVValor').value = '';
  // mantemos o ref preenchido para repetir rapidamente, se quiser

  __recalcValeParcFromPagamentos();
  pcSchedule();
}

// Botões VALE
(function() {
  const btn = document.getElementById('btnPgVAdd');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', function(e) {
    e.preventDefault();
    pgVAddFromForm();
  });
})();

(function() {
  const btn = document.getElementById('btnPgVLimpar');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', async function() {
  if(!confirm('Limpar os pagamentos de VALE desta prestação?')) return;

  prestacaoAtual.pagamentos = (prestacaoAtual.pagamentos||[]).filter(p => (p.forma||'').toUpperCase()!=='VALE');
  prestacaoAtual.valeParcAplicado = []; 
  __recalcValeParcFromPagamentos();
pcSchedule();
});
})();



// Botões NORMAIS
(function() {
  const btn = document.getElementById('btnPgNAdd');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', function(e) {
    e.preventDefault();
    pgNAddFromForm();
  });
})();

(function() {
  const btn = document.getElementById('btnPgNLimpar');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', async function() {
  if(!confirm('Limpar os pagamentos NORMAIS desta prestação?')) return;
  prestacaoAtual.pagamentos = (prestacaoAtual.pagamentos||[]).filter(p => (p.forma||'').toUpperCase()==='VALE');
  pcSchedule();
});
})();

// VALE SÓ SUBTRAI DO BANCO DE DADOS QUANDO SALVO A PRESTAÇÃO
function aplicarPagamentoEmVale({ valor, obs }) {
  const ref = String(obs || '').trim();
  if (!ref) return null;

  const gid = document.getElementById('pcGerente').value || '';
  const v = (vales || []).find(x =>
    x.gerenteId === gid &&
    !x.quitado &&
    String(x.cod||'').trim() === ref
  );
  if (!v) return null;

  // só registra no controle provisório desta prestação
  (prestacaoAtual.valeParcAplicado ||= []);
  const reg = prestacaoAtual.valeParcAplicado.find(x => x.id === v.id);
  if (reg) reg.aplicado += Number(valor)||0;
  else prestacaoAtual.valeParcAplicado.push({ id: v.id, cod: v.cod, aplicado: Number(valor)||0 });

  // NÃO altera v.valor aqui. NÃO salva banco.
  return { id: v.id, cod: v.cod, pago: Number(valor)||0 };
}

// Botão "Aplicar" na lista de vales (provisório)
function descontarValeAgoraPorId(id, valor){
  const v = (vales||[]).find(x=>x.id===id && !x.quitado);
  if(!v) return alert('Vale não encontrado ou já quitado.');

  // normaliza
  const pago = Math.max(0, Number(valor)||0);
  if(pago<=0) return alert('Informe um valor válido (> 0).');

  // evita repetir a MESMA parcela (mesma referência e valor) já inserida nesta sessão
  const ref = String(v.cod||'');
  const jaExiste = (prestacaoAtual.pagamentos||[]).some(p =>
    String((p.forma||'').toUpperCase())==='VALE' &&
    String(p.obs||'')===ref &&
    (Number(p.valor)||0)===pago &&
    (p.data||'')===new Date().toISOString().slice(0,10)
  );
  if (jaExiste){
    alert('Esta parcela de VALE (mesma data/valor/código) já foi aplicada.');
    return;
  }

  // Lança pagamento provisório na prestação
  (prestacaoAtual.pagamentos ||= []).push({
    id: uid(),
    data: new Date().toISOString().slice(0,10),
    valor: pago,
    forma: 'VALE',
    obs: ref
  });
  __recalcValeParcFromPagamentos();

  pcSchedule();
}

function pgAddFromForm(){
  const data  = document.getElementById('pgData').value || new Date().toISOString().slice(0,10);
  const valor = Number(document.getElementById('pgValor').value || 0);
  const forma = (document.getElementById('pgForma').value || 'PIX').toUpperCase();
  const obs   = (document.getElementById('pgObs').value || '').trim();

  if(!valor || valor <= 0){ alert('Informe um valor válido.'); return; }

  // evita duplicar
  const jaExiste = (prestacaoAtual.pagamentos||[]).some(p =>
    (p.data||'')===data &&
    String((p.forma||'').toUpperCase())===forma &&
    (Number(p.valor)||0)===valor &&
    String(p.obs||'')===obs
  );
  if (jaExiste){
    alert('Este pagamento já foi lançado (mesma data/valor/forma/obs).');
    return;
  }

  if (forma === 'VALE') {
    if (!obs){ alert('Para forma VALE, preencha o campo Obs com o CÓDIGO do vale (ex.: 8401).'); return; }
    const res = aplicarPagamentoEmVale({ valor, obs });
    if (!res){ alert('Não achei um vale aberto com esse código (Obs).'); return; }
  }

  (prestacaoAtual.pagamentos ||= []).push({ id: uid(), data, valor, forma, obs });

  document.getElementById('pgValor').value = '';
  document.getElementById('pgObs').value   = '';

  __recalcValeParcFromPagamentos();

  pcSchedule();
}

// ===== COLETAS (Prestação – lançamento) =====
function colRender(){
  const tb = document.getElementById('colBody');
  const rows = (prestacaoAtual.coletas || []);
  tb.innerHTML = rows.map(c => `
    <tr>
      <td>${c.nome || ''}</td>
      <td>${fmtBRL(c.valor || 0)}</td>
      <td style="text-align:left">${c.obs || ''}</td>
      <td><button class="btn danger" data-del-col="${c.id}">Excluir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="4">Nenhuma coleta lançada.</td></tr>';

  document.querySelectorAll('[data-del-col]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-del-col');
      prestacaoAtual.coletas = (prestacaoAtual.coletas || []).filter(x=>x.id!==id);
      colRender(); 
      pcSchedule();
    });
  });

  const total = rows.reduce((a,b)=> a + (Number(b.valor)||0), 0);
  document.getElementById('colTotal').textContent = fmtBRL(total);
}

function vlAddFromForm(){
  const ref   = document.getElementById('vlRef').value.trim();
  const valor = Number(document.getElementById('vlValor').value || 0);
  const obs   = document.getElementById('vlObs').value.trim();
  if(!ref || !valor || valor<=0){ alert('Informe referência e valor válidos.'); return; }
  (prestacaoAtual.vales ||= []).push({ id:uid(), ref, valor, obs });
  document.getElementById('vlRef').value   = '';
  document.getElementById('vlValor').value = '';
  document.getElementById('vlObs').value   = '';
  pcSchedule();
}
(function() {
  const btn = document.getElementById('btnVlAdd');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', vlAddFromForm);
})();

(function() {
  const btn = document.getElementById('btnVlLimpar');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', async function() {
  prestacaoAtual.vales = [];
  pcSchedule();
});
})();

// ===== Helper de comissão (modos novo e antigo) =====
function __calcComissao_v2({
  coletas, coletasPos, despesasTot,
  perc1, perc2 = 0,
  porRota = false, sequencial = false,
  negAnterior = 0
}){
  perc1 = Number(perc1) || 0;
  perc2 = Number(perc2) || 0;
  const resultadoSemana = coletas - despesasTot;

  // —— MODOS NOVOS: base é COLETAS (ou só positivas) e NÃO usa carry de negativo
  if (porRota || sequencial || perc2 > 0){
    const base = porRota ? (Number(coletasPos) || 0) : (Number(coletas) || 0);

    // 1ª comissão normal sobre a base
    const comis1 = base * (perc1 / 100);

    // 2ª comissão:
    //   - se SEQUENCIAL: em cima do restante (base - comis1)
    //   - se SIMPLES: em cima da mesma base
    let comis2 = 0;
    if (perc2 > 0){
      if (sequencial){
        const base2 = Math.max(base - comis1, 0);
        comis2 = base2 * (perc2 / 100);
      } else {
        comis2 = base * (perc2 / 100);
      }
    }

    return {
      comissaoVal: comis1 + comis2,
      comis1,
      comis2,
      baseComissao: base,
      novoSaldoNeg: negAnterior,   // não mexe no saldo negativo aqui
      resultadoSemana
    };
  }

  // —— MODO ANTIGO (com carry do negativo) — igual ao seu original
  let baseComissao = 0;
  let novoSaldoNeg = negAnterior;

  if (perc1 > 0 && perc1 < 50){
    if (resultadoSemana < 0){
      novoSaldoNeg = negAnterior + Math.abs(resultadoSemana);
      baseComissao = 0;
    } else {
      const amort = Math.min(resultadoSemana, negAnterior);
      novoSaldoNeg = negAnterior - amort;
      baseComissao = resultadoSemana - amort;
    }
  } else {
    baseComissao = Math.max(resultadoSemana, 0);
    novoSaldoNeg = 0;
  }

  return {
    comissaoVal: baseComissao * (perc1 / 100),
    comis1: 0,
    comis2: 0,
    baseComissao,
    novoSaldoNeg,
    resultadoSemana
  };
}
// Classe para gerenciar os diferentes tipos de cálculo
class CalculadoraComissao {
  constructor(gerente, coletas, despesas, coletores = []) {
    this.gerente = gerente;
    this.coletas = coletas || [];
    this.despesas = despesas || [];
    this.coletores = coletores || [];
    
    // Configurações do gerente
    this.comissao1 = Number(gerente.comissao || 0);
    this.comissao2 = Number(gerente.comissao2 || 0);
    this.temSegundaComissao = !!gerente.temSegundaComissao || Number(gerente.comissao2) > 0;
    this.comissaoPorRotaPositiva = !!gerente.comissaoPorRotaPositiva;
    this.baseCalculo = (gerente.base_calculo || gerente.baseCalculo || 'COLETAS_MENOS_DESPESAS').toUpperCase();
  }
  
  // Calcula o total de coletas
  getTotalColetas() {
    let total = 0;
    
    // Se tem coletores, soma os valores
    if (this.coletores && this.coletores.length > 0) {
      // Se é comissão por rota positiva, soma só positivos
      if (this.comissaoPorRotaPositiva) {
        total = this.coletores
          .filter(c => c.valor > 0)
          .reduce((sum, c) => sum + c.valor, 0);
      } else {
        total = this.coletores.reduce((sum, c) => sum + c.valor, 0);
      }
    } else {
      // Se não tem coletores, usa o valor direto de coletas
      total = Array.isArray(this.coletas) 
        ? this.coletas.reduce((sum, c) => sum + (c.valor || 0), 0)
        : Number(this.coletas) || 0;
    }
    
    return total;
  }
  
  // Calcula o total de despesas
  getTotalDespesas() {
    return Array.isArray(this.despesas)
      ? this.despesas.reduce((sum, d) => sum + (d.valor || 0), 0)
      : Number(this.despesas) || 0;
  }
  
  // Calcula a base para comissão
  getBaseComissao() {
    const totalColetas = this.getTotalColetas();
    const totalDespesas = this.getTotalDespesas();
    
    // Se tem 2ª comissão, sempre usa apenas coletas
    if (this.temSegundaComissao) {
      return totalColetas;
    }
    
    // Se é por rota positiva, sempre usa apenas coletas
    if (this.comissaoPorRotaPositiva) {
      return totalColetas;
    }
    
    // Senão, usa a configuração do gerente
    if (this.baseCalculo === 'COLETAS') {  // ✅ Maiúscula
      return totalColetas;
    } else {
      return totalColetas - totalDespesas;
    }
  }
  
  // Calcula valores de comissão
  calcularComissoes() {
    const totalColetas = this.getTotalColetas();
    const totalDespesas = this.getTotalDespesas();
    
    // ✅ Verifica se resultado é positivo antes de calcular comissões
    const resultadoSemComissao = totalColetas - totalDespesas;
    
    let baseComissao = 0;
    let valorComissao1 = 0;
    let valorComissao2 = 0;
    
    if (this.temSegundaComissao) {
      // ✅ Só calcula comissões se resultado for positivo
      if (resultadoSemComissao > 0) {
        baseComissao = this.getBaseComissao();
        valorComissao1 = (baseComissao * this.comissao1) / 100;
        
        const resultadoApos1a = totalColetas - valorComissao1 - totalDespesas;
        if (resultadoApos1a > 0) {
          valorComissao2 = (resultadoApos1a * this.comissao2) / 100;
        }
      }
    } else {
      // Outros modelos mantêm lógica original
      baseComissao = this.getBaseComissao();
      valorComissao1 = (baseComissao * this.comissao1) / 100;
    }
    
    return {
      base: baseComissao,
      comissao1: valorComissao1,
      comissao2: valorComissao2,
      percentual1: this.comissao1,
      percentual2: this.comissao2
    };
  }

  
  // Calcula o resultado final
  calcularResultado(deveAnterior = 0, adiantamento = 0, valorExtra = 0) {
    const totalColetas = this.getTotalColetas();
    const totalDespesas = this.getTotalDespesas();
    const comissoes = this.calcularComissoes();
    
    let resultado = 0;
    
    if (this.temSegundaComissao) {
      // Modelo 1: Com 2ª comissão
      // Resultado = Coletas - Comissão1 - Comissão2 - Despesas
      resultado = totalColetas - comissoes.comissao1 - comissoes.comissao2 - totalDespesas;
    } else if (this.comissaoPorRotaPositiva) {
      // Modelo 2: Por rota positiva
      // Resultado = Coletas(positivas) - Comissão - Despesas
      resultado = totalColetas - comissoes.comissao1 - totalDespesas;
    } else {
      // Modelo 3: Padrão
      // Resultado = (Coletas - Despesas) - Comissão
      resultado = (totalColetas - totalDespesas) - comissoes.comissao1;
    }
    
    // Adiciona valores extras
    resultado = resultado + deveAnterior - adiantamento + valorExtra;
    
    return {
      totalColetas,
      totalDespesas,
      baseComissao: comissoes.base,
      valorComissao1: comissoes.comissao1,
      valorComissao2: comissoes.comissao2,
      percentual1: comissoes.percentual1,
      percentual2: comissoes.percentual2,
      resultado,
      aPagar: resultado,
      restante: resultado
    };
  }
  
  // Gera o HTML do relatório de acordo com o modelo
  gerarRelatorioHTML() {
    const calc = this.calcularResultado();
    let html = '';
    
    if (this.temSegundaComissao) {
      html = '<div class="coletas-info">' +
        '<div class="info-row"><span class="label">Coletas:</span><span class="value">R$ ' + calc.totalColetas.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Base Comissão:</span><span class="value success">R$ ' + calc.baseComissao.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Saldo a Carregar:</span><span class="value">R$ 0,00</span></div>' +
        '<div class="info-row"><span class="label">Comissão 1 (' + calc.percentual1 + '%):</span><span class="value success">R$ ' + calc.valorComissao1.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Resultado (Coletas - Com. 1):</span><span class="value">R$ ' + (calc.totalColetas - calc.valorComissao1).toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Comissão 2 (' + calc.percentual2 + '%):</span><span class="value success">R$ ' + calc.valorComissao2.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Despesas:</span><span class="value danger">R$ ' + calc.totalDespesas.toFixed(2) + '</span></div>' +
        '<div class="info-row highlight"><span class="label">Resultado:</span><span class="value">R$ ' + calc.resultado.toFixed(2) + '</span></div>' +
        '</div>';
      
    } else if (this.comissaoPorRotaPositiva && this.coletores.length > 0) {
      const coletoresHtml = this.coletores.map(function(c) {
        return '<div class="info-row ' + (c.valor < 0 ? 'negative' : '') + '">' +
          '<span class="label">' + c.nome + ':</span>' +
          '<span class="value">R$ ' + c.valor.toFixed(2) + '</span>' +
          (c.valor < 0 ? '<small>(não entra na comissão)</small>' : '') +
          '</div>';
      }).join('');
      
      html = '<div class="coletas-info"><div class="coletores-list">' + coletoresHtml + '</div><hr>' +
        '<div class="info-row"><span class="label">Total Coletas:</span><span class="value">R$ ' + this.coletores.reduce(function(s,c) { return s+c.valor; }, 0).toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Base Comissão (só positivas):</span><span class="value success">R$ ' + calc.baseComissao.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Comissão (' + calc.percentual1 + '%):</span><span class="value success">R$ ' + calc.valorComissao1.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Despesas:</span><span class="value danger">R$ ' + calc.totalDespesas.toFixed(2) + '</span></div>' +
        '<div class="info-row highlight"><span class="label">Resultado:</span><span class="value">R$ ' + calc.resultado.toFixed(2) + '</span></div>' +
        '</div>';
    } else {
      html = '<div class="coletas-info">' +
        '<div class="info-row"><span class="label">Coletas:</span><span class="value">R$ ' + calc.totalColetas.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Despesas:</span><span class="value danger">R$ ' + calc.totalDespesas.toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Total (Coletas - Despesas):</span><span class="value">R$ ' + (calc.totalColetas - calc.totalDespesas).toFixed(2) + '</span></div>' +
        '<div class="info-row"><span class="label">Comissão (' + calc.percentual1 + '%):</span><span class="value success">R$ ' + calc.valorComissao1.toFixed(2) + '</span></div>' +
        '<div class="info-row highlight"><span class="label">Resultado:</span><span class="value">R$ ' + calc.resultado.toFixed(2) + '</span></div>' +
        '</div>';
    }
    
    return html;
  }}

// ============================================
// FUNÇÃO PARA ATUALIZAR A UI
// ============================================

function atualizarUIPrestacao() {
  const gerenteSelect = document.getElementById('pcGerente');
  if (!gerenteSelect) return;

  const gerenteId = gerenteSelect.value || '';
  const gerente = (window.gerentes || []).find(g => String(g.uid) === String(gerenteId));
  if (!gerente) return;

  // coerência com pcCalcular
  gerente.temSegundaComissao = !!gerente.temSegundaComissao || Number(gerente.comissao2) > 0;

  const coletores = (prestacaoAtual.coletas || []).map(c => ({
    nome: c.nome || '',
    valor: Number(c.valor) || 0
  }));

  const despesas = (prestacaoAtual.despesas || []).map(d => ({
    valor: Number(d.valor) || 0
  }));

  const calc = new CalculadoraComissao(gerente, [], despesas, coletores);
  const r = calc.calcularResultado(
    pcNum('pcDeveAnterior'),
    pcNum('pcAdiant'),
    pcNum('pcValorExtra')
  );

  const campos = {
    pcTotalColetas: 'R$ ' + r.totalColetas.toFixed(2),
    pcTotalDespesas: 'R$ ' + r.totalDespesas.toFixed(2),
    pcResultado: 'R$ ' + r.resultado.toFixed(2),
    pcPagar: 'R$ ' + r.aPagar.toFixed(2),
    pcRestam: 'R$ ' + r.restante.toFixed(2),
    pcPerc: (r.percentual1 || 0) + '%' + (r.percentual2 ? ' + ' + r.percentual2 + '%' : '')
  };

  Object.entries(campos).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') el.value = v; else el.textContent = v;
  });

  const coletasSection = document.querySelector('.coletas-section');
  if (coletasSection) coletasSection.innerHTML = calc.gerarRelatorioHTML();
}


// ============================================
// ADICIONAR LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Atualizar quando mudar gerente
  const gerenteSelect = document.getElementById('pcGerente');
  if (gerenteSelect) {
    gerenteSelect.addEventListener('change', atualizarUIPrestacao);
  }
  
  // Atualizar quando adicionar/remover coletor ou despesa
  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-remove-coletor, .btn-remove-despesa, #btnColAdd, #btnPcAddDespesa')) {
      setTimeout(atualizarUIPrestacao, 100);
    }
  });
});

async function pcCalcular(){

  
  // gerente / % principal
  const sel = document.getElementById('pcGerente');
  const gerenteId = sel ? sel.value : '';
  const g = (Array.isArray(window.gerentes) ? window.gerentes : []).find(function(x) { 
    return String(x.uid || x.id) === String(gerenteId); 
  });
  
  if (!g) {
    console.warn('Gerente não encontrado:', gerenteId);
    return;
  }
  
  const perc1 = Number(g.comissao) || 0;

  // coletas (total e só as positivas p/ modo "por rota")
  const totalColetasLista = (prestacaoAtual?.coletas || []).reduce(function(s,c) { 
    return s + (Number(c?.valor)||0); 
  }, 0);
  const coletasPositivas = (prestacaoAtual?.coletas || []).reduce(function(s,c) { 
    return s + Math.max(0, Number(c?.valor)||0); 
  }, 0);
  const coletas = totalColetasLista;

  // entradas manuais
  const valorExtra = pcNum('pcValorExtra');
  const adiant     = pcNum('pcAdiant');
  const deveAnt    = pcNum('pcDeveAnterior');
  const divida     = pcNum('pcDivida');
  const credito    = pcNum('pcCredito');

  // despesas
  const despesasTot = (prestacaoAtual?.despesas || []).reduce(function(a,b) { 
    return a + (Number(b?.valor)||0); 
  }, 0);

// pagamentos
const listaPg = Array.isArray(prestacaoAtual?.pagamentos) ? prestacaoAtual.pagamentos : [];
let adiantPg = 0, pagos = 0, pagamentosDivida = 0;
for(let i = 0; i < listaPg.length; i++){
  const p = listaPg[i];
  const forma = (p?.forma || '').toString().toUpperCase();
  const val   = Number(p?.valor) || 0;
  
  if(forma === 'ADIANTAMENTO') adiantPg += val;
  else if(forma === 'VALE')    continue;  // ✅ IGNORA - vales vêm de valeParcAplicado
  else if(forma === 'DIVIDA_PAGA') pagamentosDivida += val;
  else                         pagos    += val;
}

// ✅ Vales vêm SOMENTE de valeParcAplicado
const valesAplicados = Array.isArray(prestacaoAtual?.valeParcAplicado) 
  ? prestacaoAtual.valeParcAplicado 
  : [];

const valePg = valesAplicados.reduce((sum, v) => {
  return sum + (Number(v.aplicado) || 0);
}, 0);

  // ======= CONFIGURAÇÕES DO GERENTE =======
  const temSegundaComissao = !!g.temSegundaComissao || (g.comissao2 > 0);
  const comissaoPorRotaPositiva = !!g.comissaoPorRotaPositiva;
  const baseCalculo = (g.baseCalculo || g.base_calculo || 'COLETAS_MENOS_DESPESAS').toUpperCase();
  const perc2 = Number(g.comissao2) || 0;
  
  // ======= CÁLCULO BASEADO NO MODELO =======
  let baseComissao = 0;
  let valorComissao1 = 0;
  let valorComissao2 = 0;
  let resultado = 0;
        // SALDO ACUMULADO
        const usaSaldoAcumulado = window.SaldoAcumulado && g && perc1 > 0 && perc1 < 50 && 
    (baseCalculo !== 'COLETAS' || g.temSaldoAcumulado || g.temSegundaComissao);

  if (usaSaldoAcumulado) {
    console.log('📊 [SaldoAcumulado] Condições atendidas! Calculando...');
    console.log('📊 [SaldoAcumulado] Parâmetros:', { 
      gerenteId: g.uid, 
      coletas, 
      despesasTot, 
      perc1, 
      perc2,
      baseCalculo,
      temSegundaComissao 
    });
    
    const empresaAtual = window.getCompany ? window.getCompany() : 'BSX';
    
    // ✅ Busca saldo atual do Supabase
    let saldoDoSupabase = await window.SaldoAcumulado.getSaldo(g.uid, empresaAtual);
    let saldoParaCalcular = saldoDoSupabase;
    
    // Se está EDITANDO uma prestação que JÁ FOI SALVA no Supabase,
    // precisamos usar o saldo anterior REAL (que estava antes desta prestação)
    if (window.__prestBeingEdited?.id && window.__prestBeingEdited?.saldoInfo) {
      const saldoInfo = window.__prestBeingEdited.saldoInfo;
      
      // Se tem saldoCarregarAnterior salvo, usa ele (é o saldo ANTES desta prestação)
      if (saldoInfo.saldoCarregarAnterior !== undefined && saldoInfo.saldoCarregarAnterior > 0) {
        saldoParaCalcular = saldoInfo.saldoCarregarAnterior;
        console.log('🔄 Editando - usando saldoCarregarAnterior salvo:', saldoParaCalcular);
      } 
      // Se tem contribuicaoDestaPrestacao, estorna do saldo atual
      else if (saldoInfo.contribuicaoDestaPrestacao !== undefined && saldoInfo.contribuicaoDestaPrestacao > 0) {
        saldoParaCalcular = Math.max(0, saldoDoSupabase - saldoInfo.contribuicaoDestaPrestacao);
        console.log('🔄 Editando - saldo Supabase:', saldoDoSupabase, 
                    '- contribuição anterior:', saldoInfo.contribuicaoDestaPrestacao, 
                    '= saldo para calcular:', saldoParaCalcular);
      }
      // Senão, usa o saldo do banco direto (prestação ainda não contribuiu)
      else {
        saldoParaCalcular = saldoDoSupabase;
        console.log('🔄 Editando - prestação sem contribuição anterior, usando saldo do banco:', saldoParaCalcular);
      }
    } else {
      console.log('🔍 [SaldoAcumulado] Saldo buscado do Supabase:', saldoParaCalcular);
    }
    
    // ✅ CORREÇÃO: Passa parâmetros adicionais para o módulo
    const calculoSaldo = await window.SaldoAcumulado.calcular({
      gerenteId: g.uid,
      empresaId: empresaAtual,
      coletas: coletas,
      despesas: despesasTot,
      comissao: perc1,
      comissao2: temSegundaComissao ? perc2 : 0,  // ✅ NOVO: Segunda comissão
      baseCalculo: baseCalculo,                     // ✅ NOVO: Tipo de base
      saldoAnterior: saldoParaCalcular
    });
    
    console.log('💰 [SaldoAcumulado] Resultado do cálculo:', calculoSaldo);

    // ✅ Valores retornados pelo módulo de saldo acumulado
    baseComissao   = Number(calculoSaldo.baseCalculo) || 0;
    valorComissao1 = Number(calculoSaldo.valorComissao) || 0;
    valorComissao2 = Number(calculoSaldo.valorComissao2) || 0;
    
    // ✅ CORREÇÃO: Usa o resultadoFinal que já considera ambas as comissões
    resultado = Number(calculoSaldo.resultadoFinal) || calculoSaldo.resultado;
    
    // Atualiza o snapshot com informações do saldo
    prestacaoAtual.saldoInfo = {
      saldoCarregarAnterior: calculoSaldo.saldoCarregarAnterior,
      saldoCarregarNovo: calculoSaldo.saldoCarregarNovo,
      // ✅ NOVO: Guarda apenas a contribuição DESTA prestação
      contribuicaoDestaPrestacao: calculoSaldo.resultado < 0 ? Math.abs(calculoSaldo.resultado) : 0,
      baseCalculoSaldo: calculoSaldo.baseCalculo,
      resultadoSemana: calculoSaldo.resultado,
      observacao: calculoSaldo.observacao,
      usandoSaldoAcumulado: true
    };
    
 // Compatibilidade com o resumo antigo
prestacaoAtual.resumo = {
  ...(prestacaoAtual.resumo || {}),
  // saldo negativo que veio ACUMULADO de semanas anteriores
  negAnterior:       Number(calculoSaldo.saldoCarregarAnterior) || 0,
  // saldo que vai ficar para a PRÓXIMA semana
  saldoNegAcarreado: Number(calculoSaldo.saldoCarregarNovo) || 0,
  // campo legado (se alguma parte antiga ainda usar esse nome)
  saldoAnterior:     Number(calculoSaldo.saldoCarregarAnterior) || 0
};


    console.log('💰 Saldo Acumulado aplicado:', {
      baseComissao,
      valorComissao1,
      valorComissao2,
      resultado,
      saldoAnterior: calculoSaldo.saldoCarregarAnterior,
      saldoNovo: calculoSaldo.saldoCarregarNovo
    });

  } else if (temSegundaComissao) {
    // MODELO 1: Dupla comissão (CAÇULA)
    
    // ✅ Primeiro calcula o resultado SEM nenhuma comissão
    const resultadoSemComissao = coletas - despesasTot;
    
    // ✅ Só calcula comissões se resultado for POSITIVO
    if (resultadoSemComissao > 0) {
      baseComissao = coletas;
      valorComissao1 = (baseComissao * perc1) / 100;
      
      const resultadoApos1aComissao = coletas - valorComissao1 - despesasTot;
      
      if (resultadoApos1aComissao > 0) {
        valorComissao2 = (resultadoApos1aComissao * perc2) / 100;
      } else {
        valorComissao2 = 0;
      }
      
      resultado = coletas - valorComissao1 - valorComissao2 - despesasTot;
      
    } else {
      // ✅ Resultado negativo - ZERA todas as comissões
      baseComissao = 0;
      valorComissao1 = 0;
      valorComissao2 = 0;
      resultado = resultadoSemComissao;
    }
    
  } else if (comissaoPorRotaPositiva) {
    // MODELO 2: Comissão por rota positiva (MARCOS)
    baseComissao = coletasPositivas;
    valorComissao1 = (baseComissao * perc1) / 100;
    resultado = coletas - valorComissao1 - despesasTot;
    
  } else {
    // MODELO 3: Padrão ou Comissão 50%
    
    if (baseCalculo === 'COLETAS') {
      // ✅ Comissão sobre COLETAS (não 50%)
      const resultadoSemComissao = coletas - despesasTot;
      
      // Se resultado negativo E comissão < 50%, NÃO calcula
      if (resultadoSemComissao < 0 && perc1 < 50) {
        baseComissao = 0;
        valorComissao1 = 0;
        resultado = resultadoSemComissao;
      } else {
        // Senão, calcula comissão sobre coletas
        baseComissao = coletas;
        valorComissao1 = (baseComissao * perc1) / 100;
        resultado = coletas - valorComissao1 - despesasTot;
      }
      
    } else {
      // ✅ Comissão sobre (COLETAS - DESPESAS)
      baseComissao = coletas - despesasTot;
      
      // Se base negativa E comissão < 50%, NÃO calcula
      if (baseComissao < 0 && perc1 < 50) {
        valorComissao1 = 0;
        resultado = baseComissao;
      } else {
        // Comissão 50% calcula SEMPRE (mesmo negativo)
        valorComissao1 = (baseComissao * perc1) / 100;
        resultado = baseComissao - valorComissao1;
      }
    }
  }
// ✅ FÓRMULA CORRETA: A Pagar = Resultado + Acréscimos - Crédito
// Acréscimos = Deve Anterior + Adiantamento + Valor Extra + Vales Aplicados
const totalAcrescimos = deveAnt + adiant + valorExtra + valePg;
const aPagar = resultado + totalAcrescimos - credito;

// ✅ FÓRMULA CORRETA: RESTAM = A Pagar - Pagamentos
// Pagamentos = Normal + Adiantamento (não inclui vales pois já estão nos acréscimos)
const restam = aPagar - (pagos + adiantPg);

  // UI - Atualizar campos
  const $ = function(id) { return document.getElementById(id); };
  if($('pcResultado')) $('pcResultado').value = fmtBRL(resultado);
  if($('pcPerc'))      $('pcPerc').value      = perc1 + '%' + (perc2 ? ' + ' + perc2 + '%' : '');
  if($('pcPagar'))     $('pcPagar').value     = fmtBRL(aPagar);
  if($('pcRestam'))    $('pcRestam').value    = fmtBRL(restam);

  // ✅ ADICIONA COR VERMELHA SE NEGATIVO
  if (restam < 0) {
    $('pcRestam').style.color = '#b91c1c';
    $('pcRestam').style.fontWeight = 'bold';
  } else {
    $('pcRestam').style.color = '';
    $('pcRestam').style.fontWeight = '';
  }

  // snapshot completo
  prestacaoAtual.resumo = {
    coletas: coletas, 
    coletasPos: coletasPositivas, 
    valorExtra: valorExtra, 
    adiant: adiant, 
    deveAnt: deveAnt, 
    divida: divida, 
    credito: credito,
    despesas: despesasTot, 
    resultado: resultado,
    perc: perc1, 
    perc2: perc2,
    comissaoVal: valorComissao1 + valorComissao2, 
    comis1: valorComissao1, 
    comis2: valorComissao2,
    baseComissao: baseComissao,
    totalAcrescimos: totalAcrescimos,  // ✅ Adiciona total de acréscimos
    aPagar: aPagar, 
    pagos: pagos, 
    restam: restam, 
    baseColeta: coletas,
    baseColeta: coletas,
resultadoSemana: coletas - despesasTot,
// saldo negativo acumulado que já existia ANTES dessa prestação
negAnterior: (
  (prestacaoAtual.saldoInfo && Number(prestacaoAtual.saldoInfo.saldoCarregarAnterior || 0)) ||
  (prestacaoAtual.resumo && Number(prestacaoAtual.resumo.negAnterior || 0)) ||
  0
),
// saldo que vai ficar para a PRÓXIMA prestação
saldoNegAcarreado: (
  (prestacaoAtual.saldoInfo && Number(prestacaoAtual.saldoInfo.saldoCarregarNovo || 0)) ||
  (prestacaoAtual.resumo && Number(prestacaoAtual.resumo.saldoNegAcarreado || 0)) ||
  0
),
adiantPg: adiantPg,
totalColetasLista: coletas, 
totalVales: valePg,
flags: { 
  porRota: comissaoPorRotaPositiva, 
  sequencial: false,
  temSegundaComissao: temSegundaComissao,
  baseCalculo: baseCalculo
}
  };
}
// Atualiza estilo visual dos campos monetários
function atualizarEstilosMonetarios() {
  const restamEl = document.getElementById('pcRestam');
  if (!restamEl) return;
  
  const valor = String(restamEl.value || '').replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(valor) || 0;
  
  if (num < 0) {
    restamEl.classList.add('valor-negativo');
    restamEl.classList.remove('valor-positivo');
  } else if (num > 0) {
    restamEl.classList.add('valor-positivo');
    restamEl.classList.remove('valor-negativo');
  } else {
    restamEl.classList.remove('valor-negativo', 'valor-positivo');
  }
}

// ===== CRIAR PENDÊNCIA DE PAGAMENTO (quando empresa deve ao gerente) =====
function criarPendenciaPagamento(prestacao) {
  try {
    // ✅ BUSCA LANÇAMENTOS JÁ CONFIRMADOS (não deve recriar pendências para eles)
    const lancamentos = window.lanc || window.__getLanc?.() || [];
    const confirmadosUIDs = new Set(
      lancamentos
        .map(l => l?.meta?.fromUID)
        .filter(Boolean)
    );
    
    // ✅ REMOVE APENAS PENDÊNCIAS AINDA NÃO CONFIRMADAS
    let todasPendencias = __getPendencias();
    todasPendencias = todasPendencias.filter(p => {
      // Se não é desta prestação, mantém
      if (p.prestId !== prestacao.id) return true;
      
      // Se já foi confirmado (existe lançamento), mantém a pendência confirmada
      // (ela será removida naturalmente pelo sistema de confirmação)
      if (confirmadosUIDs.has(p.uid) || confirmadosUIDs.has(p.altUID)) {
        console.log('⚠️ Mantendo pendência já confirmada:', p.uid);
        return true;
      }
      
      // Remove pendências não confirmadas (serão recriadas se necessário)
      return false;
    });
    __setPendencias(todasPendencias);

    // ✅ NOVO: Só cria pendência dos pagamentos do tipo "DIVIDA_PAGA"
    const pagamentosDivida = (prestacao.pagamentos || [])
      .filter(p => String(p.forma || '').toUpperCase() === 'DIVIDA_PAGA');
    
    // Se não tem pagamento de dívida, não cria pendência
    if (!pagamentosDivida.length) {
      console.log('ℹ️ Sem pagamentos de dívida para criar pendência');
      return;
    }
    
    // Busca dados do gerente
    const g = (window.gerentes || []).find(x => x.uid === prestacao.gerenteId);
    const gerenteNome = g?.nome || 'Gerente desconhecido';
    
    // Cria uma pendência para CADA pagamento de dívida
    const pendencias = __getPendencias();
    let criadas = 0;
    
    pagamentosDivida.forEach(pag => {
      const valorPagamento = Number(pag.valor) || 0;
      if (valorPagamento <= 0) return;
      
      // UID único para este pagamento
      const uid = `DIVPAG:${prestacao.id}:${pag.id}:${valorPagamento}`;
      
      // ✅ VERIFICA SE JÁ FOI CONFIRMADO
      if (confirmadosUIDs.has(uid)) {
        console.log('⚠️ Pagamento já confirmado, não recria:', uid);
        return;
      }
      
      // Verifica se já existe pendência
      const jaExiste = pendencias.some(p => p.uid === uid);
      if (jaExiste) {
        console.log('⚠️ Pendência já existe para este pagamento');
        return;
      }
      
      // Cria pendência
const novaPendencia = {
  id: (crypto?.randomUUID ? crypto.randomUUID() : 'pend_' + Date.now() + '_' + Math.random()),
  uid: `DIVPAG:${prestacao.id}:${pag.id}:${valorPagamento}`,
  prestId: prestacao.id,
  gerenteId: prestacao.gerenteId,
  gerenteNome: gerenteNome,
  data: pag.data || prestacao.fim || prestacao.ini || new Date().toISOString().slice(0,10),
  valorOriginal: valorPagamento,
  valorConfirm: valorPagamento,
  info: 'Dívida Prest. ' + (prestacao.ini||'').slice(5).split('-').reverse().join('/') + 
        '–' + (prestacao.fim||'').slice(5).split('-').reverse().join('/') +
        (pag.obs ? ' - ' + pag.obs : ''),
  forma: 'PIX',
  status: 'PENDENTE',
  edited: false,
  createdAt: new Date().toISOString(),
  
  // ✅ CRÍTICO: Estes dois campos determinam onde aparece!
  tipoCaixa: 'PAGO',    // ← Define que é PAGAMENTO
  tipo: 'PAGAR'         // ← Confirma que é PAGAMENTO
};
      
      pendencias.push(novaPendencia);
      criadas++;
      
      console.log('✅ Pendência de dívida criada:', valorPagamento);
    });
    
    if (criadas > 0) {
      __setPendencias(pendencias);
      
      // Atualiza interface do financeiro
      try {
        if (typeof window.renderFinPendencias === 'function') {
          window.renderFinPendencias();
        }
      } catch(e) {
        console.warn('Erro ao atualizar interface financeiro:', e);
      }
      
      return criadas;
    }
    
  } catch(e) {
    console.error('Erro ao criar pendência de pagamento:', e);
  }
}

// ✅ ADICIONA A FUNÇÃO __negMakeUID SE NÃO EXISTIR
window.__negMakeUID = window.__negMakeUID || function(prest, valorAbs){
  const pid  = prest?.id ?? 'prest';
  const data = prest?.fim || prest?.ini || '';
  const v    = Number(valorAbs)||0;
  // estável e independente de índice
  const stable = `NEG:${pid}|D:${data}|V:${v.toFixed(2)}`;
  // legado (compatibilidade)
  const legacy = `prest:saida:${pid}:${data}:${v}`;
  return { stable, legacy };
};
// ===== FUNÇÕES AUXILIARES DE DESENHO NO CANVAS =====

// Desenha texto no canvas
function drawText(ctx, text, x, y, align = 'left') {
  if (!ctx) return;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || ''), x, y);
}

// Desenha par chave-valor
function drawKV(ctx, x, y, w, key, value, opts = {}) {
  const fontSize = opts.size || 14;
  const bold = opts.bold ? 'bold ' : '';
  const color = opts.color || '#000';
  const valueColor = opts.valueColor || color;
  
  ctx.font = `${bold}${fontSize}px Arial`;
  
  // Chave (esquerda)
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(String(key || ''), x, y);
  
  // Valor (direita)
  ctx.fillStyle = valueColor;
  ctx.textAlign = 'right';
  ctx.fillText(String(value || ''), x + w, y);
  
  return y + fontSize + (opts.spacing || 8);
}

// Versão 2 do drawKV (usada no código)
function drawKV2(ctx, x, y, w, key, value, opts = {}) {
  return drawKV(ctx, x, y, w, key, value, opts);
}

// Desenha cabeçalho de grupo
function drawGroup(ctx, x, y, w, title, fontSize = 16) {
  const h = fontSize + 12;
  
  // Fundo cinza
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x, y, w, h);
  
  // Borda
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  
  // Texto
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + w/2, y + h/2);
  
  return y + h;
}

// Desenha linha horizontal
function drawLine(ctx, x1, y, x2, color = '#000', width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

// ==== PRESTAÇÕES: helpers de desenho (restaurados do backup) ====
(function(){
  const _g = window;

  // padding vertical entre grupos (compatível com "groupPad" do backup)
  const GROUP_PAD = 8;
  Object.defineProperty(_g, 'groupPad', { value: GROUP_PAD, writable: false });

  _g.drawText = function drawText(ctx, txt, x, y, align = 'left') {
    ctx.textAlign = align || 'left';
    ctx.fillText(String(txt ?? ''), x, y);
  };

  _g.drawGroup = function drawGroup(ctx, x, y, w, title, size = 20) {
    const h = size + 14;
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + size + 'px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(String(title || ''), x + 12, y + Math.round(h * 0.7));
    ctx.fillStyle = '#000';
    return y + h + GROUP_PAD;
  };

  _g.drawKV2 = function drawKV2(ctx, x, y, w, key, value, opts = {}) {
    const size = Number(opts.size) || 16;
    const lh = Math.round(size * 1.6);
    ctx.font = (opts.bold ? 'bold ' : '') + size + 'px Arial';

    // chave à esquerda
    ctx.textAlign = 'left';
    ctx.fillStyle = opts.color || '#000';
    ctx.fillText(String(key ?? ''), x, y + Math.round(lh * 0.7));

    // valor à direita (pode ter cor diferente)
    ctx.textAlign = 'right';
    ctx.fillStyle = opts.valueColor || ctx.fillStyle;
    ctx.fillText(String(value ?? ''), x + w, y + Math.round(lh * 0.7));

    // volta cor padrão
    ctx.fillStyle = '#000';
    return y + lh;
  };
})();


// Desenha o relatório direto no <canvas id="pcCanvas"> da tela atual 
async function pcDesenharCanvas(){
  const cvs = document.getElementById('pcCanvas');
  if(!cvs){ return; }
  if(!cvs.getContext){ alert('Seu navegador não suporta canvas.'); return; }
  const ctx = cvs.getContext('2d');

    // monta o "rec" atual a partir do formulário
    const rec = await getPrestacaoFromForm();  // ✅ AGUARDA
    const dataURL = (typeof window.prestToDataURL === 'function') 
  ? window.prestToDataURL(rec) 
  : null;

if (!dataURL) {
  console.error('[Relatórios] Não foi possível gerar imagem da prestação');
  // Continua sem a imagem
}
  
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      // mantém proporção, ocupando toda a área
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
    };
    img.src = dataURL;
  

  // fundo/topo
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.fillStyle='#ffe600'; ctx.fillRect(0,0,cvs.width,80);
  ctx.fillStyle='#000'; ctx.font='bold 22px Arial';

  const gidSel = document.getElementById('pcGerente')?.value || '';
  const g = (window.gerentes || []).find(x=>String(x.uid||x.id)===String(gidSel));
  const periodo = `${fmtData(document.getElementById('pcIni')?.value||'')} a ${fmtData(document.getElementById('pcFim')?.value||'')}`;
  drawText(ctx, 'Gerente', 20, 50, 'left');
  const coletorLinha = g ? (g.nome || '') : '';
  drawText(ctx, coletorLinha, 120, 50, 'left');  
  drawText(ctx, 'Período:', cvs.width/2, 25, 'center');
  drawText(ctx, periodo, cvs.width/2, 55, 'center');

  const gap = 20;
  const leftX = 20, leftY = 100, leftW = Math.floor(cvs.width*0.58), leftH = cvs.height-leftY-40;
  const rightX = leftX + leftW + gap, rightY = 100, rightW = cvs.width - rightX - 20, rightH = cvs.height-rightY-40;

  // ===== TABELA DE DESPESAS (esquerda) =====
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.strokeRect(leftX, leftY, leftW, leftH);

  const headerH = 30;
  const col1W = Math.floor(leftW * 0.18);
  const col3W = Math.floor(leftW * 0.20);
  const col2W = leftW - col1W - col3W;

  ctx.fillStyle = '#111';
  ctx.fillRect(leftX, leftY, leftW, headerH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('FICHA', leftX + 8, leftY + 20);
  ctx.fillText('INFORMAÇÕES', leftX + col1W + 8, leftY + 20);
  ctx.textAlign = 'right';
  ctx.fillText('VALOR', leftX + leftW - 8, leftY + 20);

  ctx.beginPath();
  ctx.moveTo(leftX, leftY + headerH);
  ctx.lineTo(leftX + leftW, leftY + headerH);
  ctx.moveTo(leftX + col1W, leftY);
  ctx.lineTo(leftX + col1W, leftY + leftH);
  ctx.moveTo(leftX + col1W + col2W, leftY);
  ctx.lineTo(leftX + col1W + col2W, leftY + leftH);
  ctx.stroke();

  const bodyH  = leftH - headerH - 28;
  const itens  = (prestacaoAtual.despesas || []);
  const qtdLin = Math.max(itens.length, 1);

  let rowH, fz;
  if (qtdLin <= 27) { rowH = 32; fz = 16; }
  else { rowH = Math.floor(bodyH / qtdLin); fz = Math.max(10, Math.floor(rowH * 0.60)); }

  let y = leftY + headerH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(leftX, y, leftW, bodyH);
  ctx.clip();

  itens.forEach(d => {
    const ficha = String(d.ficha || '');
    const info  = String(d.info  || '');
    const valor = fmtBRL(Number(d.valor) || 0);

    ctx.font = `${fz}px Arial`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.fillText(ficha, leftX + 8, y + Math.round(rowH * 0.7));

    const maxInfoW = col2W - 12;
    let txt = info;
    while (ctx.measureText(txt).width > maxInfoW && txt.length > 0) txt = txt.slice(0, -1);
    if (txt !== info) txt = txt.slice(0, -1) + '…';
    ctx.fillText(txt, leftX + col1W + 8, y + Math.round(rowH * 0.7));

    ctx.textAlign = 'right';
    ctx.fillStyle = '#b91c1c';
    ctx.fillText(valor, leftX + col1W + col2W + col3W - 8, y + Math.round(rowH * 0.7));

    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(leftX, y + rowH - 2);
    ctx.lineTo(leftX + leftW, y + rowH - 2);
    ctx.stroke();

    y += rowH;
  });

  ctx.restore();

  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL DESPESAS:', leftX + 10, leftY + leftH - 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText(fmtBRL((prestacaoAtual.resumo || {}).despesas || 0), leftX + leftW - 10, leftY + leftH - 12);

  // ===== COLUNA DIREITA (Resumo) =====
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(rightX, rightY, rightW, rightH);

  // Variáveis do resumo
  const r = prestacaoAtual.resumo || {};
  const coletas2 = Number(r.coletas) || 0;
  const despesas2 = Number(r.despesas) || 0;
  const perc2 = Number(r.perc) || 0;
  const deveAnt2 = Number(r.negAnterior || r.deveAnt || 0);
  const c1 = Number(r.comis1) || 0;
  const c2 = Number(r.comis2) || 0;
  const temSegundaComissao = c2 > 0;
  
  // Constantes de tamanho
  const R_GROUP = 18;
  const R_BOLD = 16;
  const R_LINE = 14;
  const R_SUB = 12;
  const groupPad = 8;

  // Inicializa posição Y da coluna direita
  let ry = rightY + 10;


// ========================================
// SEQUÊNCIA PARA MODELO COM 2ª COMISSÃO
// ========================================
if (temSegundaComissao) {
  // 1. Coletas
  ry = drawKV2(ctx, rightX + 12, ry + 2, rightW - 24, 'Coletas', fmtBRL(coletas2), 
               { bold:true, size:R_BOLD });
  
  // 2. Base Comissão
  const baseComissao2 = Number(r.baseComissao || coletas2);
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Base Comissão', fmtBRL(baseComissao2), 
               { color:'#16a34a', valueColor:'#16a34a', size:R_LINE });
  
  // 3. Saldo a Carregar
  const saldoCarry2 = Number(r.saldoNegAcarreado || 0);
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Saldo a Carregar', fmtBRL(saldoCarry2), 
               { valueColor:'#b91c1c', size:R_LINE });
  
  // 4. Comissão 1
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
    'Comissão 1 (' + (Number(r.perc)||0) + '%)',
    fmtBRL(c1),
    { valueColor:'#16a34a', size: R_LINE }
  );
  
  // 5. Resultado (Coletas - Com. 1)
  const resIntermediario = coletas2 - c1;
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
    'Resultado (Coletas - Com. 1)',
    fmtBRL(resIntermediario),
    { size: R_LINE }
  );
  
  // 6. Comissão 2
  const rot = r?.flags?.sequencial ? 'Comissão 2 (seq.)' : 'Comissão 2';
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
    rot + ' (' + (Number(r.perc2)||0) + '%)',
    fmtBRL(c2),
    { valueColor:'#16a34a', size: R_LINE }
  );
  
  // 7. Despesas
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Despesas', fmtBRL(despesas2), 
               { valueColor:'#b91c1c', size:R_LINE });
  
  // 8. Total (Coletas - Despesas - Comissões)
  const totalIntermediario = coletas2 - despesas2 - c1 - c2;
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 
    'Total (Coletas - Despesas - Comissões)', 
    fmtBRL(totalIntermediario), 
    { bold:true, size:R_BOLD }
  );
  
  // 9. Resultado FINAL (sem deve anterior)
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Resultado', fmtBRL(totalIntermediario),
               { bold:true, size:R_BOLD });

} 
// ========================================
// SEQUÊNCIA PARA MODELOS SEM 2ª COMISSÃO
// ========================================
else {
  // Modelo padrão ou por rota positiva
  const _resColetas2 = coletas2 - despesas2;
  const showNeg2 = perc2 > 0 && perc2 < 50;  // ✅ CORREÇÃO: definir showNeg2 neste bloco
  
  ry = drawKV2(ctx, rightX + 12, ry + 2, rightW - 24, 'Coletas', fmtBRL(coletas2),
               { bold:true, size:R_BOLD });
  
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Despesas', fmtBRL(despesas2), 
               { bold:true, valueColor:'#b91c1c', size:R_LINE });
  
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Total (Coletas - Despesas)', 
               fmtBRL(_resColetas2), { bold:true, size:R_BOLD });

  // Se tem modo antigo (com carry de negativo)
  if (showNeg2) {
    const baseComissao2 = Number(r.baseComissao || r.comissaoBase || 0);
    const saldoCarry2   = Number(r.saldoNegAcarreado || 0);

    ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Base Comissão', fmtBRL(baseComissao2), 
                 { color:'#16a34a', valueColor:'#16a34a', size:R_LINE });
    ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Saldo a Carregar', fmtBRL(saldoCarry2), 
                 { valueColor:'#b91c1c', size:R_LINE });
  }

  // Se tem comissão (mesmo sem ser 2ª)
  if (c1 > 0) {
    ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
      'Comissão 1 (' + (Number(r.perc)||0) + '%)',
      fmtBRL(c1),
      { valueColor:'#16a34a', size: R_LINE }
    );
  }

  // Resultado = (Coletas - Despesas) - Comissão (SEM deve anterior)
  const resultadoFinal = _resColetas2 - c1;
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Resultado', fmtBRL(resultadoFinal),
               { bold:true, size:R_BOLD });
}

// ---- ACRÉSCIMOS ---- (PARA TODOS OS MODELOS)
ry += groupPad;
ry = drawGroup(ctx, rightX, ry + 6, rightW, 'ACRÉSCIMOS', R_GROUP);
ry += groupPad;
ctx.fillStyle = '#fff';
ctx.fillRect(rightX + 1, ry - Math.ceil(groupPad / 2), rightW - 2, 2000);

// Lista os itens individuais
ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Adiantamento', fmtBRL(r.adiant), 
             { size: R_LINE });

ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Deve Anterior', fmtBRL(deveAnt2),
             { bold: true, size: R_LINE });

ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Valor Extra', fmtBRL(r.valorExtra), 
             { size: R_LINE });

// VALES
const iniPNG = rec.ini || '';
const fimPNG = rec.fim || '';
const gidPNG = rec.gerenteId || '';  // ← RENOMEADO de gidSel para gidPNG
const parcelasVale = Array.isArray(rec.valeParcAplicado) ? rec.valeParcAplicado : [];
const aplicadoPorId = new Map(parcelasVale.map(function(p) { 
  return [p.id, Number(p.aplicado)||0]; 
}));

const saldoDepoisPorVale = (function() {
  try {
    if (!gidPNG || !iniPNG || !fimPNG) return new Map();  // ← usar gidPNG
    const todos = (window.valesLog?.list({gerenteId: gidPNG}) || [])  // ← usar gidPNG
      .filter(function(ev) { return ev.periodoIni === iniPNG && ev.periodoFim === fimPNG; });
    const m = new Map();
    todos.forEach(function(ev) { m.set(ev.valeId, Number(ev.saldoDepois)||0); });
    return m;
  } catch(e) { return new Map(); }
})();

const itensVale = parcelasVale.length
  ? parcelasVale.map(function(p) { return { id:p.id, cod:p.cod, aplicado: aplicadoPorId.get(p.id)||0 }; })
  : (window.vales||[]).filter(function(v) { return v.gerenteId===gidPNG && !v.quitado; })  // ← usar gidPNG
                       .map(function(v) { return { id:v.id, cod:v.cod, aplicado: aplicadoPorId.get(v.id)||0 }; });

let totalVales = 0;
itensVale.forEach(function(p) {
  const v = (window.vales||[]).find(function(x) { return x.id===p.id; });
  const codTxt = v?.cod || p.cod || '—';
  const aplicado = Number(p.aplicado)||0;
  totalVales += aplicado;

  const saldoLabel = saldoDepoisPorVale.has(p.id)
    ? saldoDepoisPorVale.get(p.id)
    : Math.max((Number(v?.valor)||0) - aplicado, 0);

  const rotulo = 'VALE ' + codTxt + ': ' + fmtBRL(saldoLabel);
  ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, rotulo, fmtBRL(Math.abs(aplicado)),
               { valueColor:'#b91c1c', size: R_LINE });
});

// ✅ TOTAL ACRÉSCIMOS (Deve Anterior + Adiantamento + Valor Extra + Vales)
const totalAcrescimos = (Number(r.adiant)||0) + deveAnt2 + (Number(r.valorExtra)||0) + totalVales;

ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Total Acréscimos', fmtBRL(totalAcrescimos),
             { bold:true, valueColor:'#b91c1c', size: R_BOLD });

// listas de pagamentos 
const _pagts = Array.isArray(rec.pagamentos) ? rec.pagamentos : [];
const adiantamentos = _pagts
  .filter(function(p) { return String(p.forma||'').toUpperCase() === 'ADIANTAMENTO'; })
  .sort(function(a,b) { return (a.data||'').localeCompare(b.data||''); });
const pagamentosNormais = _pagts
  .filter(function(p) {
    const f = String(p.forma||'').toUpperCase();
    return f !== 'ADIANTAMENTO' && f !== 'VALE';
  })
  .sort(function(a,b) { return (a.data||'').localeCompare(b.data||''); });

// ---- RESULTADO ----
ry += groupPad;
ry = drawGroup(ctx, rightX, ry + 6, rightW, 'RESULTADO', R_GROUP);
ry += groupPad;

ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Crédito', fmtBRL(r.credito),
             { bold:true, color:'#16a34a', valueColor:'#16a34a', size: R_LINE });

// À Pagar = Resultado das Coletas + Total Acréscimos - Crédito
let resultadoColetas = 0;
if (temSegundaComissao) {
  resultadoColetas = coletas2 - despesas2 - c1 - c2;
} else {
  resultadoColetas = (coletas2 - despesas2) - c1;  // ✅ CORREÇÃO: usar cálculo direto
}

const aPagarCalc = Number(r.aPagar) || 0;  

ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'À Pagar', fmtBRL(aPagarCalc),
             { bold:true, size: R_BOLD });

// ADIANTAMENTOS / PAGAMENTOS
adiantamentos.forEach(function(p) {
  const rot = fmtData(p.data||'') + ' — ADIANTAMENTO';
  ry = drawKV2(ctx, rightX+26, ry, rightW-52, rot, fmtBRL(Number(p.valor)||0),
               { color:'#16a34a', valueColor:'#16a34a', size: R_SUB });
});

pagamentosNormais.forEach(function(p) {
  const forma = (p.forma || '').toString().toUpperCase() || 'PAGTO';
  const rot = fmtData(p.data||'') + ' — ' + forma;
  ry = drawKV2(ctx, rightX+12, ry, rightW-24, rot, fmtBRL(Number(p.valor)||0),
               { color:'#16a34a', valueColor:'#16a34a', size: R_SUB });
});


// RESTAM (com cor diferente se negativo)
const restamValor = Number(r.restam) || 0;
const restamCor = restamValor < 0 ? '#b91c1c' : '#111'; // Vermelho se negativo
const restamTexto = restamValor < 0 
  ? '(EMPRESA DEVE AO GERENTE)' 
  : '';

ctx.font = 'bold ' + R_REST + 'px Arial';
ctx.fillStyle = restamCor;
ctx.textAlign = 'left';  
ctx.fillText('RESTAM:', rightX+12, ry+32);
ctx.textAlign = 'right'; 
ctx.fillText(fmtBRL(restamValor), rightX+rightW-12, ry+32);

// Adiciona aviso se negativo
if (restamTexto) {
  ry += 32;
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#b91c1c';
  ctx.textAlign = 'center';
  ctx.fillText(restamTexto, rightX + rightW/2, ry + 20);
};
}

// Garante migrar parcelas de VALE a partir da lista de pagamentos da prestação
function __backfillValeParcFromPagamentos(arrPag, gerenteId) {
  const out = [];
  try {
    // 🔐 blindagem: só iteramos se for array
    const list = Array.isArray(arrPag)
      ? arrPag
      : (Array.isArray(arrPag?.lista) ? arrPag.lista : []);

    list.forEach(p => {
      const forma = String(p.forma || '').toUpperCase();
      if (forma !== 'VALE') return;

      // aceitamos p.valeId/p.cod/p.codigo/p.ref
      const id   = p.valeId || p.id || p.ref || null;
      const cod  = p.cod || p.codigo || p.ref || '';
      const apl  = Number(p.valor) || 0;

      if (!id || !apl) return;
      out.push({ id, cod, aplicado: apl, gerenteId: gerenteId || '' });
    });
  } catch (e) {
    console.warn('__backfillValeParcFromPagamentos: falha ao migrar', e);
  }
  return out;
}



/* =================== /RELATÓRIO NO CANVAS =================== */

(function() {
  const btn = document.getElementById('btnPcSalvar');
  if (!btn || btn.__pcWired) return;
  btn.__pcWired = true;
  
  addPcListener(btn, 'click', async function() {  
    await pcCalcular();  // ✅ AGUARDA o recálculo terminar
  const ini = document.getElementById('pcIni').value;
  const fim = document.getElementById('pcFim').value || new Date().toISOString().slice(0,10);
  const gerenteId = document.getElementById('pcGerente').value;
  const g = (window.gerentes || []).find(x=>String(x.uid||x.id)===String(gerenteId)) || {};
  
  if(!gerenteId || !ini || !fim){ 
    alert('Selecione Gerente e informe o período.'); 
    return; 
  }

  const arr = await window.carregarPrestacoesGlobal();

  let reusedId = null;
  let prevRec  = null;
  let idx      = -1;

  if (window.__prestBeingEdited?.id) {
    idx = arr.findIndex(p => p.id === window.__prestBeingEdited.id);
  }

  if (idx === -1) {
    idx = arr.findIndex(p => p.gerenteId===gerenteId && p.ini===ini && p.fim===fim);
  }

  if (idx > -1) {
    reusedId = arr[idx].id;
    prevRec  = arr[idx];
    arr.splice(idx, 1);
  }

  __recalcValeParcFromPagamentos();

  const migVale = (
    !prestacaoAtual.valeParcAplicado || prestacaoAtual.valeParcAplicado.length === 0
  )
    ? __backfillValeParcFromPagamentos(prestacaoAtual.pagamentos, gerenteId)
    : prestacaoAtual.valeParcAplicado.slice();
  
  prestacaoAtual.valeParcAplicado = migVale;
  
  const recPrest = {
    id: reusedId || uid(),
    gerenteId,
    gerenteNome: (g?.nome || '(excluído)'),
    ini, fim,
    despesas:  (prestacaoAtual.despesas  || []).map(d => ({...d})),
    pagamentos:(prestacaoAtual.pagamentos|| []).map(p => ({...p})),
    coletas:   (prestacaoAtual.coletas   || []).map(c => ({...c})),
    vales:     (prestacaoAtual.vales     || []).map(v => ({...v})),
    valesSel:  (prestacaoAtual.valeSelec || []).map(v => ({...v})),
    resumo:    {...(prestacaoAtual.resumo || {})},
    saldoInfo: prestacaoAtual.saldoInfo ? {...prestacaoAtual.saldoInfo} : null, // ✅ SALVA O SALDO INFO
    valeParcAplicado: migVale.map(x => ({...x})),
  };

  if (!prestacaoAtual.valeParcAplicado || prestacaoAtual.valeParcAplicado.length === 0){
    prestacaoAtual.valeParcAplicado =
      __backfillValeParcFromPagamentos(prestacaoAtual.pagamentos, gerenteId);
  }

  __applyValesOnSave(prevRec, recPrest);
  __valesReload();  

  console.log('🔍 DEBUG SALDO - Verificando condições para salvar:', {
    temSaldoAcumulado: !!window.SaldoAcumulado,
    saldoInfo: prestacaoAtual.saldoInfo,
    usandoSaldoAcumulado: prestacaoAtual.saldoInfo?.usandoSaldoAcumulado,
    prestacaoAtualCompleta: prestacaoAtual
  });
  if (window.SaldoAcumulado && prestacaoAtual.saldoInfo?.usandoSaldoAcumulado) {
  
    // ✅ VERIFICA SE É EDIÇÃO
    const empresaId = recPrest.empresaId || (window.getCompany ? window.getCompany() : 'BSX');
    
    // Se está editando uma prestação existente (idx > -1)
    if (idx > -1 && prevRec && prevRec.saldoInfo) {
      // ESTORNA o saldo da versão anterior
      const saldoAtual = await window.SaldoAcumulado.getSaldo(recPrest.gerenteId, empresaId);
      const saldoAnteriorPrestacao = prevRec.saldoInfo.saldoCarregarNovo || 0;
      
      // Remove o saldo antigo antes de adicionar o novo
      const saldoCorrigido = Math.max(0, saldoAtual - saldoAnteriorPrestacao);
      
      // Agora adiciona o novo saldo
      const novoSaldoFinal = saldoCorrigido + (prestacaoAtual.saldoInfo?.saldoCarregarNovo || 0);
      
      // ✅ AWAIT ADICIONADO
      await window.SaldoAcumulado.setSaldo(recPrest.gerenteId, empresaId, novoSaldoFinal);
      
      console.log('🔄 Editando prestação - Saldo ajustado:', {
        saldoAtual,
        saldoAnteriorPrestacao,
        saldoCorrigido,
        novoSaldoAdicionado: prestacaoAtual.saldoInfo?.saldoCarregarNovo || 0,
        novoSaldoFinal
      });
    } else {
      // É uma prestação nova - apenas salva
      const saldoNovo = prestacaoAtual.saldoInfo?.saldoCarregarNovo || 0;
      
      console.log('💾 Salvando saldo para nova prestação:', {
        gerenteId: recPrest.gerenteId,
        empresaId,
        saldoNovo,
        saldoInfo: prestacaoAtual.saldoInfo
      });
      
      // ✅ AWAIT ADICIONADO
      await window.SaldoAcumulado.setSaldo(
        recPrest.gerenteId,
        empresaId,
        saldoNovo
      );
      
      console.log('✅ Nova prestação - Saldo salvo:', saldoNovo);
    }
  }

  arr.push(recPrest);

  if (prestacaoAtual.saldoInfo?.usandoSaldoAcumulado) {
    const empresaAtual = window.getCompany ? window.getCompany() : 'BSX';
    const gerenteId = document.getElementById('pcGerente')?.value;
    
    if (gerenteId && window.SaldoAcumulado) {
      try {
        await window.SaldoAcumulado.setSaldo(
          gerenteId, 
          empresaAtual, 
          prestacaoAtual.saldoInfo.saldoCarregarNovo
        );
        console.log('✅ Saldo acumulado atualizado no Supabase:', 
                    prestacaoAtual.saldoInfo.saldoCarregarNovo);
      } catch(e) {
        console.error('❌ Erro ao salvar saldo acumulado:', e);
      }
    }
  }

  // ✅ Salva no Supabase + localStorage
  if (typeof window.salvarPrestacaoGlobal === 'function') {
    try {
      await window.salvarPrestacaoGlobal(recPrest);
      console.log('✅ Prestação salva no Supabase:', recPrest.id);
    } catch(e) {
      console.error('❌ Erro ao salvar no Supabase:', e);

    }
  } 

  
  
  try { window.__syncAbertasMirror(); } catch {}

// Saldo negativo agora é gerenciado apenas pelo SaldoAcumulado (Supabase)
console.log('✅ Saldo gerenciado via SaldoAcumulado (Supabase)');

// ✅ CRIA PENDÊNCIA APENAS DOS PAGAMENTOS DE DÍVIDA
const qtdPendencias = criarPendenciaPagamento(recPrest);

if (qtdPendencias && qtdPendencias > 0) {
  alert('Prestação salva!\n\n' + qtdPendencias + ' pagamento(s) de dívida enviado(s) ao Financeiro para confirmação.');
} else {
  alert('Prestação salva com sucesso!');
}

// Salvar despesas no Supabase
console.log('💰 Iniciando salvamento de despesas no Supabase...');
const despesasValidas = (prestacaoAtual.despesas || []).filter(d => {
  // Pula despesas vazias (sem descrição E sem valor)
  const temValor = Number(d.valor) > 0;
  const temDescricao = (d.info || '').trim().length > 0;
  return temValor || temDescricao;
});
console.log('💰 Despesas válidas a salvar:', despesasValidas.length, 'de', (prestacaoAtual.despesas || []).length);

for (const d of despesasValidas) {
  const dataLanc = (d.data || fim || ini || new Date().toISOString().slice(0,10)).slice(0,10);
  const despesaUid = d.id || uid();
  
  console.log('💰 Processando despesa:', { uid: despesaUid, info: d.info, valor: d.valor });
  
  try {
    // ✅ Usa upsert em vez de create para evitar duplicatas
    if (window.SupabaseAPI?.despesas?.upsert) {
      await window.SupabaseAPI.despesas.upsert({
        uid: despesaUid,
        gerente_nome: g?.nome || '',
        ficha: d.ficha || '',
        descricao: d.info || '',
        valor: Number(d.valor) || 0,
        data: dataLanc,
        periodo_ini: ini,
        periodo_fim: fim,
        oculta: false,
        rota: '',
        categoria: '',
        editada: false
      });
      console.log('✅ Despesa salva via upsert:', despesaUid);
    } else {
      // Fallback para create se upsert não existir
      await window.SupabaseAPI.despesas.create({
        uid: despesaUid,
        gerente_nome: g?.nome || '',
        ficha: d.ficha || '',
        descricao: d.info || '',
        valor: Number(d.valor) || 0,
        data: dataLanc,
        periodo_ini: ini,
        periodo_fim: fim,
        oculta: false,
        rota: '',
        categoria: '',
        editada: false
      });
      console.log('✅ Despesa salva via create:', despesaUid);
    }
  } catch(e) {
    console.error('❌ Erro ao salvar despesa:', despesaUid, e);
  }
}

console.log('✅ Todas as despesas processadas');
  
  window.__prestBeingEdited = null;
  pcResetForm();
  
  try { renderRelatorios(); } catch(e){};
  
  // ✅ NOTIFICA SINCRONIZAÇÃO
  if (typeof window.SyncManager !== 'undefined') {
    window.SyncManager.notify('prestacoes', { id: recPrest.id });
    window.SyncManager.notify('financeiro', { pendenciaPagamento: true });
  }


// ====== FUNÇÃO: aplicar/estornar parcelas de VALE ao SALVAR ======
async function __applyValesOnSave(prevRec, recPrest){
  try{
    const EPS = 0.005;
    const prevMap = new Map((prevRec?.valeParcAplicado || []).map(x => [x.id, Number(x.aplicado)||0]));
    const curMap  = new Map((prestacaoAtual?.valeParcAplicado || []).map(x => [x.id, Number(x.aplicado)||0]));
    const eventos = [];
    const valesParaAtualizar = [];

    (window.vales || []).forEach(v => {
      const prev  = prevMap.get(v.id) || 0;
      const cur   = curMap.get(v.id)  || 0;
      const delta = +(cur - prev);
      if (Math.abs(delta) < 1e-6) return;

      const saldoAntes = Number(v.valor)||0;
      let saldoDepois  = +(saldoAntes - delta);
      if (saldoDepois < EPS) saldoDepois = 0;

      v.valor = Number(saldoDepois.toFixed(2));
      v.saldo = v.valor;

      if (v.valor === 0) {
        v.quitado   = true;
        v.quitadoEm = new Date().toISOString();
      } else {
        v.quitado = false;
        delete v.quitadoEm;
      }

      // Marca para atualizar no Supabase
      valesParaAtualizar.push({ id: v.id, saldo: v.valor, quitado: v.quitado });

      eventos.push({
        id: (typeof uid==='function'? uid(): 'vl_'+Math.random().toString(36).slice(2,9)),
        valeId: v.id, cod: v.cod||'', gerenteId: v.gerenteId,
        delta: Number(delta),
        saldoAntes, saldoDepois: v.valor,
        prestacaoId: recPrest.id,
        periodoIni: recPrest.ini, periodoFim: recPrest.fim,
        createdAt: new Date().toISOString()
      });
    });

    if (eventos.length){
      // Atualiza no Supabase
      if (window.SupabaseAPI?.vales) {
        for (const upd of valesParaAtualizar) {
          await window.SupabaseAPI.vales.update(upd.id, { saldo: upd.saldo, quitado: upd.quitado });
        }
      }
      // Log
      window.valesLog?.bulkAdd?.(eventos);
    }
    try { renderValesPrestacao?.(); } catch {}
    try { window.dispatchEvent(new Event('vales:updated')); } catch {}

  } catch(e){
    console.warn('__applyValesOnSave error:', e);
  }
}

});
})();

/* ========== VALES LOG - SUPABASE ========== */
(function VALES_LOG_SUPABASE(){
  const EMP = () => localStorage.getItem('empresa_ativa') || window.getCompany?.() || 'BSX';

  const ValesLogAPI = {
    async add(ev) {
      if (!window.SupabaseAPI?.client) return false;
      const emp = EMP();
      try {
        const { error } = await window.SupabaseAPI.client
          .from('vales_log')
          .insert({
            uid: ev.id || 'vl_' + Math.random().toString(36).slice(2, 9),
            vale_id: ev.valeId,
            cod: ev.cod || '',
            gerente_id: ev.gerenteId,
            delta: Number(ev.delta) || 0,
            saldo_antes: Number(ev.saldoAntes) || 0,
            saldo_depois: Number(ev.saldoDepois) || 0,
            prestacao_id: ev.prestacaoId || null,
            periodo_ini: ev.periodoIni || null,
            periodo_fim: ev.periodoFim || null,
            company: emp
          });
        
        if (error) throw error;
        return true;
      } catch (e) {
        console.error('[ValesLog] Erro add:', e);
        return false;
      }
    },

    async bulkAdd(evs) {
      if (!Array.isArray(evs) || !evs.length) return;
      for (const ev of evs) {
        await this.add(ev);
      }
    },

    async list(filter = {}) {
      if (!window.SupabaseAPI?.client) return [];
      const emp = EMP();
      try {
        let query = window.SupabaseAPI.client
          .from('vales_log')
          .select('*')
          .eq('company', emp)
          .order('created_at', { ascending: false });
        
        if (filter.valeId) query = query.eq('vale_id', filter.valeId);
        if (filter.gerenteId) query = query.eq('gerente_id', filter.gerenteId);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(l => ({
          id: l.uid,
          valeId: l.vale_id,
          cod: l.cod,
          gerenteId: l.gerente_id,
          delta: Number(l.delta),
          saldoAntes: Number(l.saldo_antes),
          saldoDepois: Number(l.saldo_depois),
          prestacaoId: l.prestacao_id,
          periodoIni: l.periodo_ini,
          periodoFim: l.periodo_fim,
          createdAt: l.created_at
        }));
      } catch (e) {
        console.error('[ValesLog] Erro list:', e);
        return [];
      }
    },

    async removeByValeId(valeId) {
      if (!window.SupabaseAPI?.client) return false;
      try {
        await window.SupabaseAPI.client
          .from('vales_log')
          .delete()
          .eq('vale_id', valeId);
        return true;
      } catch (e) {
        console.error('[ValesLog] Erro remove:', e);
        return false;
      }
    },

    async migrate() {
      const emp = EMP();
      const KEY = `${emp}__bsx_vales_log_v1`;
      const KEY_LEG = 'bsx_vales_log_v1';
      
      let local = [];
      try { local = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      if (!local.length) {
        try { local = JSON.parse(localStorage.getItem(KEY_LEG) || '[]'); } catch {}
      }
      
      if (!local.length) {
        console.log('[ValesLog] Nada para migrar');
        return { migrated: 0 };
      }

      console.log(`[ValesLog] 🔄 Migrando ${local.length} logs...`);
      
      let migrated = 0;
      for (const ev of local) {
        const ok = await this.add(ev);
        if (ok) migrated++;
      }

      console.log(`[ValesLog] ✅ Migrados: ${migrated}`);
      return { migrated };
    }
  };

  // Registra API global
  window.SupabaseAPI = window.SupabaseAPI || {};
  window.SupabaseAPI.valesLog = ValesLogAPI;

  // Interface compatível com código existente
  window.valesLog = {
    add(ev) {
      ValesLogAPI.add(ev);
    },
    bulkAdd(evs) {
      ValesLogAPI.bulkAdd(evs);
    },
    list(filter) {
      // Para compatibilidade síncrona, retorna array vazio
      // Use listAsync para buscar do Supabase
      console.warn('[ValesLog] list() é síncrono - use listAsync() para Supabase');
      return [];
    },
    async listAsync(filter) {
      return await ValesLogAPI.list(filter);
    },
    removeByValeId(valeId) {
      ValesLogAPI.removeByValeId(valeId);
    }
  };

  console.log('[ValesLog] ✅ API Supabase inicializada');
})();

/* ===== EXCLUIR UM VALE (com histórico) ===== */
window.deleteValeById = async function(id){
  const v = (window.vales||[]).find(x => x.id === id);
  if (!v){ alert('Vale não encontrado.'); return; }

  const msg = `Excluir definitivamente o vale ${v.cod || ''}? 
Isso também APAGA TODO o histórico desse vale.`;
  if (!confirm(msg)) return;

  // 1) Remove do Supabase
  if (window.SupabaseAPI?.vales) {
    await window.SupabaseAPI.vales.delete(id);
  }

  // 2) Remove da memória
  window.vales = (window.vales||[]).filter(x => x.id !== id);

  // 3) Remove pagamentos VALE desta prestação que referenciem o código apagado
  try {
    const cod = String(v.cod || '').trim();
    prestacaoAtual.pagamentos = (prestacaoAtual.pagamentos||[])
      .filter(p => !(String(p.forma||'').toUpperCase()==='VALE' && String(p.obs||'').trim()===cod));
  } catch {}

  // 4) Recalcula e atualiza a UI
  try { __recalcValeParcFromPagamentos?.(); } catch {}
  try { renderValesPrestacao?.(); } catch {}
  try { pgRender?.(); } catch {}
  pcSchedule();
};


// Monta um objeto de prestação a partir do formulário atual
async function getPrestacaoFromForm(){
  await pcCalcular(); // ✅ AGUARDA recálculo antes de montar o objeto
  __recalcValeParcFromPagamentos();
  return {
    id: uid(),
    gerenteId: document.getElementById('pcGerente')?.value || '',
    ini: document.getElementById('pcIni')?.value || '',
    fim: document.getElementById('pcFim')?.value || '',
    despesas:  (prestacaoAtual.despesas  || []).map(d => ({...d})),
    pagamentos:(prestacaoAtual.pagamentos|| []).map(p => ({...p})),
    coletas:   (prestacaoAtual.coletas   || []).map(c => ({...c})),
    vales:     (prestacaoAtual.vales     || []).map(v => ({...v})),
    resumo:    {...(prestacaoAtual.resumo || {})},
    valeParcAplicado: (prestacaoAtual.valeParcAplicado || []).map(x => ({...x}))
  };
}

window.prestToDataURL = function(rec) {
  if (!rec || !rec.id) {
    console.error('[prestToDataURL] Registro inválido');
    return null;
  }
  
  try {
    console.log('[prestToDataURL] Gerando PNG para prestação:', rec.id);
    
    // Canvas base (offscreen)
    const cvs = document.createElement('canvas');
    cvs.width = 1200;
    cvs.height = 900;
    const ctx = cvs.getContext('2d');
    
    if (!ctx) {
      console.error('[prestToDataURL] Erro ao criar contexto 2D');
      return null;
    }

    // ===== Helpers de fonte/tamanhos para a COLUNA DIREITA =====
    const R_GROUP = 20;   // título dos grupos (COLETAS / ACRÉSCIMOS / RESULTADO)
    const R_LINE  = 16;   // linhas normais
    const R_SUB   = 15;   // linhas secundárias (itens de lista)
    const R_BOLD  = 17;   // totais/intermediários
    const R_REST  = 24;   // "RESTAM"
    const groupPad = 8;

    // ===== Fundo / Topo =====
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(0, 0, cvs.width, 80);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 22px Arial';

    // Cabeçalho
    const g = (window.gerentes || []).find(x => x.uid === rec.gerenteId);
    const periodo = (window.fmtData ? window.fmtData(rec.ini) : rec.ini) + ' a ' + 
                    (window.fmtData ? window.fmtData(rec.fim) : rec.fim);
    
    if (typeof drawText === 'function') {
      drawText(ctx, 'Gerente', 20, 50, 'left');
      drawText(ctx, (g ? (g.nome || '') : ''), 120, 50, 'left');
      drawText(ctx, 'Período:', cvs.width/2, 25, 'center');
      drawText(ctx, periodo, cvs.width/2, 55, 'center');
    }

    // Layout: esquerda (despesas) / direita (resumo)
    const gap = 20;
    const leftX = 20, leftY = 100, leftW = Math.floor(cvs.width * 0.58), leftH = cvs.height - leftY - 40;
    const rightX = leftX + leftW + gap, rightY = 100, rightW = cvs.width - rightX - 20, rightH = cvs.height - rightY - 40;

    // ======= TABELA DE DESPESAS (lado esquerdo) — limite 27 linhas =======
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, leftY, leftW, leftH);

    // Cabeçalho da tabela
    const headerH = 30;
    const col1W = Math.floor(leftW * 0.18); // FICHA
    const col3W = Math.floor(leftW * 0.20); // VALOR
    const col2W = leftW - col1W - col3W;    // INFORMAÇÕES

    ctx.fillStyle = '#111';
    ctx.fillRect(leftX, leftY, leftW, headerH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    
    // ✅ CENTRALIZANDO OS CABEÇALHOS
    ctx.textAlign = 'center';
    ctx.fillText('FICHA', leftX + col1W / 2, leftY + 20);
    ctx.fillText('INFORMAÇÕES', leftX + col1W + col2W / 2, leftY + 20);
    ctx.fillText('VALOR', leftX + col1W + col2W + col3W / 2, leftY + 20);

    // Divisórias verticais + linha do header
    ctx.beginPath();
    ctx.moveTo(leftX, leftY + headerH);
    ctx.lineTo(leftX + leftW, leftY + headerH);
    ctx.moveTo(leftX + col1W, leftY);
    ctx.lineTo(leftX + col1W, leftY + leftH);
    ctx.moveTo(leftX + col1W + col2W, leftY);
    ctx.lineTo(leftX + col1W + col2W, leftY + leftH);
    ctx.stroke();

    // Corpo da tabela
    const bodyH  = leftH - headerH - 28;                  // 28px para o rodapé "TOTAL DESPESAS"
    const itens  = (rec.despesas || []);
    const qtdLin = Math.max(itens.length, 1);

    let rowH, fz;
    if (qtdLin <= 27) {
      rowH = 32;
      fz   = 16;
    } else {
      rowH = Math.floor(bodyH / qtdLin);
      fz   = Math.max(10, Math.floor(rowH * 0.60)); // fonte mínima 10
    }

    let y = leftY + headerH;

    // Clipping do corpo
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftX, y, leftW, bodyH);
    ctx.clip();

    itens.forEach(d => {
      const ficha = String(d.ficha || '');
      const info  = String(d.info  || '');
      const valor = window.fmtBRL ? window.fmtBRL(Number(d.valor) || 0) : String(Number(d.valor)||0);

      // Ficha
      ctx.font = fz + 'px Arial';
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.fillText(ficha, leftX + 8, y + Math.round(rowH * 0.7));

      // Informações (crop com "…")
      const maxInfoW = col2W - 12;
      let txt = info;
      while (ctx.measureText(txt).width > maxInfoW && txt.length > 0) txt = txt.slice(0, -1);
      if (txt !== info) txt = txt.slice(0, -1) + '…';
      ctx.fillText(txt, leftX + col1W + 8, y + Math.round(rowH * 0.7));

      // Valor
      ctx.textAlign = 'right';
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(valor, leftX + col1W + col2W + col3W - 8, y + Math.round(rowH * 0.7));

      // Linha horizontal
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(leftX, y + rowH - 2);
      ctx.lineTo(leftX + leftW, y + rowH - 2);
      ctx.stroke();

      y += rowH;
    });

    ctx.restore();

    // Rodapé: TOTAL DESPESAS
    const totalDespesas = (rec.resumo && typeof rec.resumo.despesas === 'number')
      ? rec.resumo.despesas
      : itens.reduce((a,b)=> a + (Number(b.valor)||0), 0);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL DESPESAS:', leftX + Math.floor(leftW / 2), leftY + leftH - 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b91c1c';
    ctx.fillText(window.fmtBRL ? window.fmtBRL(totalDespesas) : String(totalDespesas), leftX + leftW - 10, leftY + leftH - 12);

    // ======= COLUNA DIREITA (Resumo) =======
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightX, rightY, rightW, rightH);

    // Clip interno
    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX + 1, rightY + 1, rightW - 2, rightH - 2);
    ctx.clip();

    const r = (rec && rec.resumo) ? rec.resumo : {
      coletas: 0, valorExtra: 0, adiant: 0, deveAnt: 0, credito: 0,
      despesas: 0, comissaoVal: 0, divida: 0, resultado: 0,
      aPagar: 0, pagos: 0, restam: 0, adiantPg: 0, comis1: 0, comis2: 0
    };

    let ry = rightY;

    // ---------- COLETAS ----------
    if (typeof drawGroup === 'function') {
      ry = drawGroup(ctx, rightX, ry, rightW, 'COLETAS', R_GROUP);
    }
    ry += 10;
    ctx.fillStyle = '#fff';
    ctx.fillRect(rightX + 1, ry - 5, rightW - 2, 2000);

    // Lista nominal de coletores
    const listaColetas2 = (rec.coletas || []);
    listaColetas2.forEach(function(c) {
      if (typeof drawKV2 === 'function') {
        ry = drawKV2(ctx, rightX + 26, ry, rightW - 52, c.nome || 'Coleta',
                     window.fmtBRL ? window.fmtBRL(Number(c.valor)||0) : String(Number(c.valor)||0), 
                     { size: R_SUB });
      }
    });

    // Valores do resumo
    const coletas2   = Number(r.coletas)   || 0;
    const despesas2  = Number(r.despesas)  || 0;
    const perc2      = Number(r.perc)      || 0;
    const deveAnt2   = Number(r.negAnterior || r.deveAnt || 0);
    const _resColetas2 = coletas2 - despesas2;
    const showNeg2 = perc2 > 0 && perc2 < 50;

    const c1 = Number(r.comis1) || 0;
    const c2 = Number(r.comis2) || 0;
    const temSegundaComissao = c2 > 0;

    // ========================================
    // SEQUÊNCIA PARA MODELO COM 2ª COMISSÃO
    // ========================================
    if (temSegundaComissao && typeof drawKV2 === 'function') {
      // 1. Coletas
      ry = drawKV2(ctx, rightX + 12, ry + 2, rightW - 24, 'Coletas', 
                   window.fmtBRL ? window.fmtBRL(coletas2) : String(coletas2), 
                   { bold:true, size:R_BOLD });
      
      // 2. Base Comissão
      const baseComissao2 = Number(r.baseComissao || coletas2);
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Base Comissão', 
                   window.fmtBRL ? window.fmtBRL(baseComissao2) : String(baseComissao2), 
                   { color:'#16a34a', valueColor:'#16a34a', size:R_LINE });
      
      // 3. Saldo a Carregar
      const saldoCarry2 = Number(r.saldoNegAcarreado || 0);
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Saldo a Carregar', 
                   window.fmtBRL ? window.fmtBRL(saldoCarry2) : String(saldoCarry2), 
                   { valueColor:'#b91c1c', size:R_LINE });
      
      // 4. Comissão 1
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
        'Comissão 1 (' + (Number(r.perc)||0) + '%)',
        window.fmtBRL ? window.fmtBRL(c1) : String(c1),
        { valueColor:'#16a34a', size: R_LINE }
      );
      
      // 5. Resultado (Coletas - Com. 1)
      const resIntermediario = coletas2 - c1;
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
        'Resultado (Coletas - Com. 1)',
        window.fmtBRL ? window.fmtBRL(resIntermediario) : String(resIntermediario),
        { size: R_LINE }
      );
      
      // 6. Comissão 2
      const rot = r?.flags?.sequencial ? 'Comissão 2 (seq.)' : 'Comissão 2';
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
        rot + ' (' + (Number(r.perc2)||0) + '%)',
        window.fmtBRL ? window.fmtBRL(c2) : String(c2),
        { valueColor:'#16a34a', size: R_LINE }
      );
      
      // 7. Despesas
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Despesas', 
                   window.fmtBRL ? window.fmtBRL(despesas2) : String(despesas2), 
                   { valueColor:'#b91c1c', size:R_LINE });
      
      // 8. Total (Coletas - Despesas - Comissões)
      const totalIntermediario = coletas2 - despesas2 - c1 - c2;
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 
        'Total (Coletas - Despesas - Comissões)', 
        window.fmtBRL ? window.fmtBRL(totalIntermediario) : String(totalIntermediario), 
        { bold:true, size:R_BOLD }
      );
      
      // 9. Resultado FINAL (sem deve anterior)
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Resultado', 
                   window.fmtBRL ? window.fmtBRL(totalIntermediario) : String(totalIntermediario),
                   { bold:true, size:R_BOLD });

    } 
    // ========================================
    // SEQUÊNCIA PARA MODELOS SEM 2ª COMISSÃO
    // ========================================
    else if (typeof drawKV2 === 'function') {
      // Modelo padrão ou por rota positiva
      
      ry = drawKV2(ctx, rightX + 12, ry + 2, rightW - 24, 'Coletas', 
                   window.fmtBRL ? window.fmtBRL(coletas2) : String(coletas2), 
                   { bold:true, size:R_BOLD });
      
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Despesas', 
                   window.fmtBRL ? window.fmtBRL(despesas2) : String(despesas2), 
                   { bold:true, valueColor:'#b91c1c', size:R_LINE });
      
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Total (Coletas - Despesas)', 
                   window.fmtBRL ? window.fmtBRL(_resColetas2) : String(_resColetas2), 
                   { bold:true, size:R_BOLD });

      // Se tem modo antigo (com carry de negativo)
      if (showNeg2) {
        const baseComissao2 = Number(r.baseComissao || r.comissaoBase || 0);
        const saldoCarry2   = Number(r.saldoNegAcarreado || 0);

        ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Base Comissão', 
                     window.fmtBRL ? window.fmtBRL(baseComissao2) : String(baseComissao2), 
                     { color:'#16a34a', valueColor:'#16a34a', size:R_LINE });
        ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Saldo a Carregar', 
                     window.fmtBRL ? window.fmtBRL(saldoCarry2) : String(saldoCarry2), 
                     { valueColor:'#b91c1c', size:R_LINE });
      }

      // Se tem comissão (mesmo sem ser 2ª)
      if (c1 > 0) {
        ry = drawKV2(ctx, rightX + 12, ry, rightW - 24,
          'Comissão 1 (' + (Number(r.perc)||0) + '%)',
          window.fmtBRL ? window.fmtBRL(c1) : String(c1),
          { valueColor:'#16a34a', size: R_LINE }
        );
      }

      // Resultado = (Coletas - Despesas) - Comissão (SEM deve anterior)
      const resultadoFinal = _resColetas2 - c1;
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Resultado', 
                   window.fmtBRL ? window.fmtBRL(resultadoFinal) : String(resultadoFinal),
                   { bold:true, size:R_BOLD });
    }

    // ---- ACRÉSCIMOS ---- (PARA TODOS OS MODELOS)
    ry += groupPad;
    if (typeof drawGroup === 'function') {
      ry = drawGroup(ctx, rightX, ry + 6, rightW, 'ACRÉSCIMOS', R_GROUP);
    }
    ry += groupPad;
    ctx.fillStyle = '#fff';
    ctx.fillRect(rightX + 1, ry - Math.ceil(groupPad / 2), rightW - 2, 2000);

    if (typeof drawKV2 === 'function') {
      // Lista os itens individuais
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Adiantamento', 
                   window.fmtBRL ? window.fmtBRL(r.adiant || 0) : String(r.adiant || 0), 
                   { size: R_LINE });

      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Deve Anterior', 
                   window.fmtBRL ? window.fmtBRL(deveAnt2) : String(deveAnt2),
                   { bold: true, size: R_LINE });

      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Valor Extra', 
                   window.fmtBRL ? window.fmtBRL(r.valorExtra || 0) : String(r.valorExtra || 0), 
                   { size: R_LINE });

      // VALES
      const iniPNG = rec.ini || '';
      const fimPNG = rec.fim || '';
      const gidPNG = rec.gerenteId || '';
      const parcelasVale = Array.isArray(rec.valeParcAplicado) ? rec.valeParcAplicado : [];
      const aplicadoPorId = new Map(parcelasVale.map(function(p) { 
        return [p.id, Number(p.aplicado)||0]; 
      }));

      const saldoDepoisPorVale = (function() {
        try {
          if (!gidPNG || !iniPNG || !fimPNG) return new Map();
          const todos = (window.valesLog?.list({gerenteId: gidPNG}) || [])
            .filter(function(ev) { return ev.periodoIni === iniPNG && ev.periodoFim === fimPNG; });
          const m = new Map();
          todos.forEach(function(ev) { m.set(ev.valeId, Number(ev.saldoDepois)||0); });
          return m;
        } catch(e) { return new Map(); }
      })();

      const itensVale = parcelasVale.length
        ? parcelasVale.map(function(p) { return { id:p.id, cod:p.cod, aplicado: aplicadoPorId.get(p.id)||0 }; })
        : (window.vales||[]).filter(function(v) { return v.gerenteId===gidPNG && !v.quitado; })
                           .map(function(v) { return { id:v.id, cod:v.cod, aplicado: aplicadoPorId.get(v.id)||0 }; });

      let totalVales = 0;
      itensVale.forEach(function(p) {
        const v = (window.vales||[]).find(function(x) { return x.id===p.id; });
        const codTxt = v?.cod || p.cod || '—';
        const aplicado = Number(p.aplicado)||0;
        totalVales += aplicado;

        const saldoLabel = saldoDepoisPorVale.has(p.id)
          ? saldoDepoisPorVale.get(p.id)
          : Math.max((Number(v?.valor)||0) - aplicado, 0);

        const rotulo = 'VALE ' + codTxt + ': ' + (window.fmtBRL ? window.fmtBRL(saldoLabel) : String(saldoLabel));
        ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, rotulo, 
                     window.fmtBRL ? window.fmtBRL(Math.abs(aplicado)) : String(Math.abs(aplicado)),
                     { valueColor:'#b91c1c', size: R_LINE });
      });

      // ✅ TOTAL ACRÉSCIMOS (Deve Anterior + Adiantamento + Valor Extra + Vales)
      const totalAcrescimos = (Number(r.adiant)||0) + deveAnt2 + (Number(r.valorExtra)||0) + totalVales;

      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Total Acréscimos', 
                   window.fmtBRL ? window.fmtBRL(totalAcrescimos) : String(totalAcrescimos),
                   { bold:true, valueColor:'#b91c1c', size: R_BOLD });
    }

    // listas de pagamentos 
    const _pagts = Array.isArray(rec.pagamentos) ? rec.pagamentos : [];
    const adiantamentos = _pagts
      .filter(function(p) { return String(p.forma||'').toUpperCase() === 'ADIANTAMENTO'; })
      .sort(function(a,b) { return (a.data||'').localeCompare(b.data||''); });
    const pagamentosNormais = _pagts
      .filter(function(p) {
        const f = String(p.forma||'').toUpperCase();
        return f !== 'ADIANTAMENTO' && f !== 'VALE';
      })
      .sort(function(a,b) { return (a.data||'').localeCompare(b.data||''); });

    // ---- RESULTADO ----
    ry += groupPad;
    if (typeof drawGroup === 'function') {
      ry = drawGroup(ctx, rightX, ry + 6, rightW, 'RESULTADO', R_GROUP);
    }
    
    // ✅ CRÉDITO MAIS PRÓXIMO DA LINHA (reduzindo espaço)
    ry += 2; // Espaço mínimo após o título

    if (typeof drawKV2 === 'function') {
      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'Crédito', 
                   window.fmtBRL ? window.fmtBRL(r.credito || 0) : String(r.credito || 0),
                   { bold:true, color:'#16a34a', valueColor:'#16a34a', size: R_LINE });

      // À Pagar = Resultado das Coletas + Total Acréscimos - Crédito
      let resultadoColetas = 0;
      if (temSegundaComissao) {
        resultadoColetas = coletas2 - despesas2 - c1 - c2;
      } else {
        resultadoColetas = (coletas2 - despesas2) - c1;  // ✅ CORREÇÃO: cálculo direto
      }

      const aPagarCalc = Number(r.aPagar) || 0;

      ry = drawKV2(ctx, rightX + 12, ry, rightW - 24, 'À Pagar', 
                   window.fmtBRL ? window.fmtBRL(aPagarCalc) : String(aPagarCalc),
                   { bold:true, size: R_BOLD });

      // ADIANTAMENTOS / PAGAMENTOS
      adiantamentos.forEach(function(p) {
        const rot = (window.fmtData ? window.fmtData(p.data||'') : p.data||'') + ' — ADIANTAMENTO';
        ry = drawKV2(ctx, rightX+26, ry, rightW-52, rot, 
                     window.fmtBRL ? window.fmtBRL(Number(p.valor)||0) : String(Number(p.valor)||0),
                     { color:'#16a34a', valueColor:'#16a34a', size: R_SUB });
      });

      pagamentosNormais.forEach(function(p) {
        const forma = (p.forma || '').toString().toUpperCase() || 'PAGTO';
        const rot = (window.fmtData ? window.fmtData(p.data||'') : p.data||'') + ' — ' + forma;
        ry = drawKV2(ctx, rightX+12, ry, rightW-24, rot, 
                     window.fmtBRL ? window.fmtBRL(Number(p.valor)||0) : String(Number(p.valor)||0),
                     { color:'#16a34a', valueColor:'#16a34a', size: R_SUB });
      });
    }

    // ✅ RESTAM NO FINAL (dentro do quadrado RESULTADO)
    // Adiciona espaço antes do RESTAM para separá-lo do conteúdo acima
    ry += 20;

    const restamValor = Number(r.restam) || 0;
    const restamCor = restamValor < 0 ? '#b91c1c' : '#111';
    const restamTexto = restamValor < 0 ? '(EMPRESA DEVE AO GERENTE)' : '';

    ctx.font = 'bold ' + R_REST + 'px Arial';
    ctx.fillStyle = restamCor;
    ctx.textAlign = 'left';  
    ctx.fillText('RESTAM:', rightX+12, ry+24);
    ctx.textAlign = 'right'; 
    ctx.fillText(window.fmtBRL ? window.fmtBRL(restamValor) : String(restamValor), rightX+rightW-12, ry+24);

    // Adiciona aviso se negativo
    if (restamTexto) {
      ry += 24;
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#b91c1c';
      ctx.textAlign = 'center';
      ctx.fillText(restamTexto, rightX + rightW/2, ry + 16);
    }

    ctx.restore();

    // Converte para PNG
    const dataURL = cvs.toDataURL('image/png', 1.0);
    
    if (!dataURL || dataURL === 'data:,') {
      console.error('[prestToDataURL] Falha ao gerar imagem');
      return null;
    }
    
    console.log('[prestToDataURL] ✅ PNG gerado com sucesso');
    return dataURL;
    
  } catch(e) {
    console.error('[prestToDataURL] Erro geral:', e);
    return null;
  }
};

// Visualizar imagem de uma prestação salva (usado na aba Relatórios)
function viewPrestImage(id){
  const arr = JSON.parse(localStorage.getItem(DB_PREST) || '[]');
  const r = arr.find(x => x.id === id);
  if(!r){ alert("Prestação não encontrada."); return; }

  const dataURL = prestToDataURL(r);
  const w = window.open('', 'img_prestacao');
  if(!w){ alert('Popup bloqueado.'); return; }

  w.document.write(`
    <html><head><meta charset="utf-8"><title>Prestação</title></head>
    <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;">
      <img src="${dataURL}" style="max-width:100vw;max-height:100vh"/>
    </body></html>
  `);
  w.document.close();
}

// Deixar acessível globalmente (para botões inline no HTML)
window.getPrestacaoFromForm = getPrestacaoFromForm;
window.viewPrestImage = viewPrestImage;

// Excluir prestação salva (e reverter efeitos nos vales)
async function deletePrest(id){
  const arr = JSON.parse(localStorage.getItem(DB_PREST) || '[]');
  const r   = arr.find(x => x.id === id);
  if(!r){ alert('Prestação não encontrada.'); return; }
  if(!confirm('Excluir esta prestação de contas? Isso também estorna os VALES aplicados nela.')) return;

  // 1) Estornar efeitos nos vales com base no log dessa prestação
  try {
    const logs = (window.valesLog?.list({}) || []).filter(e => e.prestacaoId === id);
    if (logs.length){
      const reversos = [];
      logs.forEach(ev=>{
        const v = (window.vales||[]).find(x => x.id === ev.valeId);
        if (!v) return;
        const saldoAntes = Number(v.valor)||0;
        v.valor   = Number((saldoAntes + Number(ev.delta||0)).toFixed(2));
        if (v.valor > 0) v.quitado = false;

        reversos.push({
          id: (typeof uid==='function'? uid(): 'rv_'+Math.random().toString(36).slice(2,9)),
          valeId: v.id, cod: v.cod||'', gerenteId: v.gerenteId,
          delta: -(Number(ev.delta)||0),        // delta inverso
          saldoAntes, saldoDepois: v.valor,
          prestacaoId: id,                      // referencia de quem gerou o estorno
          periodoIni: r.ini, periodoFim: r.fim,
          createdAt: new Date().toISOString()
        });
      });
      if (reversos.length){
        try { window.valesLog?.bulkAdd(reversos); } catch {}
        try { saveVales?.(); } catch {}
        try { renderValesPrestacao?.(); } catch {}
        try { window.dispatchEvent(new Event('vales:updated')); } catch {}
      }
    }
  } catch(e){ console.warn('Estorno de vales ao excluir prestação:', e); }

// 2) Remove a prestação
const novo = arr.filter(x => x.id !== id);

// ✅ Deleta do Supabase + localStorage
if (typeof window.deletarPrestacaoGlobal === 'function') {
  try {
    await window.deletarPrestacaoGlobal(id);
    console.log('✅ Prestação deletada do Supabase:', id);
  } catch(e) {
    console.error('❌ Erro ao deletar do Supabase:', e);
    // Fallback: deleta apenas do localStorage
    localStorage.setItem(DB_PREST, JSON.stringify(novo));
  }
} else {
  // Fallback se Supabase não estiver carregado
  localStorage.setItem(DB_PREST, JSON.stringify(novo));
}

try { window.__syncAbertasMirror(); } catch {}

   // ✅ NOTIFICA SINCRONIZAÇÃO
   if (typeof window.SyncManager !== 'undefined') {
    window.SyncManager.notify('prestacoes', { deleted: id });
  }


  // 3) Remove despesas vinculadas a essa prestação
  try {
    despesas = (despesas || []).filter(d => d.prestacaoId !== id);
    saveDesp();
  } catch(e){ console.warn('Não foi possível atualizar despesas:', e); }

  // 4) Atualiza UI
  try { renderRelatorios(); } catch(e){}
  alert('Prestação excluída e vales estornados.');
}
window.deletePrest = deletePrest;

document.addEventListener('DOMContentLoaded', ()=>{ try{ __syncAbertasMirror(); }catch{} });
window.addEventListener('prestacoes:changed', ()=>{ try{ __syncAbertasMirror(); }catch{} });
window.addEventListener('storage', (e)=>{
  const k = e?.key || '';
  if (k.endsWith('bsx_prestacoes_v1') || k.includes('bsx_prestacoes_v1__')) {
    try{ __syncAbertasMirror(); }catch{}
  }
});



// --- Botão: GERAR PNG (baixa o arquivo)
document.getElementById('btnPcPng')?.addEventListener('click', async ()=>{  // ✅ async
  try{
    const rec = await getPrestacaoFromForm();  // ✅ AGUARDA
    const dataURL = prestToDataURL(rec);          // gera o PNG offscreen

    if(!dataURL || !dataURL.startsWith('data:image/png')) {
      alert('Falha ao gerar a imagem.');
      return;
    }

    const g = (window.gerentes || []).find(x => String(x.uid||x.id) === String(rec.gerenteId));
    const nomeGer = (g?.nome || 'Sem Gerente').trim();
    const nomeGerSafe = nomeGer.normalize('NFD').replace(/[\u0300-\u036f]/g,'');

    const fmtDM = (iso)=>{
      if(!iso) return '';
      const [y,m,d] = iso.split('-');
      return `${d}-${m}`; // dia-mês
    };

    const nome = `${nomeGerSafe} ${fmtDM(rec.ini)} a ${fmtDM(rec.fim)}.png`;

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(err){
    console.error(err);
    alert('Erro ao gerar imagem (ver console).');
  }
});

function pcResetForm(){
  prestacaoAtual = { 
    despesas: [], 
    pagamentos: [], 
    coletas: [], 
    vales: [], 
    valeSelec: [], 
    resumo: {},
    valeParcAplicado: [],
    saldoInfo: null
  };

  const selGer = document.getElementById('pcGerente'); if (selGer) selGer.value = '';
  ['pcIni','pcFim'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['pcValorExtra','pcAdiant','pcDeveAnterior','pcDivida','pcCredito'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=0; });
  ['pcResultado','pcPerc','pcPagar','pcRestam'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });

   // (opcional) limpa campos rápidos de coleta (se existirem no DOM)
   const cNome = document.getElementById('colNome');  if (cNome)  cNome.value = '';
   const cVal  = document.getElementById('colValor'); if (cVal)   cVal.value  = '';
 
   // (opcional) esvazia tabelas imediatamente (pcRender também fará isso, mas aqui é imediato)
   document.getElementById('pcColetasBody')?.replaceChildren();
   document.getElementById('pgNBody')?.replaceChildren();
   document.getElementById('pgVBody')?.replaceChildren();
   document.getElementById('pcDespesasBody')?.replaceChildren();
   document.getElementById('pcValesBody')?.replaceChildren();
   const tot = (id) => { const el = document.getElementById(id); if (el) el.textContent = 'R$ 0,00'; };
   tot('pcColetasTotal'); tot('pgNTotal'); tot('pgVTotal'); tot('pcValesTotalDesc'); tot('pcTotalDespesas');

  // apenas 1 ciclo de render/cálculo
  pcRender();
  pcSchedule();
}
  // 2) Evita que Enter dispare submit/re-render
  document.getElementById('prestContas')?.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault();
  });


// Preenche Deve Anterior e Adiantamento se houver carry pendente
async function pcApplyCarryIfAny(){  // ✅ async
  const sel = document.getElementById('pcGerente');
  const ini = document.getElementById('pcIni')?.value || '';
  const fim = document.getElementById('pcFim')?.value || '';
  if (!sel || !sel.value || (!ini && !fim)) return;

  const gerenteId = sel.value;

  // normalizador de período (seg/dom)
  let seg = '', dom = '';
  if (typeof __normalizeSegDom === 'function') {
    const out = __normalizeSegDom(ini, fim) || {};
    seg = out.seg || ini;
    dom = out.dom || (fim || ini);
  } else {
    seg = ini;
    dom = fim || ini;
  }

  // helper local para número (suporta vírgula)
  const toNum = (x) => {
    if (typeof x === 'number') return x || 0;
    let s = String(x || '').trim();
    if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
    };

  // aplica no máximo 1x por (gerente, semana)
  window.__carryAppliedMap = window.__carryAppliedMap || new Set();
  const keyOnce = `${gerenteId}_${seg}_${dom}`;
  if (window.__carryAppliedMap.has(keyOnce)) return;

  const list = (typeof __getCarry === 'function') ? __getCarry() : [];

  // ⚠️ Sem filtro de empresa aqui (mantém seu comportamento atual)
  const matches = list.filter(c =>
    String(c.gerenteId) === gerenteId &&
    c.periodoIni === seg &&
    c.periodoFim === dom &&
    !c.consumedAt
  );

  const somaDeve = matches.reduce((s,c)=> s + toNum(c.deveAnterior), 0);
  const somaAdi  = matches.reduce((s,c)=> s + toNum(c.adiantamento), 0);

  const deveEl   = document.getElementById('pcDeveAnterior');
  const adiantEl = document.getElementById('pcAdiant');
  if (deveEl)   deveEl.value   = (toNum(deveEl.value)   + somaDeve).toString();
  if (adiantEl) adiantEl.value = (toNum(adiantEl.value) + somaAdi ).toString();

  if (typeof pcCalcular === 'function') await pcCalcular();  // ✅ AGUARDA
  window.__carryAppliedMap.add(keyOnce);
}


// Dispare quando mudar gerente / datas
document.getElementById('pcGerente')?.addEventListener('change', pcApplyCarryIfAny);
document.getElementById('pcIni')?.addEventListener('change', pcApplyCarryIfAny);
document.getElementById('pcFim')?.addEventListener('change', pcApplyCarryIfAny);

// ===== Modais: Adicionar Vale (banco geral) e Adicionar Pagamento =====
(function setupPrestModals(){
  // 0) Esconde os campos inline (UI antiga), mas mantém as tabelas
  ['pgNData','pgNValor','pgNForma','pgNObs'].forEach(id=>{
    const el = document.getElementById(id);
    if (el){ el.style.display='none'; el.parentElement?.style && (el.parentElement.style.display='none'); }
  });
  const formVale = document.getElementById('formVale');
  if (formVale){
    // mantém o form oculto (fluxo antigo), mas NÃO cria botão algum
    formVale.style.display = 'none';
  }
  
  try { window.dispatchEvent(new Event('bsx:prest-salva')); } catch {}


  // 1) CSS mínimo para os dialogs
  const css = document.createElement('style');
  css.textContent = `
    dialog.pc { border:none; border-radius:16px; padding:0; max-width:520px; width:92vw; }
    dialog::backdrop { background: rgba(0,0,0,.35); }
    .pc-head{background:#111;color:#fff;padding:12px 20px;font-weight:700}
    .pc-box{padding:18px 20px}
    .pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .pc-grid label{display:flex;flex-direction:column;gap:6px;font-size:12px}
    .pc-actions{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #eee}
    .col-2{grid-column:1 / -1}
  `;
  document.head.appendChild(css);

  // 2) Dialog: Vale (banco geral)
  const dlgVale = document.createElement('dialog');
  dlgVale.id = 'dlgVale';
  dlgVale.className = 'pc';
  dlgVale.innerHTML = `
    <div class="pc-head">Adicionar vale (banco geral)</div>
    <form class="pc-box" id="dlgValeForm" method="dialog">
      <div class="pc-grid">
        <label>Código/Ref.<input id="dlgVcod" placeholder="ex.: 5125 / vendedor" required></label>
        <label>Valor (R$)<input id="dlgVvalor" type="number" step="0.01" min="0" required></label>
        <label class="col-2">Obs <input id="dlgVobs" placeholder="mensal/semana, acordo etc."></label>
        <label>Período <input id="dlgVperiodo" placeholder="aaaa-mm"></label>
      </div>
      <div class="pc-actions">
        <button value="cancel" type="reset" class="btn ghost">Cancelar</button>
        <button id="dlgValeSalvar" class="btn">Salvar</button>
      </div>
    </form>`;
  document.body.appendChild(dlgVale);

  // 3) Dialog: Pagamento (NORMAL/ADIANTAMENTO/PIX/DINHEIRO/CARTÃO)
  const dlgPg = document.createElement('dialog');
  dlgPg.id = 'dlgPg';
  dlgPg.className = 'pc';
  dlgPg.innerHTML = `
    <div class="pc-head">Adicionar pagamento</div>
    <form class="pc-box" id="dlgPgForm" method="dialog">
      <div class="pc-grid">
        <label>Data<input id="dlgPgData" type="date"></label>
        <label>Valor (R$)<input id="dlgPgValor" type="number" step="0.01" min="0" required></label>
        <label>Forma
          <select id="dlgPgForma">
            <option>PIX</option>
            <option>DINHEIRO</option>
            <option>CARTÃO</option>
            <option>ADIANTAMENTO</option>
          </select>
        </label>
        <label class="col-2">Obs <input id="dlgPgObs" placeholder="opcional"></label>
      </div>
      <div class="pc-actions">
        <button value="cancel" type="reset" class="btn ghost">Cancelar</button>
        <button id="dlgPgSalvar" class="btn">Salvar</button>
      </div>
    </form>`;
  document.body.appendChild(dlgPg);

// 4) Abrir os dialogs
document.getElementById('btnAbrirVale')?.addEventListener('click', ()=> dlgVale.showModal());

// Reaproveita o botão existente “Adicionar pagamento”:
// remove TODOS os listeners antigos clonando o botão e colocando só o do diálogo
{
  const oldBtn = document.getElementById('btnPgNAdd');
  if (oldBtn) {
    const clone = oldBtn.cloneNode(true); // sem listeners antigos
    oldBtn.parentNode.replaceChild(clone, oldBtn);
    clone.addEventListener('click', (e)=>{ e.preventDefault(); dlgPg.showModal(); }, {capture:true});
  }
}


  // 5) Salvar PAGAMENTO — reaproveita pgNAddFromForm()
  dlgPg.querySelector('#dlgPgSalvar').addEventListener('click', (e)=>{
    e.preventDefault();
    const d = dlgPg.querySelector('#dlgPgData')?.value || '';
    const v = dlgPg.querySelector('#dlgPgValor')?.value || '';
    const f = dlgPg.querySelector('#dlgPgForma')?.value || 'PIX';
    const o = dlgPg.querySelector('#dlgPgObs')?.value || '';

    // Preenche os inputs originais (escondidos) e reutiliza a função nativa
    if (document.getElementById('pgNData'))  document.getElementById('pgNData').value  = d;
    if (document.getElementById('pgNValor')) document.getElementById('pgNValor').value = v;
    if (document.getElementById('pgNForma')) document.getElementById('pgNForma').value = f;
    if (document.getElementById('pgNObs'))   document.getElementById('pgNObs').value   = o;

    if (typeof pgNAddFromForm === 'function') pgNAddFromForm(); // já calcula e atualiza
    dlgPg.close();
  });

  // 6) Fechar ao clicar fora do conteúdo
  [dlgVale, dlgPg].forEach(dlg=>{
    dlg.addEventListener('click', (e)=>{ if (e.target === dlg) dlg.close(); });
  });
})();

/* ===== Botão e modal: VER TODOS OS VALES (com Histórico) ===== */
(function TodosValesUI(){
  // CSS mínimo
  const css = document.createElement('style');
  css.textContent = `
    dialog.tv { border:none; border-radius:16px; padding:0; max-width:980px; width:96vw; }
    dialog::backdrop { background: rgba(0,0,0,.35); }
    .tv-head{background:#111;color:#fff;padding:12px 20px;font-weight:700}
    .tv-box{padding:18px 20px}
    .tv-table{width:100%; border-collapse:collapse; font-size:14px}
    .tv-table th,.tv-table td{border-bottom:1px solid #eee; padding:8px; text-align:left}
    .tv-right{text-align:right}
    .tv-mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace}
    .tv-red{color:#b91c1c}
    .tv-green{color:#16a34a}
    .tv-actions{display:flex; gap:8px; justify-content:flex-end; padding:12px 20px; border-top:1px solid #eee}
    .btn{padding:.5rem .8rem; border-radius:.5rem; background:#111; color:#fff; border:none; cursor:pointer}
    .btn.ghost{background:#f3f4f6; color:#111}
    .btn.danger{background:#b91c1c; color:#fff} 
  `;
  document.head.appendChild(css);

  // Cria o botão ao lado do "Adicionar vale", se existir
  let anchor = document.getElementById('btnAbrirVale')
           || document.getElementById('btnPgNAdd')
           || document.querySelector('#prestContas') || document.body;

  const btn = document.createElement('button');
  btn.id = 'btnVerTodosVales';
  btn.className = 'btn';
  btn.type = 'button';
  btn.style.marginLeft = '8px';
  btn.textContent = 'Ver todos os vales';
  if (anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  else document.body.appendChild(btn);

  // Modal
  const dlg = document.createElement('dialog');
  dlg.id = 'dlgValesTodos';
  dlg.className = 'tv';
  dlg.innerHTML = `
    <div class="tv-head">Todos os vales — empresa atual</div>
    <div class="tv-box">
      <div style="max-height:38vh;overflow:auto;border:1px solid #eee;border-radius:12px;margin-bottom:12px">
        <table class="tv-table">
          <thead>
            <tr>
              <th>Gerente</th>
              <th>Código</th>
              <th class="tv-right">Saldo (R$)</th>
              <th>Obs</th>
              <th>Período</th>
              <th>Status</th>
              <th class="tv-right">Ações</th>
            </tr>
          </thead>
          <tbody id="tvBody"><tr><td colspan="7">—</td></tr></tbody>
        </table>
      </div>

      <h3 style="margin:16px 0 8px 0">Histórico de pagamentos de VALE</h3>
      <div style="max-height:34vh;overflow:auto;border:1px solid #eee;border-radius:12px">
        <table class="tv-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Gerente</th>
              <th>Código</th>
              <th class="tv-right">Δ (R$)</th>
              <th class="tv-right">Saldo (antes → depois)</th>
              <th>Período / Prestação</th>
            </tr>
          </thead>
          <tbody id="tvLogBody"><tr><td colspan="6">—</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="tv-actions">
      <button class="btn ghost" id="tvFechar">Fechar</button>
    </div>`;
  document.body.appendChild(dlg);

  const esc = window.esc || (s => String(s ?? ''));
  const gname = (id) => ( (window.gerentes||[]).find(x=>String(x.uid)===String(id))?.nome || '—' );

  function renderVales(){
    const tb = dlg.querySelector('#tvBody'); if (!tb) return;
    const arr = __valesReload();
  
    const rows = arr.slice().sort((a,b)=>{
      const ga = gname(a.gerenteId).localeCompare(gname(b.gerenteId));
      if (ga!==0) return ga;
      return String(a.cod||'').localeCompare(String(b.cod||''));
    }).map(v=>{
      const per = v.periodo ? esc(v.periodo) : '';
      const st  = v.quitado ? 'Quitado' : 'Em aberto';
      return `<tr>
        <td>${esc(gname(v.gerenteId))}</td>
        <td class="tv-mono">${esc(v.cod||'')}</td>
        <td class="tv-right tv-mono ${v.quitado?'':'tv-red'}">${fmtBRL(Number(v.valor)||0)}</td>
        <td>${esc(v.obs||'')}</td>
        <td>${per}</td>
        <td>${st}</td>
        <td class="tv-right">
          <button class="btn danger" data-tv-del="${v.id}">Excluir</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7">Nenhum vale cadastrado nesta empresa.</td></tr>';
  
    tb.innerHTML = rows;
    wireTvActions(); // conecta os cliques após renderizar
  }
  
function wireTvActions(){
  dlg.querySelectorAll('[data-tv-del]').forEach(btn=>{
    if (btn.__wired) return;
    btn.__wired = true;
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-tv-del');
      // usa o fluxo oficial (com confirmação, remoção de histórico etc.)
      if (typeof window.deleteValeById === 'function'){
        window.deleteValeById(id);
        // atualiza as visões imediatamente neste mesmo modal
        renderVales();
        renderHist();
        try { renderValesPrestacao?.(); } catch {}
      }
    });
  });
  }

  function renderHist(){
    const tb = dlg.querySelector('#tvLogBody'); if (!tb) return;
    const logs = (window.valesLog?.list({}) || [])
      .sort((a,b)=> String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

    tb.innerHTML = logs.map(ev=>{
      const delta = Number(ev.delta)||0;
      const per   = (ev.periodoIni && ev.periodoFim) ? `${fmtData(ev.periodoIni)} a ${fmtData(ev.periodoFim)}` : '';
      const dstr  = `${fmtData(ev.createdAt)} ${fmtHora?.(ev.createdAt) || ''}`;
      return `<tr>
        <td class="tv-mono">${dstr}</td>
        <td>${esc(gname(ev.gerenteId))}</td>
        <td class="tv-mono">${esc(ev.cod||'')}</td>
        <td class="tv-right tv-mono ${delta>=0?'tv-red':'tv-green'}">${delta>=0?'-':'+'}${fmtBRL(Math.abs(delta))}</td>
        <td class="tv-right tv-mono">${fmtBRL(Number(ev.saldoAntes)||0)} → ${fmtBRL(Number(ev.saldoDepois)||0)}</td>
        <td>${esc(per)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Ainda não há pagamentos registrados.</td></tr>';
  }

  // Abrir/fechar
  btn.addEventListener('click', ()=>{ dlg.showModal(); renderVales(); renderHist(); });
  dlg.querySelector('#tvFechar').addEventListener('click', ()=> dlg.close());
  dlg.addEventListener('click', (e)=>{ if (e.target===dlg) dlg.close(); });

  // Atualizar conteúdo quando algo mudar
  window.addEventListener('storage', (e)=>{
    const k = e?.key || '';
    if ((k.includes('bsx_vales_v1') || k.includes('bsx_vales_log_v1')) && dlg.open){
      renderVales(); renderHist();
    }
  });
  // mesmo tab: re-render quando vales mudarem
window.addEventListener('vales:updated', ()=>{
  if (dlg.open) { renderVales(); renderHist(); }
});

  document.addEventListener('empresa:change', ()=>{ if (dlg.open){ renderVales(); renderHist(); }});
})();


// Reforço: garante que o botão Salvar do modal grava e não fecha por submit automático
/* === MODAL "Adicionar vale" — versão estável (SUBSTITUIR o hardenDlgVale) === */
(function ValeModalStable(){
  const dlg      = document.getElementById('dlgVale');
  const form     = document.getElementById('dlgValeForm');
  const btnSave  = document.getElementById('dlgValeSalvar');
  const btnCancel= dlg?.querySelector('.btn.ghost');

  if (!dlg || !form || !btnSave) return;

  // Evita submit/fechamento automático do <form method="dialog">
  btnSave.type = 'button';

  // Garante que só conecte uma vez
  if (btnSave.__wired) return;
  btnSave.__wired = true;

  function salvarVale(e){
    e && e.preventDefault();

    const gid = document.getElementById('pcGerente')?.value || '';
    if (!gid){ alert('Selecione um gerente para lançar o vale.'); return; }

    let val = String(document.getElementById('dlgVvalor')?.value || '').trim();
    if (val.includes(',')) val = val.replace(/\./g,'').replace(',','.');
    const valor = parseFloat(val || '0') || 0;
    if (valor <= 0){ alert('Informe um valor válido.'); return; }

    const novo = {
      id: (typeof uid==='function' ? uid() : 'v_'+Math.random().toString(36).slice(2,9)),
      gerenteId: gid,
      cod: (document.getElementById('dlgVcod')?.value || '').trim(),
      valor,
      saldo: valor,
      obs: (document.getElementById('dlgVobs')?.value || '').trim(),
      periodo: (document.getElementById('dlgVperiodo')?.value || '').trim(),
      quitado: false,
      criadoEm: new Date().toISOString()
    };

    // Salva no Supabase
    if (window.SupabaseAPI?.vales) {
      window.SupabaseAPI.vales.create(novo).then(() => {
        (window.vales ||= []).push(novo);
        requestAnimationFrame(()=> renderValesPrestacao?.());
      });
    } else {
      (window.vales ||= []).push(novo);
      requestAnimationFrame(()=> renderValesPrestacao?.());
    }

    dlg.close();
    form.reset();
  }

  btnSave.addEventListener('click', salvarVale);
  form.addEventListener('submit', salvarVale);

  // Cancelar → fecha o diálogo de verdade
  if (btnCancel){
    btnCancel.type = 'button';
    btnCancel.addEventListener('click', (e)=>{ e.preventDefault(); dlg.close(); }, { once:true });
  }
})();

/* ========= REABRIR — versão única e estável ========= */
(function ReabrirUnificado(){

  
  const lsRead  = (k)=>{ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch{ return []; } };
  const lsWrite = (k,a)=>{ try{ localStorage.setItem(k, JSON.stringify(a||[])); }catch(e){ console.warn('lsWrite',k,e); } };

  function goToPrestTab(){
    const btn = document.querySelector('[data-tab="prest"]');
    if (btn) { btn.click(); return; }
    if (typeof window.openTab === 'function') { openTab('prest'); return; }
    try { location.hash = '#prest'; } catch(_){}
  }

  async function loadIntoEditor(r){
    try{
      console.log('[EDIT] Carregando:', r.id);
      
      window.__prestBeingEdited = { id: r.id };
      
      // Preenche campos
      const selGer = document.getElementById('pcGerente'); 
      if (selGer) selGer.value = r.gerenteId || '';
      
      document.getElementById('pcIni').value = r.ini || '';
      document.getElementById('pcFim').value = r.fim || '';
  
      // Carrega dados
      window.prestacaoAtual = {
        despesas:  (r.despesas  || []).map(x => ({...x})),
        pagamentos:(r.pagamentos|| []).map(x => ({...x})),
        coletas:   (r.coletas   || []).map(x => ({...x})),
        vales:     (r.vales     || []).map(x => ({...x})),
        valeSelec: (r.valesSel  || []).map(x => ({...x})),
        resumo:    {...(r.resumo || {})},
        valeParcAplicado: (r.valeParcAplicado || []).map(x => ({...x})),
        saldoInfo: r.saldoInfo ? {...r.saldoInfo} : null
      };
  
      console.log('[EDIT] Coletas:', window.prestacaoAtual.coletas?.length);
      console.log('[EDIT] Despesas:', window.prestacaoAtual.despesas?.length);
  
      // Renderiza TUDO
      pcRenderColetas?.();
      pcRender?.();
      pgRender?.();
      renderValesPrestacao?.();
      if (typeof pcCalcular === 'function') await pcCalcular();
      
      console.log('[EDIT] ✅ Prestação carregada!');
      
    } catch(e) {
      console.error('[EDIT] ERRO:', e);
      alert('Erro ao carregar: ' + e.message);
    }
  }

  // reabrir: move de FINALIZADAS -> ABERTAS e (opcional) abre para editar
  window.reabrirPrestacao = function(id, opts={ open:false }){
    try{
      const fechadas = lsRead(DB_PREST);
      const idx = fechadas.findIndex(p => p.id === id);
      if (idx === -1){ alert('Prestação não encontrada.'); return; }

      const rec = fechadas[idx];
      fechadas.splice(idx, 1);
      lsWrite(DB_PREST, fechadas);

      rec.status      = 'aberta';
      rec.fechada     = false;
      delete rec.fechadaEm;
      rec.reabertaEm  = new Date().toISOString();

// 🔁 Escreve de volta na MESMA base única (Relatórios enxerga aqui)
const base = lsRead(DB_PREST);
const j = base.findIndex(p => p.id === rec.id);
if (j > -1) base.splice(j, 1);
base.push(rec);
lsWrite(DB_PREST, base);
try { window.__syncAbertasMirror(); } catch {}


      try { renderPrestFechadas?.(); } catch {}
      try { renderPrestAbertas?.(); } catch {}
      try { renderRelatorios?.(); }   catch {}
      try { window.dispatchEvent(new Event('prestacoes:changed')); } catch {}

      (window.toast ? toast('Prestação reaberta e movida para “Abertas”.')
                    : alert('Prestação reaberta e movida para "Abertas".'));

      if (opts.open){
        // → abrir para edição
        goToPrestTab();
        const t0 = Date.now();
        (function wait(){
          const ok = !!document.querySelector('#prestContas');
          if (ok) return loadIntoEditor(rec);
          if (Date.now() - t0 > 5000) return;
          requestAnimationFrame(wait);
        })();
      } else {
        // → apenas navegar para Relatórios (onde você espera ver o efeito)
        try { showPage?.('prest-rel'); }
        catch(_) { try { openTab?.('prest-rel'); } catch(__) { location.hash = '#prest-rel'; } }
      }

    }catch(e){
      console.warn('reabrirPrestacao:', e);
      alert('Erro ao reabrir (veja o console).');
    }
  };

  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-reabrir]');
    if (!btn) return;
    ev.preventDefault();
    const id = btn.getAttribute('data-reabrir');

    // padrão: NÃO abrir editor (vai para Relatórios).
    // se o botão tiver data-open="1", abre editor.
    const open = btn.hasAttribute('data-open')
      ? (btn.getAttribute('data-open') !== '0')
      : false;

    if (id) window.reabrirPrestacao(id, { open });
  }, true);


})();

// Mantém compatibilidade com código antigo que ainda chama __syncAbertasMirror,
// mas agora atualiza *abertas* e *fechadas* de uma vez.
window.__syncAbertasMirror = function(){
  try { window.__syncPrestMirrors?.(); } 
  catch(e){ console.warn('__syncAbertasMirror wrapper:', e); }
};


// Helpers globais de status
window.__isFechada = (p) =>
  p?.fechada === true || !!p?.fechadaEm || p?.status === 'fechada';

window.__isAberta = (p) =>
  p?.fechada === false || p?.status === 'aberta' || p?.aberta === true ||
  (!!p?.reabertaEm && !p?.fechadaEm);

// 🔁 Espelhos compatíveis para telas antigas: <DB_PREST>_abertas e <DB_PREST>_fechadas
window.__syncPrestMirrors = function(){
  try{
    const baseKey = String(window.DB_PREST || 'bsx_prestacoes_v1');
    const arr = JSON.parse(localStorage.getItem(baseKey) || '[]') || [];
    const fechadas = arr.filter(window.__isFechada);
    const abertas  = arr.filter(window.__isAberta);

    localStorage.setItem(baseKey + '_fechadas', JSON.stringify(fechadas));
    localStorage.setItem(baseKey + '_abertas',  JSON.stringify(abertas));
  }catch(e){
    console.warn('__syncPrestMirrors:', e);
  }
};




/* ==================== PRESTAÇÕES → PÁGINA "VALES" ==================== */
// Sinaliza que a página dedicada está ativa (usado para desativar botões antigos)
window.VALES_PAGE_ENABLED = true;

// util: (re)carrega banco por empresa - usa versão definida na API Supabase
// window.__valesReload já definido acima

// permissão (somente admin edita)
function vlsCanEdit(){
  const A = window.UserAuth || {};
  // admin sempre pode; senão precisa da permissão específica
  return (A.isAdmin?.() === true) || (A.has?.('vales_edit') === true);
}


function vlsFillGerentes(selectEl){
  try{
    const list = Array.isArray(window.gerentes) ? window.gerentes : [];
    selectEl.innerHTML = '<option value="">Selecione</option>' +
      list.map(g=>`<option value="${g.uid}">${esc(g.nome||'(sem nome)')}</option>`).join('');
  }catch{}
}

// popula filtro da tabela
function vlsFillFiltro(){
  const sel = document.getElementById('vlsFiltroGerente'); if (!sel) return;
  const list = Array.isArray(window.gerentes) ? window.gerentes.slice() : [];
  sel.innerHTML = '<option value="">Todos</option>' +
    list.map(g=>`<option value="${g.uid}">${esc(g.nome||'(sem nome)')}</option>`).join('');
}

function vlsRenderTabela(){
  const tb = document.getElementById('vlsTBody'); if (!tb) return;
  const gid = document.getElementById('vlsFiltroGerente')?.value || '';
  const q   = (document.getElementById('vlsBusca')?.value || '').trim().toLowerCase();

  const gname = (id)=> (window.gerentes||[]).find(x=>String(x.uid)===String(id))?.nome || '—';

  const arr = __valesReload().filter(v=>{
    if (gid && String(v.gerenteId) !== String(gid)) return false;
    if (q){
      const hay = `${v.cod||''} ${v.obs||''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>{
    const ga = gname(a.gerenteId).localeCompare(gname(b.gerenteId));
    if (ga!==0) return ga;
    return String(a.cod||'').localeCompare(String(b.cod||''));
  });

  tb.innerHTML = arr.map(v=>{
    const st = v.quitado ? 'Quitado' : 'Em aberto';
    const can = vlsCanEdit();
    return `
      <tr data-id="${v.id}">
        <td style="padding:10px">${esc(gname(v.gerenteId))}</td>
        <td style="padding:10px">${esc(v.cod||'')}</td>
        <td style="padding:10px;text-align:right" class="${v.quitado?'':'tv-red'}">${vlsFmt(v.valor||0)}</td>
        <td style="padding:10px">${esc(v.obs||'')}</td>
        <td style="padding:10px">${esc(v.periodo||'')}</td>
        <td style="padding:10px">${st}</td>
        <td style="padding:10px;text-align:right">
          <button class="btn" data-vls-hist="${v.id}">Histórico</button>
          <button class="btn ghost" data-vls-quitar="${v.id}" ${(!can || v.quitado)?'disabled':''}>Quitar</button>
          <button class="btn danger" data-vls-del="${v.id}" ${!can?'disabled':''}>Excluir</button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="7" style="padding:12px">Nenhum vale encontrado.</td></tr>';

  // ações
  tb.querySelectorAll('[data-vls-del]').forEach(b=>{
    b.addEventListener('click', ()=>{
      if (!vlsCanEdit()) return;
      const id = b.getAttribute('data-vls-del');
      window.deleteValeById?.(id);
      vlsRenderTabela();
      try { renderValesPrestacao?.(); } catch {}
      try { window.dispatchEvent(new Event('vales:updated')); } catch {}
    });
  });

  tb.querySelectorAll('[data-vls-quitar]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if (!vlsCanEdit()) return;
      const id = b.getAttribute('data-vls-quitar');
      const v  = (__valesReload()||[]).find(x=>x.id===id);
      if (!v || v.quitado) return;
      const saldoAntes = Number(v.valor)||0;
      if (!confirm(`Quitar este vale? Isso zera o saldo de ${fmtBRL(saldoAntes)}.`)) return;

      v.valor = 0;
      v.saldo = 0;
      v.quitado = true;
      
      // Atualiza no Supabase
      if (window.SupabaseAPI?.vales) {
        await window.SupabaseAPI.vales.update(id, { saldo: 0, quitado: true });
      }
      
      // Log
      window.valesLog?.add({
        id: (typeof uid==='function'? uid(): 'vl_'+Math.random().toString(36).slice(2,9)),
        valeId: v.id, cod: v.cod||'', gerenteId: v.gerenteId,
        delta: saldoAntes, saldoAntes, saldoDepois: 0,
        prestacaoId: null, periodoIni: null, periodoFim: null,
        createdAt: new Date().toISOString()
      });
      
      vlsRenderTabela();
      try { renderValesPrestacao?.(); } catch {}
      try { window.dispatchEvent(new Event('vales:updated')); } catch {}
    });
  });
}


function vlsOpenNovo(){
  if (!vlsCanEdit()){ alert('Somente administrador pode criar vales.'); return; }
  const dlg = document.getElementById('dlgVlsNovo'); if (!dlg) return;
  // popular gerentes no dialog
  const sel = document.getElementById('vlsGerente'); if (sel){ vlsFillGerentes(sel); }
  dlg.showModal();
}

function vlsSalvarNovo(){
  if (!vlsCanEdit()) return;

  const sel = document.getElementById('vlsGerente'); const gid = sel?.value || '';
  if (!gid){ alert('Selecione o gerente.'); return; }

  const cod = (document.getElementById('vlsCod')?.value || '').trim();
  let valor = (document.getElementById('vlsValor')?.value || '').trim();
  const obs = (document.getElementById('vlsObs')?.value || '').trim();
  const periodo = (document.getElementById('vlsPeriodo')?.value || '').trim();

  if (valor.includes(',')) valor = valor.replace(/\./g,'').replace(',','.');
  const vnum = parseFloat(valor||'0')||0;
  if (vnum <= 0){ alert('Informe um valor válido (> 0).'); return; }

  const novo = {
    id: (typeof uid==='function' ? uid() : 'v_'+Math.random().toString(36).slice(2,9)),
    gerenteId: gid,
    cod, valor: vnum, saldo: vnum, obs, periodo,
    quitado: false,
    criadoEm: new Date().toISOString()
  };

  // Salva no Supabase
  if (window.SupabaseAPI?.vales) {
    window.SupabaseAPI.vales.create(novo).then(() => {
      (window.vales ||= []).push(novo);
      
      // Log de criação
      window.valesLog?.add({
        id: (typeof uid==='function'? uid(): 'vl_'+Math.random().toString(36).slice(2,9)),
        valeId: novo.id, cod: novo.cod||'', gerenteId: novo.gerenteId,
        delta: -(Number(novo.valor)||0),
        saldoAntes: 0, saldoDepois: Number(novo.valor)||0,
        prestacaoId: null, periodoIni: null, periodoFim: null,
        createdAt: new Date().toISOString()
      });
      
      vlsRenderTabela();
      try { renderValesPrestacao?.(); } catch {}
      try { window.dispatchEvent(new Event('vales:updated')); } catch {}
    });
  } else {
    (window.vales ||= []).push(novo);
    vlsRenderTabela();
  }

  document.getElementById('dlgVlsNovo')?.close();
  document.getElementById('vlsForm')?.reset();
}



function ensureHistDialog(){
  // CSS (uma vez só)
  if (!document.getElementById('tvStyles')){
    const css = document.createElement('style');
    css.id = 'tvStyles';
    css.textContent = `
      dialog.tv { border:none; border-radius:16px; padding:0; max-width:980px; width:96vw; }
      dialog::backdrop { background: rgba(0,0,0,.35); }
      .tv-head{background:#111;color:#fff;padding:12px 20px;font-weight:700}
      .tv-box{padding:18px 20px}
      .tv-table{width:100%; border-collapse:collapse; font-size:14px}
      .tv-table th,.tv-table td{border-bottom:1px solid #eee; padding:8px; text-align:left}
      .tv-right{text-align:right}
      .tv-mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace}
      .tv-red{color:#b91c1c}
      .tv-green{color:#16a34a}
      .tv-actions{display:flex; gap:8px; justify-content:flex-end; padding:12px 20px; border-top:1px solid #eee}
      .btn{padding:.5rem .8rem; border-radius:.5rem; background:#111; color:#fff; border:none; cursor:pointer}
      .btn.ghost{background:#f3f4f6; color:#111}
    `;
    document.head.appendChild(css);
  }

  if (document.getElementById('dlgVlsHist')) return;

  const dlg = document.createElement('dialog');
  dlg.id = 'dlgVlsHist';
  dlg.className = 'tv';
  dlg.innerHTML = `
    <div class="tv-head" id="vlsHistTitulo">Histórico</div>
    <div class="tv-box" style="max-height:70vh;overflow:auto;border:1px solid #eee;border-radius:12px">
      <table class="tv-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th class="tv-right">Δ (R$)</th>
            <th class="tv-right">Saldo (antes → depois)</th>
            <th>Período / Prestação</th>
          </tr>
        </thead>
        <tbody id="vlsHistBody"><tr><td colspan="4">—</td></tr></tbody>
      </table>
    </div>
    <div class="tv-actions"><button class="btn ghost" id="vlsHistFechar">Fechar</button></div>`;
  document.body.appendChild(dlg);

  dlg.querySelector('#vlsHistFechar').addEventListener('click', ()=> dlg.close());
  dlg.addEventListener('click', (e)=>{ if (e.target===dlg) dlg.close(); });
}

async function vlsOpenHist(id){
  const gname = (gid)=> (window.gerentes||[]).find(x=>String(x.uid)===String(gid))?.nome || '—';
  const v = (__valesReload()||[]).find(x=>x.id===id);
  if (!v) return;

  ensureHistDialog();
  const dlg = document.getElementById('dlgVlsHist');
  dlg.querySelector('#vlsHistTitulo').textContent =
    `Histórico — Vale ${v.cod||''} (${gname(v.gerenteId)})`;

  const tb  = dlg.querySelector('#vlsHistBody');
  tb.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
  dlg.showModal();

  // Carrega logs do Supabase
  let logs = [];
  if (window.SupabaseAPI?.valesLog?.list) {
    logs = await window.SupabaseAPI.valesLog.list({valeId: id});
  }
  logs.sort((a,b)=> String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  tb.innerHTML = logs.length ? logs.map(ev=>{
    const delta = Number(ev.delta)||0;
    const dstr  = `${fmtData(ev.createdAt)} ${fmtHora?.(ev.createdAt) || ''}`;
    const per   = (ev.periodoIni && ev.periodoFim) ? `${fmtData(ev.periodoIni)} a ${fmtData(ev.periodoFim)}` : (ev.prestacaoId ? 'Prestação' : '');
    return `<tr>
      <td class="tv-mono">${dstr}</td>
      <td class="tv-right tv-mono ${delta>=0?'tv-red':'tv-green'}">${delta>=0?'-':'+'}${fmtBRL(Math.abs(delta))}</td>
      <td class="tv-right tv-mono">${fmtBRL(Number(ev.saldoAntes)||0)} → ${fmtBRL(Number(ev.saldoDepois)||0)}</td>
      <td>${per}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="4">Nenhum evento registrado para este vale.</td></tr>';
}


async function vlsInit(){
  const A = window.UserAuth || {};
  if (!(A.isAdmin?.() || A.can?.('vales_view'))) {
    alert('Você não tem permissão para ver a página de Vales.');
    return;
  }
  document.getElementById('btnAbrirVale')?.remove();
  document.getElementById('btnVerTodosVales')?.remove();

  // Carrega vales do Supabase antes de renderizar
  if (window.__valesReloadAsync) {
    await window.__valesReloadAsync();
  }

  vlsFillFiltro();
  vlsRenderTabela();

  document.getElementById('vlsFiltroGerente')?.addEventListener('change', vlsRenderTabela);
  document.getElementById('vlsBusca')?.addEventListener('input', vlsRenderTabela);
  document.getElementById('vlsBtnNovo')?.addEventListener('click', vlsOpenNovo);
  document.getElementById('vlsSalvar')?.addEventListener('click', vlsSalvarNovo);

  // Delegação única: capta cliques no botão "Histórico" mesmo após re-render
const tbHist = document.getElementById('vlsTBody');
if (tbHist && !tbHist.__histWired){
  tbHist.__histWired = true;
  tbHist.addEventListener('click', (e)=>{
    const b = e.target.closest('[data-vls-hist]');
    if (!b) return;
    e.preventDefault();
    const id = b.getAttribute('data-vls-hist');
    if (window.vlsOpenHist) window.vlsOpenHist(id);
  }, true);
}


  // reagir a mudanças externas
  window.addEventListener('vales:updated', vlsRenderTabela);
  document.addEventListener('empresa:change', async ()=>{ 
    await window.__valesReloadAsync?.(); 
    vlsFillFiltro(); 
    vlsRenderTabela(); 
  });
}

// inicializa quando a aba “Vales” for exibida (se você usa openTab)
document.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('[data-tab="vales"]');
  if (!btn) return;
  setTimeout(vlsInit, 0);
});

// fallback: se a aba já estiver no DOM ao carregar
document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('tabVales')) vlsInit();
});
/* ==================== /PÁGINA "VALES" ==================== */
/* ===== LIMPAR UI DA PRESTAÇÃO (sem espelho e sem botões de vales) ===== */


/* ===== LIMPAR UI DA PRESTAÇÃO (sem espelho e sem botões de vales) ===== */
(function CleanPrestUI(){
  function run(){
   
    // Esconde controles legados de VALE (a UI nova já cobre)
    ['formVale','btnAbrirVale'].forEach(id=>{
      const el = document.getElementById(id);
      if (el){
        if (el.tagName === 'FORM') el.style.display = 'none';
        else el.remove();
      }
    });

    // Esconde inputs “inline” antigos (já foi feito em setupPrestModals, reforço aqui)
    ['pgNData','pgNValor','pgNForma','pgNObs'].forEach(id=>{
      const el = document.getElementById(id);
      if (el){
        el.style.display = 'none';
        if (el.parentElement) el.parentElement.style.display = 'none';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
})();


// Expor funções globalmente para uso em outros arquivos
window.pcRenderColetas = pcRenderColetas;
window.pcRender = pcRender;
window.pgRender = pgRender;
window.renderValesPrestacao = renderValesPrestacao;
window.pcCalcular = pcCalcular;
window.fillPcGerentes = fillPcGerentes;
window.__backfillValeParcFromPagamentos = __backfillValeParcFromPagamentos;

// ===== GARANTE ACESSO ÀS FUNÇÕES DO FINANCEIRO =====
(function ensureFinanceiroFunctions() {
  // Aguarda o financeiro estar pronto
  const waitForFin = setInterval(() => {
    if (typeof __getPendencias === 'function' && 
        typeof __setPendencias === 'function' &&
        typeof __negMakeUID === 'function') {
      
      clearInterval(waitForFin);
      console.log('✅ Funções do Financeiro disponíveis para Prestações');
      
      // Se já existem prestações na memória, sincroniza pendências
      try {
        if (typeof syncPendenciasFromPrest === 'function') {
          syncPendenciasFromPrest();
        }
      } catch(e) {
        console.warn('Erro ao sincronizar pendências:', e);
      }
    }
  }, 100);
  
  // Timeout de segurança (10 segundos)
  setTimeout(() => clearInterval(waitForFin), 10000);
})();

// ===== BOTÕES DE DEBUG PARA PENDÊNCIAS =====
document.getElementById('btnSyncPendencias')?.addEventListener('click', () => {
  try {
    if (typeof syncPendenciasFromPrest === 'function') {
      syncPendenciasFromPrest();
      renderFinPendencias();
      alert('✅ Pendências sincronizadas!');
    }
  } catch(e) {
    console.error('Erro ao sincronizar:', e);
    alert('❌ Erro ao sincronizar: ' + e.message);
  }
});

document.getElementById('btnDebugPendencias')?.addEventListener('click', () => {
  try {
    const pend = __getPendencias();
    console.log('📊 Total de pendências:', pend.length);
    console.log('Pendências PENDENTES:', pend.filter(p => p.status === 'PENDENTE').length);
    console.log('Pendências de PAGAMENTO:', pend.filter(p => p.tipoCaixa === 'PAGO').length);
    console.log('Pendências de RECEBIMENTO:', pend.filter(p => p.tipoCaixa === 'RECEBIDO').length);
    console.table(pend);
    
    alert(`📊 Debug de Pendências:
    
Total: ${pend.length}
Pendentes: ${pend.filter(p => p.status === 'PENDENTE').length}
Pagamentos: ${pend.filter(p => p.tipoCaixa === 'PAGO').length}
Recebimentos: ${pend.filter(p => p.tipoCaixa === 'RECEBIDO').length}

Veja o console para mais detalhes.`);
  } catch(e) {
    console.error('Erro ao debugar:', e);
    alert('❌ Erro: ' + e.message);
  }

 // ===== CLEANUP AO SAIR DA PÁGINA =====
window.addEventListener('beforeunload', function() {
  console.log('[Prestações] Limpando listeners...');
  
  // Limpa elementos principais
  ['pcColetasBody', 'pcDespesasBody', 'pgVBody', 'pgNBody'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) clearPcListeners(el);
  });
  
  // Limpa botões
  ['btnColAdd', 'btnPcSalvarColetores', 'btnPcAddDespesa', 'btnPcLimpar',
   'btnPgVAdd', 'btnPgVLimpar', 'btnPgNAdd', 'btnPgNLimpar',
   'btnVlAdd', 'btnVlLimpar', 'btnPcSalvar'].forEach(function(id) {
    const btn = document.getElementById(id);
    if (btn) {
      clearPcListeners(btn);
      btn.__pcWired = false;
    }
  });
});
// === FIX: (re)liga botões quando o DOM estiver pronto e em mudanças dinâmicas ===
(function ensurePrestacoesWiring(){
  function wire(ids, handler){
    (Array.isArray(ids) ? ids : [ids]).forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.__pcWired) return;
      el.__pcWired = true;
      if (typeof addPcListener === 'function') {
        addPcListener(el, 'click', handler);
      } else {
        el.addEventListener('click', handler);
      }
    });
  }

  
  function wireAll(){
    // Compat com nome legado citado (prestotadaurl -> prestToDataURL)
    if (!window.prestotadaurl && window.prestToDataURL) {
      window.prestotadaurl = window.prestToDataURL;
    }

    // Salvar prestação (suporta 2 ids, caso o HTML varie)
    wire(['btnPcSalvar','btnPcSalvarPrestacao'], function(e){
      e.preventDefault();
      try { salvarPrestacao(); } catch(err){ console.error(err); alert('Falha ao salvar.'); }
    });


    // Gerar PNG (popup da imagem)
    wire(['btnPcPng','btnPcGerarImagem'], async function(e){  // ✅ async
      e.preventDefault();
      try {
        const rec = typeof getPrestacaoFromForm === 'function'
          ? await getPrestacaoFromForm() : null;  // ✅ AGUARDA
        const png = window.prestToDataURL?.(rec);
        if (!png) { alert('Não foi possível gerar a imagem.'); return; }
        const w = window.open('', 'img_prestacao');
        if (!w) { alert('Popup bloqueado.'); return; }
        w.document.write(`
          <html><head><meta charset="utf-8"><title>Prestação</title></head>
          <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;">
            <img src="${png}" style="max-width:100vw;max-height:100vh"/>
          </body></html>
        `);
        w.document.close();
      } catch(err){ console.error(err); alert('Falha ao abrir a imagem.'); }
    });

    // Desenhar no canvas embutido (se você usar essa opção)
    wire(['btnPcDesenhar','btnPcCanvas'], function(e){
      e.preventDefault();
      try { pcDesenharCanvas?.(); } catch(err){ console.error(err); alert('Falha ao desenhar no canvas.'); }
    });
  }

  // roda no readyState adequado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAll, { once:true });
  } else {
    wireAll();
  }
  // re-liga ao trocar seções/abas dinamicamente
  new MutationObserver(wireAll).observe(document.body, { childList:true, subtree:true });
})();

// Botões de pagamento de dívida
(function() {
  const btnAdd = document.getElementById('btnPgDivAdd');
  if (btnAdd && !btnAdd.__pcWired) {
    btnAdd.__pcWired = true;
    addPcListener(btnAdd, 'click', pgDivAddFromForm);
  }

  const btnLimpar = document.getElementById('btnPgDivLimpar');
  if (btnLimpar && !btnLimpar.__pcWired) {
    btnLimpar.__pcWired = true;
    addPcListener(btnLimpar, 'click', function() {
      if(!confirm('Limpar todos os pagamentos de dívida desta prestação?')) return;
      prestacaoAtual.pagamentos = (prestacaoAtual.pagamentos||[]).filter(p => 
        (p.forma||'').toUpperCase()!=='DIVIDA_PAGA'
      );
      pcSchedule();
    });
  }
})();

// Preenche data automaticamente
document.addEventListener('DOMContentLoaded', function() {
  const hoje = new Date().toISOString().slice(0,10);
  const dataDivida = document.getElementById('pgDivData');
  if (dataDivida && !dataDivida.value) {
    dataDivida.value = hoje;
  }
});


});