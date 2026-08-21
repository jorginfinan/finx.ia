// ============================================
// PÁGINA DE EMPRESAS (submenu próprio, só admin)
// ============================================
(function () {
  'use strict';

  if (window.__EMPRESAS_PAGE_LOADED__) return;
  window.__EMPRESAS_PAGE_LOADED__ = true;

  let __cache = [];       // { id, nome, emoji, ativo }
  let __stats = [];       // stats por empresa
  let __editingId = null;

  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
    else if (type === 'error') alert('❌ ' + msg);
  }

  function isAdmin() {
    try { return window.UserAuth?.isAdmin?.() === true; } catch(_) { return false; }
  }

  // ============================================
  // LOADS
  // ============================================
  async function loadEmpresas() {
    try {
      if (!window.SupabaseAPI?.empresas) return [];
      __cache = await window.SupabaseAPI.empresas.getAll();
      return __cache;
    } catch (e) { console.error('[Empresas] load:', e); return []; }
  }

  async function loadStats() {
    try {
      if (!window.SupabaseAPI?.empresas?.getEstatisticas) return [];
      __stats = await window.SupabaseAPI.empresas.getEstatisticas();
      return __stats;
    } catch (e) { console.error('[Empresas] stats:', e); return []; }
  }

  // ============================================
  // RENDERS
  // ============================================
  function setTxt(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function renderKPIs() {
    const ativas   = __stats.filter(s => s.ativo).length;
    const total    = __stats.length;
    const gerTotal = __stats.reduce((a, s) => a + (s.gerentes_ativos || 0), 0);
    const prestSem = __stats.reduce((a, s) => a + (s.prest_semana_aberta || 0) + (s.prest_semana_fechada || 0), 0);
    const prestMes = __stats.reduce((a, s) => a + (s.prest_mes_aberta || 0) + (s.prest_mes_fechada || 0), 0);
    setTxt('kpiEmpAtivas', ativas);
    setTxt('kpiEmpTotal', total + ' no total');
    setTxt('kpiEmpGerentes', gerTotal);
    setTxt('kpiEmpPrestSem', prestSem);
    setTxt('kpiEmpPrestMes', prestMes);
  }

  function renderResumoCards() {
    const wrap = document.getElementById('empresasResumoCards');
    if (!wrap) return;
    if (!__stats.length) {
      wrap.innerHTML = '<div style="color:#6b7280; padding:20px; text-align:center;">Nenhuma empresa cadastrada.</div>';
      return;
    }

    // Ordena: ativas primeiro, depois alfabético
    const ordenados = __stats.slice().sort((a, b) => {
      if (a.ativo !== b.ativo) return b.ativo - a.ativo;
      return String(a.nome).localeCompare(String(b.nome));
    });

    wrap.innerHTML = ordenados.map(s => {
      const statusBadge = s.ativo
        ? '<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">ATIVA</span>'
        : '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">INATIVA</span>';

      const bg = s.ativo ? '#ffffff' : '#f9fafb';
      const opacity = s.ativo ? '1' : '0.7';

      return `
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:${bg}; opacity:${opacity};" data-emp-id="${esc(s.id)}">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:28px;">${esc(s.emoji || (window.EMPRESA_EMOJI_FALLBACK||{})[String(s.nome).toUpperCase()] || '🏢')}</span>
              <strong style="font-size:16px;">${esc(s.nome)}</strong>
            </div>
            ${statusBadge}
          </div>

          <!-- Grid de mini KPIs -->
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-top:12px;">

            <!-- Gerentes -->
            <div style="background:#f0f9ff; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#075985; font-weight:600;">GERENTES</div>
              <div style="font-size:20px; font-weight:700; color:#0369a1;">${s.gerentes_ativos}</div>
              <div style="font-size:10px; color:#0284c7;">${s.gerentes_semanais} sem • ${s.gerentes_mensais} mês</div>
            </div>

            <!-- Máquinas -->
            <div style="background:#f0fdf4; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#166534; font-weight:600;">MÁQUINAS</div>
              <div style="font-size:20px; font-weight:700; color:#15803d;">${s.maquinas_total}</div>
              <div style="font-size:10px; color:#22c55e;">${s.maquinas_com_vendedor} c/ vendedor</div>
            </div>

            <!-- Prestações semana -->
            <div style="background:#fef3c7; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#92400e; font-weight:600;">📅 SEMANA</div>
              <div style="font-size:20px; font-weight:700; color:#b45309;">${s.prest_semana_aberta + s.prest_semana_fechada}</div>
              <div style="font-size:10px; color:#a16207;">${s.prest_semana_aberta} aberta(s) • ${s.prest_semana_fechada} fechada(s)</div>
            </div>

            <!-- Prestações mês -->
            <div style="background:#ede9fe; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#5b21b6; font-weight:600;">🗓️ MÊS</div>
              <div style="font-size:20px; font-weight:700; color:#6d28d9;">${s.prest_mes_aberta + s.prest_mes_fechada}</div>
              <div style="font-size:10px; color:#7c3aed;">${s.prest_mes_aberta} aberta(s) • ${s.prest_mes_fechada} fechada(s)</div>
            </div>
          </div>

          <!-- Ações -->
          <div style="display:flex; gap:6px; margin-top:14px; justify-content:flex-end;">
            <button class="btn ghost" data-emp-act="editar" data-tip="Editar dados">✏️ Editar</button>
            ${s.ativo
              ? '<button class="btn ghost" data-emp-act="inativar" data-tip="Inativar (não aparece no seletor)">🚫 Inativar</button>'
              : '<button class="btn" data-emp-act="ativar" data-tip="Reativar">↩️ Ativar</button>'
            }
            <button class="btn danger" data-emp-act="excluir" data-tip="Excluir permanentemente (só se sem dados)">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // FORM CADASTRO
  // ============================================
  // Popula o <select> de emojis com as opções padrão
  function popularSelectEmoji(valorSelecionado) {
    const sel = document.getElementById('empEmojiSelect');
    if (!sel) return;
    const opts = window.EMPRESA_EMOJI_OPTIONS || [{ emoji: '🏢', label: 'Prédio' }];
    sel.innerHTML = opts.map(o =>
      `<option value="${esc(o.emoji)}">${esc(o.emoji)}  ${esc(o.label)}</option>`
    ).join('');
    if (valorSelecionado) {
      // Se o emoji atual não estiver nas opções, adiciona no topo
      if (!opts.some(o => o.emoji === valorSelecionado)) {
        const opt = document.createElement('option');
        opt.value = valorSelecionado;
        opt.textContent = valorSelecionado + '  (personalizado)';
        sel.insertBefore(opt, sel.firstChild);
      }
      sel.value = valorSelecionado;
    }
  }

  function resetForm() {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    f.reset();
    __editingId = null;
    f.querySelector('#empAtivo').checked = true;
    popularSelectEmoji('🏢');   // reseta para o padrão
    document.getElementById('btnSalvarEmpresa').textContent = 'Salvar Empresa';
  }

  function carregarParaEdicao(emp) {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    __editingId = emp.id;
    f.nome.value = emp.nome || '';
    popularSelectEmoji(emp.emoji || '🏢');
    f.querySelector('#empAtivo').checked = !!emp.ativo;
    document.getElementById('btnSalvarEmpresa').textContent = 'Atualizar Empresa';
    f.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) { notify('Apenas admin.', 'error'); return; }
    const f = e.currentTarget;
    const fd = new FormData(f);
    const nome  = String(fd.get('nome') || '').trim();
    const emoji = String(fd.get('emoji') || '🏢').trim() || '🏢';
    const ativo = !!fd.get('ativo');
    if (!nome) { notify('Informe o nome.', 'error'); return; }

    try {
      if (__editingId) {
        await window.SupabaseAPI.empresas.update(__editingId, { nome, emoji, ativo });
        notify('Empresa atualizada!', 'success');
      } else {
        await window.SupabaseAPI.empresas.create({ nome, emoji, ativo });
        notify('Empresa cadastrada!', 'success');
      }
      resetForm();
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) {
      alert('⚠️ ' + (err.message || 'Erro ao salvar'));
    }
  }

  async function inativarEmp(emp) {
    if (!isAdmin()) return;
    if (!confirm(`Inativar "${emp.nome}"?\n\nEla deixa de aparecer no seletor. Você pode reativar depois.`)) return;
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: false });
      notify('Empresa inativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { alert('⚠️ ' + (err.message || 'Erro')); }
  }

  async function ativarEmp(emp) {
    if (!isAdmin()) return;
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: true });
      notify('Empresa reativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { alert('⚠️ ' + (err.message || 'Erro')); }
  }

  async function excluirEmp(emp) {
    if (!isAdmin()) return;
    if (!confirm(`Excluir PERMANENTEMENTE "${emp.nome}"?\n\nSó é possível se não houver gerentes, prestações, despesas ou fichas vinculadas.`)) return;
    if (!confirm('Tem certeza absoluta? Esta ação NÃO pode ser desfeita.')) return;
    try {
      await window.SupabaseAPI.empresas.delete(emp.id);
      notify('Empresa excluída.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) {
      alert('⚠️ ' + (err.message || 'Erro ao excluir'));
    }
  }

  // ============================================
  // EVENTS
  // ============================================
  function bindEvents() {
    const f = document.getElementById('formEmpresa');
    if (f && !f.__wired) {
      f.__wired = true;
      f.addEventListener('submit', onSubmit);
    }
    const btnL = document.getElementById('btnLimparEmpresa');
    if (btnL && !btnL.__wired) {
      btnL.__wired = true;
      btnL.addEventListener('click', resetForm);
    }
    const btnA = document.getElementById('btnAtualizarEmpresas');
    if (btnA && !btnA.__wired) {
      btnA.__wired = true;
      btnA.addEventListener('click', async () => {
        btnA.disabled = true;
        await render();
        btnA.disabled = false;
        notify('Atualizado!', 'success');
      });
    }

    // Delegation nos cards
    const wrap = document.getElementById('empresasResumoCards');
    if (wrap && !wrap.__wired) {
      wrap.__wired = true;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-emp-act]');
        if (!btn) return;
        const card = btn.closest('[data-emp-id]');
        const id = card?.getAttribute('data-emp-id');
        const emp = __cache.find(x => String(x.id) === String(id));
        if (!emp) return;
        const act = btn.getAttribute('data-emp-act');
        if (act === 'editar')   return carregarParaEdicao(emp);
        if (act === 'inativar') return inativarEmp(emp);
        if (act === 'ativar')   return ativarEmp(emp);
        if (act === 'excluir')  return excluirEmp(emp);
      });
    }
  }

  async function render() {
    await Promise.all([ loadEmpresas(), loadStats() ]);
    renderKPIs();
    renderResumoCards();
  }

  async function init() {
    // ⛔ Bloqueio duro: só admin. Se qualquer usuário comum conseguir
    // navegar para esta página (ex.: por hash direto), a UI mostra
    // mensagem de acesso negado em vez de carregar dados.
    if (!isAdmin()) {
      const wrap = document.getElementById('empresasResumoCards');
      if (wrap) {
        wrap.innerHTML = `
          <div style="grid-column:1/-1; padding:24px; text-align:center; background:#fef2f2; border:1px solid #fca5a5; border-radius:12px;">
            <div style="font-size:36px; margin-bottom:8px;">🔒</div>
            <strong style="color:#991b1b;">Acesso restrito a administradores</strong>
            <div style="font-size:12px; color:#7f1d1d; margin-top:6px;">
              Esta área é exclusiva para admin. Se precisa de acesso, fale com um administrador do sistema.
            </div>
          </div>`;
      }
      // Esconde form e KPIs também (o guard() do RBAC já faz, mas garantia extra)
      const form = document.getElementById('formEmpresa');
      if (form) form.closest('.card').style.display = 'none';
      const kpis = document.getElementById('empresasKPIs');
      if (kpis) kpis.style.display = 'none';
      return;
    }
    bindEvents();
    popularSelectEmoji('🏢');   // popula o select de ícones do form
    await render();
  }

  window.EmpresasPage = { init, render };
  window.renderEmpresasPage = render;

  console.log('[Empresas] ✅ Página carregada');
})();


// ============================================
// SELETOR DE EMPRESA (TOPO) — populado dinamicamente
// ============================================
//
// ✅ Fallback de ícones — preserva os emojis históricos do HTML
// para empresas antigas que possam não ter emoji definido no banco.
// Se o banco tem emoji, usa o do banco; senão, usa o fallback.
window.EMPRESA_EMOJI_FALLBACK = {
  'BSX':     '🏢',
  'BSXTV':   '📺',
  'BETPLAY': '🎮',
  'EMANUEL': '👤'
};

// ✅ Opções padrão para o cadastro escolher (usadas pelo formulário)
window.EMPRESA_EMOJI_OPTIONS = [
  { emoji: '🏢', label: 'Prédio' },
  { emoji: '📺', label: 'TV' },
  { emoji: '🎮', label: 'Game' },
  { emoji: '👤', label: 'Pessoa' },
  { emoji: '🏬', label: 'Loja' },
  { emoji: '🏭', label: 'Fábrica' },
  { emoji: '🏦', label: 'Banco' },
  { emoji: '🏛️', label: 'Institucional' },
  { emoji: '💼', label: 'Executivo' },
  { emoji: '🛍️', label: 'Sacola' },
  { emoji: '📱', label: 'Celular' },
  { emoji: '💳', label: 'Cartão' },
  { emoji: '⚙️', label: 'Engrenagem' },
  { emoji: '🚀', label: 'Foguete' }
];

(function () {
  'use strict';

  // Retorna a lista de empresas (em UPPERCASE) que o usuário tem acesso.
  // Array vazio = SEM restrição (admin ou usuário legado sem limitação).
  function empresasPermitidas() {
    try {
      const cu = window.UserAuth?.currentUser?.();
      if (!cu) return [];
      if (cu.role === 'admin') return [];  // admin vê tudo
      const arr = Array.isArray(cu.companies) ? cu.companies : [];
      return arr.map(c => String(c).toUpperCase());
    } catch (_) { return []; }
  }

  async function reloadSelector() {
    const sel = document.getElementById('empresaSelect');
    if (!sel) return;
    if (!window.SupabaseAPI?.empresas) {
      return setTimeout(reloadSelector, 500);
    }
    try {
      const empresas = await window.SupabaseAPI.empresas.getAll({ ativasApenas: true });
      if (!empresas.length) return;

      // ✅ Filtra pelas empresas que o usuário tem acesso
      const permitidas = empresasPermitidas();
      let visiveis = empresas;
      if (permitidas.length > 0) {
        visiveis = empresas.filter(e =>
          permitidas.includes(String(e.nome || '').toUpperCase())
        );
      }
      if (!visiveis.length) {
        // Fallback: mesmo sem match, mantém a atual pra não quebrar tela
        visiveis = empresas.filter(e =>
          String(e.nome || '').toUpperCase() === (window.getCompany?.() || 'BSX').toUpperCase()
        );
        if (!visiveis.length) return;
      }

      const atual = (window.getCompany?.() || 'BSX').toUpperCase();
      const fallback = window.EMPRESA_EMOJI_FALLBACK || {};
      sel.innerHTML = visiveis.map(e => {
        const nome = e.nome || '';
        const emoji = e.emoji || fallback[nome.toUpperCase()] || '🏢';
        const selected = nome.toUpperCase() === atual ? 'selected' : '';
        return `<option value="${nome}" ${selected}>${emoji} ${nome}</option>`;
      }).join('');

      // Se a empresa atualmente selecionada NÃO está na lista permitida,
      // troca automaticamente para a primeira permitida
      const currentIsVisible = visiveis.some(e => String(e.nome).toUpperCase() === atual);
      if (!currentIsVisible && visiveis[0]) {
        // Não recarrega — só ajusta valor visual do select
        sel.value = visiveis[0].nome;
      }
    } catch (e) {
      console.warn('[EmpresasSelector] Falha:', e);
    }
  }

  window.__reloadEmpresaSelector = reloadSelector;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(reloadSelector, 1000));
  } else {
    setTimeout(reloadSelector, 1000);
  }
})();
